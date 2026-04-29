"use client";

import Editor, { type OnChange, type OnMount } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { Play, ReceiptText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProcessEvent } from "@receipts/shared";
import { ConsolePanel, type ConsoleRun } from "./ConsolePanel";
import { LiveSignalsPanel } from "./LiveSignalsPanel";
import { useHandlePopover } from "@/components/handle/HandlePopoverContext";
import { getHandle, subscribeToHandle } from "@/lib/identity";
import {
  ensurePythonRuntime,
  isPythonRuntimeReady,
  runPython,
  type RunResult,
} from "@/lib/runner/pyodide";

const FILE_NAME = "main.py";
const STARTER_CODE = `def total_score(values):\n    return sum(values)\n\nprint(total_score([7, 8, 9]))\n`;

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

async function sha256Content(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function nowIso(): string {
  return new Date().toISOString();
}

function CaptureStatusLine({
  hasEvents,
  handle,
}: {
  hasEvents: boolean;
  handle: string | null;
}) {
  const linkRef = useRef<HTMLButtonElement | null>(null);
  const ownsPopoverRef = useRef(false);
  const { open, anchorRef, setAnchor, openPopover } = useHandlePopover();
  const isActiveTrigger = open && anchorRef.current === linkRef.current;
  const lineOne = hasEvents ? "Capture is running." : "Capture is ready.";

  useEffect(() => {
    if (!open) {
      ownsPopoverRef.current = false;
      return;
    }

    if (
      ownsPopoverRef.current &&
      linkRef.current &&
      anchorRef.current !== linkRef.current
    ) {
      setAnchor(linkRef.current);
    }
  }, [anchorRef, handle, hasEvents, open, setAnchor]);

  const openFromLink = () => {
    ownsPopoverRef.current = true;
    setAnchor(linkRef.current);
    openPopover();
  };

  const linkClass =
    "font-medium text-accent-600/95 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500/40";

  return (
    <div className="mt-1 space-y-0.5">
      <p className="text-sm text-slate-700">{lineOne}</p>
      {!hasEvents && !handle ? (
        <p className="text-[13px] leading-5 text-slate-500">
          <button
            ref={linkRef}
            type="button"
            data-handle-popover-placement="bottom-start"
            aria-haspopup="dialog"
            aria-expanded={isActiveTrigger}
            onClick={openFromLink}
            className={linkClass}
          >
            Set a handle
          </button>{" "}
          to keep your receipts together.
        </p>
      ) : null}
      {!hasEvents && handle ? (
        <p className="text-[13px] leading-5 text-slate-500">
          Signed as{" "}
          <button
            ref={linkRef}
            type="button"
            data-handle-popover-placement="bottom-start"
            aria-haspopup="dialog"
            aria-expanded={isActiveTrigger}
            onClick={openFromLink}
            className={linkClass}
          >
            @{handle}
          </button>
          .
        </p>
      ) : null}
      {hasEvents && !handle ? (
        <p className="text-[13px] leading-5 text-slate-500">
          Signed as anonymous.{" "}
          <button
            ref={linkRef}
            type="button"
            data-handle-popover-placement="bottom-start"
            aria-haspopup="dialog"
            aria-expanded={isActiveTrigger}
            onClick={openFromLink}
            className={linkClass}
          >
            Set a handle
          </button>
          .
        </p>
      ) : null}
      {hasEvents && handle ? (
        <p className="text-[13px] leading-5 text-slate-500">
          Signed as{" "}
          <button
            ref={linkRef}
            type="button"
            data-handle-popover-placement="bottom-start"
            aria-haspopup="dialog"
            aria-expanded={isActiveTrigger}
            onClick={openFromLink}
            className={linkClass}
          >
            @{handle}
          </button>
          .
        </p>
      ) : null}
    </div>
  );
}

export function EditorShell() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [code, setCode] = useState(STARTER_CODE);
  const [hasBufferedEvent, setHasBufferedEvent] = useState(false);
  const [handle, setHandleState] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<ProcessEvent[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncedCount, setSyncedCount] = useState(0);
  const [isMinting, setIsMinting] = useState(false);
  const [runs, setRuns] = useState<ConsoleRun[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isLoadingRuntime, setIsLoadingRuntime] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const bufferRef = useRef<ProcessEvent[]>([]);
  const allEventsRef = useRef<ProcessEvent[]>([]);
  const lastEditAtRef = useRef(Date.now());
  const focusedRef = useRef(false);
  const pendingPasteRef = useRef(false);
  const contentRef = useRef(STARTER_CODE);
  const charBurstsRef = useRef<{ at: number; chars: number }[]>([]);
  // Edits that fired before sessionId resolved (cold-start race). We hold them
  // here without a sessionId and stamp+flush them in order once the session
  // exists, so the replay timeline never silently drops the first keystrokes.
  const pendingEditsRef = useRef<
    Array<Omit<Extract<ProcessEvent, { kind: "edit" }>, "sessionId" | "eventId">>
  >([]);
  // True once we've recorded the baseline edit that captures the starter code
  // (or whatever the user has typed before the session resolved). Replay file
  // reconstruction walks edits with absolute offsets onto an empty buffer, so
  // it needs this baseline edit at seq 1 or it produces garbage.
  const baselineRecordedRef = useRef(false);

  const recordEvent = useCallback((event: ProcessEvent) => {
    bufferRef.current.push(event);
    allEventsRef.current.push(event);
    setPendingCount(bufferRef.current.length);
    setAllEvents((events) => [...events, event]);
    setHasBufferedEvent(true);
  }, []);

  useEffect(() => {
    const sync = () => setHandleState(getHandle());

    sync();
    const unsubscribe = subscribeToHandle(setHandleState);
    window.addEventListener("receipts:handle-changed", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      unsubscribe();
      window.removeEventListener("receipts:handle-changed", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startSession() {
      const response = await fetch("/api/sessions", { method: "POST" });
      const data = (await response.json()) as { session: { id: string } };

      if (cancelled) return;

      const newSessionId = data.session.id;

      // Baseline edit: insert STARTER_CODE at offset 0. Without this, replay
      // reconstructs from an empty buffer and every later edit (which carries
      // an absolute Monaco offset) lands in the wrong place. STARTER_CODE is
      // the editor's mount-time content, so any pending pre-session edits
      // below replay correctly on top of this baseline.
      //
      // Stamp the baseline at the earliest known timestamp — either the first
      // pending edit (which fired before this fetch resolved) or now. Using
      // nowIso() unconditionally would put baseline.at AFTER every pending
      // edit's at, and buildReplayIndex's `Math.max(0, at - firstAt)` would
      // then clamp every pre-session edit to offset 0 on the timeline.
      if (!baselineRecordedRef.current) {
        baselineRecordedRef.current = true;
        const baselineAt = pendingEditsRef.current[0]?.at ?? nowIso();
        recordEvent({
          kind: "edit",
          eventId: createId("edit"),
          sessionId: newSessionId,
          at: baselineAt,
          file: FILE_NAME,
          rangeStart: 0,
          rangeEnd: 0,
          textInserted: STARTER_CODE,
          textRemoved: "",
        });
      }

      // Drain any edits that the user typed between editor-mount and
      // session-resolve. They were captured into pendingEditsRef without a
      // sessionId; stamp and flush them in order so the chain stays
      // chronological.
      for (const pending of pendingEditsRef.current) {
        recordEvent({
          ...pending,
          eventId: createId("edit"),
          sessionId: newSessionId,
        });
      }
      pendingEditsRef.current = [];

      setSessionId(newSessionId);
    }

    void startSession();
    return () => {
      cancelled = true;
    };
  }, [recordEvent]);

  useEffect(() => {
    if (!sessionId) return;

    const interval = window.setInterval(() => {
      const events = bufferRef.current;
      if (events.length === 0) return;

      bufferRef.current = [];
      setPendingCount(0);

      void fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, events }),
      }).then((response) => {
        if (response.ok) {
          setSyncedCount((current) => {
            const next = current + events.length;
            return next;
          });
        }
      });
    }, 3000);

    return () => window.clearInterval(interval);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const interval = window.setInterval(() => {
      if (!focusedRef.current) return;
      const idleMs = Date.now() - lastEditAtRef.current;

      if (idleMs >= 8000) {
        recordEvent({
          kind: "idle",
          eventId: createId("idle"),
          sessionId,
          at: nowIso(),
          file: FILE_NAME,
          idleMs,
        });
        lastEditAtRef.current = Date.now();
      }
    }, 1000);

    return () => window.clearInterval(interval);
  }, [recordEvent, sessionId]);

  useEffect(() => {
    if (!sessionId) return;

    const interval = window.setInterval(() => {
      void sha256Content(contentRef.current).then((contentHash) => {
        recordEvent({
          kind: "snapshot",
          eventId: createId("snapshot"),
          sessionId,
          at: nowIso(),
          file: FILE_NAME,
          contentHash,
        });
      });
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [recordEvent, sessionId]);

  const handleChange: OnChange = (value, changeEvent) => {
    const nextValue = value ?? "";
    const session = sessionId;
    contentRef.current = nextValue;
    setCode(nextValue);

    for (const change of changeEvent.changes) {
      const wasPaste = pendingPasteRef.current;
      const insertedLength = change.text.length;
      lastEditAtRef.current = Date.now();
      charBurstsRef.current.push({ at: Date.now(), chars: insertedLength });
      pendingPasteRef.current = false;

      // Pre-session keystrokes get parked in pendingEditsRef and replayed
      // once startSession() resolves. Paste classification is dropped during
      // this window: we still record the edit but don't emit a paste event
      // since there's no session to attribute it to.
      if (!session) {
        pendingEditsRef.current.push({
          kind: "edit",
          at: nowIso(),
          file: FILE_NAME,
          rangeStart: change.rangeOffset,
          rangeEnd: change.rangeOffset + change.rangeLength,
          textInserted: change.text,
          textRemoved: "",
        });
        continue;
      }

      recordEvent({
        kind: "edit",
        eventId: createId("edit"),
        sessionId: session,
        at: nowIso(),
        file: FILE_NAME,
        rangeStart: change.rangeOffset,
        rangeEnd: change.rangeOffset + change.rangeLength,
        textInserted: change.text,
        textRemoved: "",
      });

      if (wasPaste) {
        recordEvent({
          kind: "paste",
          eventId: createId("paste"),
          sessionId: session,
          at: nowIso(),
          file: FILE_NAME,
          length: insertedLength,
          source: "external", // TODO(analyzer): classify internal editor-origin pastes.
        });
      }
    }
  };

  const handleMount: OnMount = (mountedEditor) => {
    editorRef.current = mountedEditor;
    mountedEditor.onDidPaste(() => {
      pendingPasteRef.current = true;
    });
    mountedEditor.onDidFocusEditorText(() => {
      focusedRef.current = true;
      if (!sessionId) return;
      recordEvent({
        kind: "focus",
        eventId: createId("focus"),
        sessionId,
        at: nowIso(),
        file: FILE_NAME,
        gained: true,
      });
    });
    mountedEditor.onDidBlurEditorText(() => {
      focusedRef.current = false;
      if (!sessionId) return;
      recordEvent({
        kind: "focus",
        eventId: createId("focus"),
        sessionId,
        at: nowIso(),
        file: FILE_NAME,
        gained: false,
      });
    });
  };

  const runCode = async () => {
    if (!sessionId || isRunning) return;

    const source = editorRef.current?.getValue() ?? contentRef.current;
    setIsRunning(true);

    try {
      if (!isPythonRuntimeReady()) {
        setIsLoadingRuntime(true);
        await ensurePythonRuntime();
        setIsLoadingRuntime(false);
      }

      const result = await runPython(source);
      const run: ConsoleRun = {
        id: crypto.randomUUID(),
        at: nowIso(),
        source,
        result,
      };

      setRuns((currentRuns) => [...currentRuns, run]);
      recordEvent({
        kind: "run",
        eventId: createId("run"),
        sessionId,
        at: run.at,
        command: "python",
        exitCode: result.exitCode,
        stdoutPreview: result.stdout.slice(0, 500),
        stderrPreview: result.stderr.slice(0, 500),
        durationMs: result.durationMs,
      });
    } catch (error) {
      const result: RunResult = {
        stdout: "",
        stderr: error instanceof Error ? error.message : "Unable to run Python",
        exitCode: 1,
        durationMs: 0,
        truncated: false,
      };
      const run: ConsoleRun = {
        id: crypto.randomUUID(),
        at: nowIso(),
        source,
        result,
      };
      setRuns((currentRuns) => [...currentRuns, run]);
      recordEvent({
        kind: "run",
        eventId: createId("run"),
        sessionId,
        at: run.at,
        command: "python",
        exitCode: 1,
        stdoutPreview: "",
        stderrPreview: result.stderr.slice(0, 500),
        durationMs: 0,
      });
    } finally {
      setIsLoadingRuntime(false);
      setIsRunning(false);
    }
  };

  const flushNow = useCallback(async () => {
    if (!sessionId || bufferRef.current.length === 0) return;
    const events = bufferRef.current;
    bufferRef.current = [];
    setPendingCount(0);
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, events }),
    });
    setSyncedCount((current) => {
      const next = current + events.length;
      return next;
    });
  }, [sessionId]);

  const mintReceipt = async () => {
    if (!sessionId) return;
    setIsMinting(true);
    await flushNow();
    const receiptHandle = handle ?? "anonymous";
    // Send the full event list with the mint request. The server is the
    // canonical chain builder; sending events here means mint never depends
    // on the in-memory session store, which is invisible across serverless
    // function instances on Vercel.
    const response = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        handle: receiptHandle,
        events: allEventsRef.current,
      }),
    });
    const data = (await response.json()) as { receipt: { id: string } };
    router.push(`/r/${data.receipt.id}`);
  };

  const charsPerSecond = (() => {
    const now = Date.now();
    const buckets = Array.from({ length: 20 }, () => 0);
    for (const burst of charBurstsRef.current.filter(
      (item) => now - item.at <= 60_000,
    )) {
      const bucket = Math.min(19, Math.floor((now - burst.at) / 3000));
      buckets[19 - bucket] += burst.chars / 3;
    }
    return buckets;
  })();

  const externalPastes = allEvents.filter(
    (event) => event.kind === "paste" && event.source === "external",
  ).length;
  const longestIdleMs = Math.max(
    0,
    ...allEvents
      .filter((event) => event.kind === "idle")
      .map((event) => event.idleMs),
  );

  return (
    <div className="grid min-h-[calc(100vh-65px)] grid-cols-1 bg-slate-50 lg:grid-cols-[1fr_320px]">
      <main className="flex min-w-0 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
              Receipts editor
            </p>
            <CaptureStatusLine hasEvents={hasBufferedEvent} handle={handle} />
          </div>
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={runCode}
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400"
            >
              <Play className="h-4 w-4" />
              Run
            </button>
            <div className="flex flex-col items-end">
              <button
                type="button"
                onClick={mintReceipt}
                disabled={!sessionId || isMinting}
                className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700 disabled:opacity-50 ${
                  handle ? "bg-accent-600" : "bg-accent-600/80"
                }`}
              >
                <ReceiptText className="h-4 w-4" />
                {isMinting
                  ? "Minting..."
                  : handle
                    ? "Mint Receipt"
                    : "Mint as anonymous"}
              </button>
              {!handle ? (
                <p className="mt-1.5 text-right text-xs text-slate-500">
                  Anonymous receipts are public but not linked to you.
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div
          className="flex min-h-0 flex-1 flex-col"
          onPasteCapture={() => {
            pendingPasteRef.current = true;
          }}
        >
          <div className="min-h-[360px] flex-1">
            <Editor
              height="100%"
              defaultLanguage="python"
              theme="vs"
              value={code}
              onChange={handleChange}
              onMount={handleMount}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                padding: { top: 18 },
                scrollBeyondLastLine: false,
                wordWrap: "on",
              }}
            />
          </div>
          <ConsolePanel
            runs={runs}
            isRunning={isRunning}
            isLoadingRuntime={isLoadingRuntime}
            onClear={() => setRuns([])}
          />
        </div>
      </main>
      <LiveSignalsPanel
        charsPerSecond={charsPerSecond}
        externalPastes={externalPastes}
        longestIdleMs={longestIdleMs}
        pendingEvents={pendingCount}
        captureState={hasBufferedEvent ? "running" : "ready"}
      />
    </div>
  );
}
