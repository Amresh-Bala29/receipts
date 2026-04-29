"use client";

type LiveSignalsPanelProps = {
  charsPerSecond: number[];
  externalPastes: number;
  longestIdleMs: number;
  pendingEvents: number;
  captureState: "ready" | "running";
};

function formatIdle(ms: number): string {
  if (ms < 1000) return "0s";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function LiveSignalsPanel({
  charsPerSecond,
  externalPastes,
  longestIdleMs,
  pendingEvents,
  captureState,
}: LiveSignalsPanelProps) {
  const max = Math.max(1, ...charsPerSecond);

  return (
    <aside className="flex h-full flex-col gap-4 border-l border-slate-200 bg-white p-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          Live signals
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">
          Capture is {captureState}.
        </h2>
      </div>

      <div className="rounded-md border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">
            Typing rhythm
          </span>
          <span className="text-xs text-slate-500">last 60s</span>
        </div>
        <div className="mt-4 flex h-16 items-end gap-1">
          {charsPerSecond.map((value, index) => (
            <span
              key={index}
              className="w-full rounded-sm bg-accent-500/70"
              style={{ height: `${Math.max(8, (value / max) * 64)}px` }}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <div className="rounded-md border border-slate-200 p-4">
          <p className="text-sm text-slate-500">External paste count</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {externalPastes}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Longest idle so far</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {formatIdle(longestIdleMs)}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 p-4">
          <p className="text-sm text-slate-500">Waiting to sync</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950">
            {pendingEvents}
          </p>
        </div>
      </div>
    </aside>
  );
}
