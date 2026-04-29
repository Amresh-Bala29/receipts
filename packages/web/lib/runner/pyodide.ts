export type RunResult = {
  stdout: string;
  stderr: string;
  exitCode: 0 | 1;
  durationMs: number;
  truncated: boolean;
};

type WorkerResponse =
  | { type: "loaded"; requestId: string }
  | { type: "result"; requestId: string; result: RunResult }
  | { type: "error"; requestId: string; error: string };

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
};

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/";
const OUTPUT_LIMIT = 8000;
const RUN_TIMEOUT_MS = 10_000;

let worker: Worker | null = null;
let runtimeReady = false;
let loadPromise: Promise<void> | null = null;
const pendingRequests = new Map<string, PendingRequest>();

const workerSource = `
let pyodide = null;
let loadingPromise = null;
const PYODIDE_CDN = ${JSON.stringify(PYODIDE_CDN)};
const OUTPUT_LIMIT = ${OUTPUT_LIMIT};

function clipOutput(value) {
  if (value.length <= OUTPUT_LIMIT) {
    return { value, truncated: false };
  }
  return { value: value.slice(0, OUTPUT_LIMIT), truncated: true };
}

async function ensurePyodide() {
  if (pyodide) return pyodide;
  if (!loadingPromise) {
    loadingPromise = (async () => {
      importScripts(PYODIDE_CDN + "pyodide.js");
      pyodide = await loadPyodide({ indexURL: PYODIDE_CDN });
      return pyodide;
    })();
  }
  return loadingPromise;
}

async function runSource(source) {
  const startedAt = performance.now();
  const runtime = await ensurePyodide();
  let exitCode = 0;

  // A fresh Python dict gives each run its own globals without mutating
  // Pyodide's runtime globals, so names from one run do not leak into the next.
  const globals = runtime.globals.get("dict")();

  runtime.runPython(
    "import sys, io\\n" +
      "_receipts_stdout = io.StringIO()\\n" +
      "_receipts_stderr = io.StringIO()\\n" +
      "_receipts_old_stdout = sys.stdout\\n" +
      "_receipts_old_stderr = sys.stderr\\n" +
      "sys.stdout = _receipts_stdout\\n" +
      "sys.stderr = _receipts_stderr\\n",
    { globals, locals: globals },
  );

  try {
    await runtime.runPythonAsync(source, { globals, locals: globals });
  } catch (error) {
    exitCode = 1;
    const stderrMessage = error instanceof Error ? error.message : String(error);
    globals.set("_receipts_js_error", stderrMessage);
    runtime.runPython(
      "sys.stderr.write(_receipts_js_error)\\n" +
        "if not _receipts_js_error.endswith('\\\\n'):\\n" +
        "    sys.stderr.write('\\\\n')\\n",
      { globals, locals: globals },
    );
  }

  const outputProxy = runtime.runPython(
    "sys.stdout = _receipts_old_stdout\\n" +
      "sys.stderr = _receipts_old_stderr\\n" +
      "(_receipts_stdout.getvalue(), _receipts_stderr.getvalue())\\n",
    { globals, locals: globals },
  );
  const [rawStdout, rawStderr] = outputProxy.toJs();
  outputProxy.destroy();
  globals.destroy();

  const stdout = clipOutput(rawStdout);
  const stderr = clipOutput(rawStderr);

  return {
    stdout: stdout.value,
    stderr: stderr.value,
    exitCode,
    durationMs: Math.round(performance.now() - startedAt),
    truncated: stdout.truncated || stderr.truncated,
  };
}

self.onmessage = (event) => {
  const message = event.data;

  if (message.type === "load") {
    ensurePyodide()
      .then(() => self.postMessage({ type: "loaded", requestId: message.requestId }))
      .catch((error) =>
        self.postMessage({
          type: "error",
          requestId: message.requestId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    return;
  }

  if (message.type === "interrupt") {
    try {
      pyodide?.runPython("raise KeyboardInterrupt");
    } catch {
      // Best effort only: tight loops may keep the worker busy until it is terminated.
    }
    return;
  }

  if (message.type === "run") {
    runSource(message.source)
      .then((result) =>
        self.postMessage({ type: "result", requestId: message.requestId, result }),
      )
      .catch((error) =>
        self.postMessage({
          type: "error",
          requestId: message.requestId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
  }
};
`;

function createPythonWorker(): Worker {
  const blob = new Blob([workerSource], { type: "text/javascript" });
  const nextWorker = new Worker(URL.createObjectURL(blob));

  nextWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const pending = pendingRequests.get(event.data.requestId);
    if (!pending) return;

    pendingRequests.delete(event.data.requestId);

    if (event.data.type === "loaded") {
      runtimeReady = true;
      pending.resolve(undefined);
    } else if (event.data.type === "result") {
      pending.resolve(event.data.result);
    } else {
      pending.reject(new Error(event.data.error));
    }
  };

  nextWorker.onerror = (event) => {
    for (const pending of pendingRequests.values()) {
      pending.reject(new Error(event.message));
    }
    pendingRequests.clear();
  };

  return nextWorker;
}

function postRequest<T>(type: "load" | "run", source?: string): Promise<T> {
  worker ??= createPythonWorker();
  const requestId = crypto.randomUUID();

  return new Promise<T>((resolve, reject) => {
    pendingRequests.set(requestId, {
      resolve: (value) => resolve(value as T),
      reject,
    });
    worker?.postMessage({ type, requestId, source });
  });
}

function resetWorkerAfterTimeout() {
  worker?.postMessage({ type: "interrupt" });
  worker?.terminate();
  worker = null;
  runtimeReady = false;
  loadPromise = null;
  pendingRequests.clear();
}

export function isPythonRuntimeReady(): boolean {
  return runtimeReady;
}

export function ensurePythonRuntime(): Promise<void> {
  loadPromise ??= postRequest<void>("load");
  return loadPromise;
}

export async function runPython(source: string): Promise<RunResult> {
  await ensurePythonRuntime();

  const runPromise = postRequest<RunResult>("run", source);
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<RunResult>((resolve) => {
    timeoutId = window.setTimeout(() => {
      resetWorkerAfterTimeout();
      resolve({
        stdout: "",
        stderr: "Execution timed out after 10s",
        exitCode: 1,
        durationMs: RUN_TIMEOUT_MS,
        truncated: false,
      });
    }, RUN_TIMEOUT_MS);
  });

  try {
    return await Promise.race([runPromise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }
  }
}
