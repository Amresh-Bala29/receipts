"use client";

import { useEffect, useRef, useState } from "react";
import type { RunResult } from "@/lib/runner/pyodide";

export type ConsoleRun = {
  id: string;
  at: string;
  source: string;
  result: RunResult;
};

type Props = {
  runs: ConsoleRun[];
  isRunning: boolean;
  isLoadingRuntime: boolean;
  onClear: () => void;
};

function relativeTime(at: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(at)) / 1000));
  if (seconds < 2) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

function summarizeSource(source: string): string {
  const firstLine = source.trim().split("\n").find(Boolean);
  if (!firstLine) return "empty file";
  return firstLine.length > 48 ? `${firstLine.slice(0, 48)}...` : firstLine;
}

export function ConsolePanel({
  runs,
  isRunning,
  isLoadingRuntime,
  onClear,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wasNearBottomRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const updateNearBottom = () => {
    const element = scrollRef.current;
    if (!element) return;
    const distanceFromBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight;
    const nearBottom = distanceFromBottom <= 40;
    wasNearBottomRef.current = nearBottom;
    if (nearBottom) {
      setShowJump(false);
    }
  };

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    if (wasNearBottomRef.current) {
      element.scrollTop = element.scrollHeight;
      setShowJump(false);
    } else if (runs.length > 0) {
      setShowJump(true);
    }
  }, [runs.length, isLoadingRuntime]);

  const jumpToLatest = () => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
    wasNearBottomRef.current = true;
    setShowJump(false);
  };

  const statusClass = isLoadingRuntime
    ? "bg-slate-300"
    : isRunning
      ? "animate-pulse bg-accent-600"
      : "bg-accent-600";

  return (
    <section className="h-60 border-t border-slate-200 bg-white">
      <div className="flex h-11 items-center justify-between border-b border-slate-200 px-5">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
          Console
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClear}
            className="text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
          <span
            className={`h-2 w-2 rounded-full ${statusClass}`}
            aria-label={
              isLoadingRuntime
                ? "Python runtime loading"
                : isRunning
                  ? "Python running"
                  : "Python idle"
            }
          />
        </div>
      </div>
      <div className="relative h-[calc(100%-2.75rem)]">
        <div
          ref={scrollRef}
          onScroll={updateNearBottom}
          className="h-full max-h-[220px] overflow-y-auto px-5 py-4"
        >
          {runs.length === 0 && !isLoadingRuntime ? (
            <p className="text-sm text-slate-500">
              Run your code to see output here.
            </p>
          ) : null}
          {isLoadingRuntime ? (
            <p className="text-sm text-slate-500">Loading Python runtime…</p>
          ) : null}
          <div className="space-y-5">
            {runs.map((run, index) => {
              const { result } = run;
              const isError = result.exitCode === 1;
              const hasOutput = result.stdout.length > 0;
              const hasError = result.stderr.length > 0;

              return (
                <article key={run.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {isError ? (
                      <>
                        <span className="h-2 w-2 rounded-full bg-gradient-to-r from-accent-600 to-[#B45309]" />
                        <span className="font-medium text-[#B45309]">Error</span>
                      </>
                    ) : null}
                    <span>
                      Run {index + 1} · {relativeTime(run.at)} ·{" "}
                      {result.durationMs}ms
                    </span>
                    <span className="truncate text-slate-400">
                      {summarizeSource(run.source)}
                    </span>
                  </div>
                  {!hasOutput && !hasError && result.exitCode === 0 ? (
                    <p className="mt-2 font-mono text-sm text-slate-500">
                      (no output)
                    </p>
                  ) : null}
                  {hasOutput ? (
                    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-sm leading-6 text-slate-950">
                      {result.stdout}
                    </pre>
                  ) : null}
                  {hasError ? (
                    <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-sm leading-6 text-[#B45309]">
                      {result.stderr}
                    </pre>
                  ) : null}
                  {result.truncated ? (
                    <p className="mt-2 text-xs text-slate-500">
                      Output truncated at 8000 chars.
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
        {showJump ? (
          <button
            type="button"
            onClick={jumpToLatest}
            className="absolute bottom-3 right-5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-soft hover:text-slate-950"
          >
            Jump to latest
          </button>
        ) : null}
      </div>
    </section>
  );
}
