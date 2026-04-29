"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { Pause, Play } from "lucide-react";
import {
  type ChangeEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { editor } from "monaco-editor";
import {
  buildReplayIndex,
  reconstructFileState,
  type ChainedEvent,
  type ReplayAnnotation,
} from "@receipts/shared";
import { formatDuration } from "@/lib/format/duration";

type Props = {
  receiptId: string;
  events: ChainedEvent[];
  durationMs: number;
  authorHandle: string;
  totalEvents: number;
  editEvents: number;
  runEvents: number;
  chainOk: boolean;
  brokenAtSeq?: number;
};

type Bucket = {
  index: number;
  startMs: number;
  endMs: number;
  editSeqs: number[];
  eventCount: number;
  annotations: ReplayAnnotation[];
};

const bucketCount = 48;
const amber = "#B45309";
const accent = "#14b8a6";

function formatOffset(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function lineForOffset(content: string, offset: number): number {
  return content.slice(0, Math.max(0, offset)).split("\n").length;
}

function languageForFile(file: string | null): string {
  if (!file) return "plaintext";
  if (file.endsWith(".py")) return "python";
  if (file.endsWith(".ts") || file.endsWith(".tsx")) return "typescript";
  if (file.endsWith(".js") || file.endsWith(".jsx")) return "javascript";
  if (file.endsWith(".md")) return "markdown";
  return "plaintext";
}

function nearestEditSeq(editSeqs: number[], value: number): number {
  if (editSeqs.length === 0) return 0;

  let best = editSeqs[0] ?? 0;
  let bestDistance = Math.abs(best - value);

  for (const seq of editSeqs) {
    const distance = Math.abs(seq - value);
    if (distance < bestDistance) {
      best = seq;
      bestDistance = distance;
    }
  }

  return best;
}

function findSeqAtOffset(
  editSeqs: number[],
  seqToOffsetMs: number[],
  targetMs: number,
): number {
  if (editSeqs.length === 0) return 0;

  let low = 0;
  let high = editSeqs.length - 1;
  let answer = editSeqs[0] ?? 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const seq = editSeqs[mid] ?? 0;
    const offset = seqToOffsetMs[seq] ?? 0;

    if (offset <= targetMs) {
      answer = seq;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return answer;
}

function eventDescription(
  event: ChainedEvent | undefined,
  state: Map<string, string>,
  context: {
    authorHandle: string;
    durationLabel: string;
    totalEvents: number;
    chainOk: boolean;
    brokenAtSeq?: number;
    isStart: boolean;
    isComplete: boolean;
  },
): string {
  if (context.isComplete) {
    return context.chainOk
      ? `Session complete. ${context.totalEvents} events captured, chain verified.`
      : `Session complete. ${context.totalEvents} events captured, chain failed at seq ${context.brokenAtSeq ?? "unknown"}.`;
  }

  if (context.isStart) {
    if (context.authorHandle === "anonymous") {
      return `An anonymous session of ${context.durationLabel}. Drag to scrub or press play.`;
    }

    // TODO: unify handle prefix conventions across receipt surfaces.
    return `${context.authorHandle} built this over ${context.durationLabel}. Drag to scrub or press play.`;
  }

  if (!event) return `Drag to scrub or press play.`;

  if (event.kind === "edit") {
    const content = state.get(event.file) ?? "";
    return `Editing line ${lineForOffset(content, event.rangeStart)}`;
  }

  if (event.kind === "paste") {
    return `Paste captured (${event.length} chars, ${event.source})`;
  }

  if (event.kind === "run") {
    return `Run ${event.exitCode === 0 ? "succeeded" : "failed"}`;
  }

  if (event.kind === "idle") {
    return `Quiet thinking, ${formatDuration(event.idleMs)}`;
  }

  if (event.kind === "snapshot") {
    return `Snapshot at ${event.file}`;
  }

  return "Focus changed";
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function normalizeHandle(handle: string): string {
  return handle.startsWith("@") ? handle.slice(1) : handle;
}

export function ReplayPlayer({
  receiptId,
  events,
  durationMs,
  authorHandle,
  totalEvents,
  editEvents,
  runEvents,
  chainOk,
  brokenAtSeq,
}: Props) {
  const orderedEvents = useMemo(
    () => [...events].sort((left, right) => left.seq - right.seq),
    [events],
  );
  const eventBySeq = useMemo(() => {
    const map = new Map<number, ChainedEvent>();
    for (const event of orderedEvents) {
      map.set(event.seq, event);
    }
    return map;
  }, [orderedEvents]);
  const index = useMemo(() => buildReplayIndex(orderedEvents), [orderedEvents]);
  const lastEditSeq = index.editSeqs.at(-1) ?? 0;
  const [currentSeq, setCurrentSeq] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [hoveredBucket, setHoveredBucket] = useState<Bucket | null>(null);
  const [flaggedSeq, setFlaggedSeq] = useState<number | null>(null);
  const [showFlagTooltip, setShowFlagTooltip] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showInitialOverlay, setShowInitialOverlay] = useState(true);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestCurrentSeqRef = useRef(0);
  const speedRef = useRef<1 | 2 | 4>(1);
  const editSeqsRef = useRef<number[]>([]);
  const seqToOffsetMsRef = useRef<number[]>([]);
  const lastEditSeqRef = useRef(0);
  const wallStartMsRef = useRef(0);
  const seqStartOffsetMsRef = useRef(0);
  const pausedDueToHiddenRef = useRef(false);
  const chartRef = useRef<HTMLDivElement | null>(null);
  const frameHoverRef = useRef<number | null>(null);
  const flagTooltipTimerRef = useRef<number | null>(null);

  const state = useMemo(
    () => reconstructFileState(orderedEvents, currentSeq),
    [currentSeq, orderedEvents],
  );

  const filesByEditCount = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of orderedEvents) {
      if (event.kind === "edit") {
        counts.set(event.file, (counts.get(event.file) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .map(([file]) => file);
  }, [orderedEvents]);

  const selectedFile = activeFile ?? filesByEditCount[0] ?? null;
  const selectedContent = selectedFile ? state.get(selectedFile) ?? "" : "";
  const currentOffsetMs = index.seqToOffsetMs[currentSeq] ?? 0;
  const totalDurationMs = durationMs || index.totalDurationMs;
  const currentEvent = eventBySeq.get(currentSeq);
  const firstEditSeq = index.editSeqs[0] ?? 0;
  // "Start" means *before* the first edit has applied. Using <= here would
  // collapse start and complete on receipts where firstEditSeq === lastEditSeq
  // (e.g. a single-edit baseline-only mint), pinning the overlay open and
  // making the slider feel broken because the user can't see the editor pane
  // change underneath.
  const isStartPosition = currentSeq < firstEditSeq;
  const isCompletePosition = currentSeq === lastEditSeq && !isPlaying && lastEditSeq > 0;
  const durationLabel = formatDuration(totalDurationMs);
  const displayHandle = normalizeHandle(authorHandle);
  const metadataDescription = eventDescription(currentEvent, state, {
    authorHandle: displayHandle,
    durationLabel,
    totalEvents,
    chainOk,
    brokenAtSeq,
    isStart: isStartPosition,
    isComplete: isCompletePosition,
  });
  const overlayTitle =
    displayHandle === "anonymous"
      ? "Press play to watch this anonymous session unfold."
      : `Press play to watch ${displayHandle} write this code.`;

  const buckets = useMemo<Bucket[]>(() => {
    const safeDuration = Math.max(1, totalDurationMs);
    const next = Array.from({ length: bucketCount }, (_, bucketIndex) => {
      const startMs = (bucketIndex / bucketCount) * safeDuration;
      const endMs = ((bucketIndex + 1) / bucketCount) * safeDuration;
      return {
        index: bucketIndex,
        startMs,
        endMs,
        editSeqs: [] as number[],
        eventCount: 0,
        annotations: [] as ReplayAnnotation[],
      };
    });

    for (const event of orderedEvents) {
      const offset = index.seqToOffsetMs[event.seq] ?? 0;
      const bucketIndex = Math.min(
        next.length - 1,
        Math.max(0, Math.floor((offset / safeDuration) * next.length)),
      );
      next[bucketIndex]!.eventCount += 1;
      if (event.kind === "edit") {
        next[bucketIndex]!.editSeqs.push(event.seq);
      }
    }

    for (const annotation of index.annotations) {
      const bucketIndex = Math.min(
        next.length - 1,
        Math.max(
          0,
          Math.floor((annotation.offsetMs / safeDuration) * next.length),
        ),
      );
      next[bucketIndex]!.annotations.push(annotation);
    }

    return next;
  }, [index.annotations, index.seqToOffsetMs, orderedEvents, totalDurationMs]);

  const maxEvents = Math.max(1, ...buckets.map((bucket) => bucket.eventCount));
  const flaggedBucketIndex = useMemo(() => {
    if (flaggedSeq === null) return null;
    const safeDuration = Math.max(1, totalDurationMs);
    const offset = index.seqToOffsetMs[flaggedSeq] ?? 0;
    return Math.min(
      buckets.length - 1,
      Math.max(0, Math.floor((offset / safeDuration) * buckets.length)),
    );
  }, [buckets.length, flaggedSeq, index.seqToOffsetMs, totalDurationMs]);
  const flaggedBucket =
    flaggedBucketIndex === null ? null : buckets[flaggedBucketIndex] ?? null;

  const revealRecentEdit = useCallback(
    (seq: number, content: string) => {
      const editorInstance = editorRef.current;
      if (!editorInstance) return;

      const recentEdit = [...orderedEvents]
        .reverse()
        .find((event) => event.kind === "edit" && event.seq <= seq);

      if (!recentEdit || recentEdit.kind !== "edit") return;

      const line = lineForOffset(content, recentEdit.rangeStart);
      if (reducedMotion) {
        editorInstance.revealLineInCenter(line);
      } else {
        editorInstance.revealLineInCenterIfOutsideViewport(line);
      }
    },
    [orderedEvents, reducedMotion],
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const onChainFlagged = (event: Event) => {
      const detail = (event as CustomEvent<{
        receiptId: string;
        brokenAtSeq: number;
      }>).detail;
      if (detail.receiptId !== receiptId) return;
      setFlaggedSeq(detail.brokenAtSeq);
      setShowFlagTooltip(true);
      if (flagTooltipTimerRef.current !== null) {
        window.clearTimeout(flagTooltipTimerRef.current);
      }
      flagTooltipTimerRef.current = window.setTimeout(() => {
        setShowFlagTooltip(false);
        flagTooltipTimerRef.current = null;
      }, 8_000);
    };

    window.addEventListener("receipts:chain-flagged", onChainFlagged);
    return () => {
      window.removeEventListener("receipts:chain-flagged", onChainFlagged);
      if (flagTooltipTimerRef.current !== null) {
        window.clearTimeout(flagTooltipTimerRef.current);
      }
    };
  }, [receiptId]);

  useEffect(() => {
    const editorInstance = editorRef.current;
    if (!editorInstance) return;

    if (editorInstance.getValue() !== selectedContent) {
      editorInstance.setValue(selectedContent);
    }
    revealRecentEdit(currentSeq, selectedContent);
  }, [currentSeq, revealRecentEdit, selectedContent]);

  useEffect(() => {
    if (!editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    import("monaco-editor").then((monaco) => {
      monaco.editor.setModelLanguage(model, languageForFile(selectedFile));
    });
  }, [selectedFile]);

  useEffect(() => {
    if (showInitialOverlay && !isStartPosition) {
      setShowInitialOverlay(false);
    }
  }, [isStartPosition, showInitialOverlay]);

  const cancelPlaybackFrame = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const rebasePlaybackAnchors = useCallback(() => {
    wallStartMsRef.current = performance.now();
    seqStartOffsetMsRef.current =
      index.seqToOffsetMs[latestCurrentSeqRef.current] ?? 0;
  }, [index.seqToOffsetMs]);

  useEffect(() => {
    latestCurrentSeqRef.current = currentSeq;
  }, [currentSeq]);

  useEffect(() => {
    editSeqsRef.current = index.editSeqs;
    seqToOffsetMsRef.current = index.seqToOffsetMs;
    lastEditSeqRef.current = lastEditSeq;
  }, [index.editSeqs, index.seqToOffsetMs, lastEditSeq]);

  useEffect(() => {
    speedRef.current = speed;
    if (isPlaying) {
      rebasePlaybackAnchors();
    }
  }, [isPlaying, rebasePlaybackAnchors, speed]);

  const startPlaybackFrameLoop = useCallback(() => {
    cancelPlaybackFrame();
    const tick = () => {
      if (document.visibilityState === "hidden") {
        cancelPlaybackFrame();
        pausedDueToHiddenRef.current = true;
        return;
      }

      const elapsedReal =
        (performance.now() - wallStartMsRef.current) * speedRef.current;
      const targetOffsetMs = seqStartOffsetMsRef.current + elapsedReal;
      const nextSeq = findSeqAtOffset(
        editSeqsRef.current,
        seqToOffsetMsRef.current,
        targetOffsetMs,
      );

      if (nextSeq > latestCurrentSeqRef.current) {
        latestCurrentSeqRef.current = nextSeq;
        setCurrentSeq(nextSeq);
      }

      if (nextSeq >= lastEditSeqRef.current) {
        latestCurrentSeqRef.current = lastEditSeqRef.current;
        setCurrentSeq(lastEditSeqRef.current);
        setIsPlaying(false);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [cancelPlaybackFrame]);

  useEffect(() => {
    if (!isPlaying) {
      cancelPlaybackFrame();
      return;
    }

    if (prefersReducedMotion()) {
      latestCurrentSeqRef.current = lastEditSeqRef.current;
      setCurrentSeq(lastEditSeqRef.current);
      setIsPlaying(false);
      return;
    }

    pausedDueToHiddenRef.current = false;
    rebasePlaybackAnchors();
    startPlaybackFrameLoop();

    return () => {
      cancelPlaybackFrame();
    };
    // Playback must not restart on every currentSeq frame update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        if (isPlaying) {
          cancelPlaybackFrame();
          pausedDueToHiddenRef.current = true;
        }
      } else if (isPlaying && pausedDueToHiddenRef.current) {
        pausedDueToHiddenRef.current = false;
        rebasePlaybackAnchors();
        startPlaybackFrameLoop();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [cancelPlaybackFrame, isPlaying, rebasePlaybackAnchors, startPlaybackFrameLoop]);

  const handleEditorMount: OnMount = (editorInstance) => {
    editorRef.current = editorInstance;
    editorInstance.setValue(selectedContent);
  };

  const jumpToSeq = useCallback(
    (seq: number, snapToEdit = true) => {
      cancelPlaybackFrame();
      setShowFlagTooltip(false);
      setIsPlaying(false);
      const nextSeq = snapToEdit ? nearestEditSeq(index.editSeqs, seq) : seq;
      latestCurrentSeqRef.current = nextSeq;
      setCurrentSeq(nextSeq);
    },
    [cancelPlaybackFrame, index.editSeqs],
  );

  const handleSliderChange = (event: ChangeEvent<HTMLInputElement>) => {
    jumpToSeq(Number(event.target.value));
  };

  const handleBucketMove = (event: MouseEvent<HTMLDivElement>) => {
    if (frameHoverRef.current !== null) {
      cancelAnimationFrame(frameHoverRef.current);
    }

    frameHoverRef.current = requestAnimationFrame(() => {
      const rect = chartRef.current?.getBoundingClientRect();
      if (!rect) return;
      const ratio = Math.min(
        0.999,
        Math.max(0, (event.clientX - rect.left) / rect.width),
      );
      const bucketIndex = Math.floor(ratio * buckets.length);
      setHoveredBucket(buckets[bucketIndex] ?? null);
    });
  };

  const togglePlay = () => {
    if (lastEditSeq === 0) return;
    if (isPlaying) {
      cancelPlaybackFrame();
      setIsPlaying(false);
      return;
    }

    if (currentSeq >= lastEditSeq) {
      latestCurrentSeqRef.current = 0;
      setCurrentSeq(0);
    }
    setIsPlaying(true);
  };

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-950">Replay</h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-800 hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500/40"
            aria-label={isPlaying ? "Pause replay" : "Play replay"}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
            {[1, 2, 4].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSpeed(option as 1 | 2 | 4)}
                className={`border-b px-1 pb-0.5 transition-colors ${
                  speed === option
                    ? "border-slate-900 text-slate-950"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                {option}x
              </button>
            ))}
          </div>
          <span className="font-mono text-sm text-slate-600">
            {formatOffset(currentOffsetMs)} / {formatOffset(totalDurationMs)}
          </span>
        </div>
      </div>

      <div className="mt-5">
        <div
          ref={chartRef}
          className="relative flex h-20 items-end gap-1 rounded-md border border-slate-200 bg-slate-50 p-2 pt-5"
          onMouseMove={handleBucketMove}
          onMouseLeave={() => setHoveredBucket(null)}
          onClick={() => setShowFlagTooltip(false)}
        >
          {buckets.map((bucket) => {
            const dominantAnnotation = bucket.annotations[0];
            const isFlagged = flaggedBucketIndex === bucket.index;
            const tickColor =
              dominantAnnotation?.tone === "concern"
                ? amber
                : dominantAnnotation?.tone === "good"
                  ? accent
                  : "#A0A0A0";

            return (
              <button
                key={bucket.index}
                type="button"
                onClick={() => {
                  const targetSeq =
                    bucket.annotations[0]?.seq ?? bucket.editSeqs[0] ?? currentSeq;
                  jumpToSeq(targetSeq, bucket.annotations.length === 0);
                }}
                className="relative w-full rounded-sm bg-accent-500/60 hover:bg-accent-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500/40"
                style={{
                  height: `${Math.max(8, (bucket.eventCount / maxEvents) * 44)}px`,
                  outline: isFlagged ? `1px solid ${amber}` : undefined,
                  outlineOffset: isFlagged ? "1px" : undefined,
                  boxShadow: isFlagged
                    ? `0 0 0 1px rgba(180, 83, 9, 0.5)`
                    : undefined,
                }}
                aria-label={`Jump to ${formatOffset(bucket.startMs)}`}
              >
                {isFlagged ? (
                  <span
                    className="absolute -top-5 left-1/2 h-1 w-full max-w-4 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: amber }}
                  />
                ) : null}
                {dominantAnnotation ? (
                  <span
                    className="absolute -top-4 left-1/2 h-1 w-full max-w-3 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: tickColor }}
                  />
                ) : null}
              </button>
            );
          })}

          {showFlagTooltip && flaggedSeq !== null && flaggedBucket ? (
            <div
              className="pointer-events-none absolute z-20 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs leading-5 text-slate-700"
              style={{
                left: `calc(${((flaggedBucket.index + 0.5) / bucketCount) * 100}% - 5.75rem)`,
                bottom: "4.9rem",
              }}
            >
              Chain breaks here. Seq{" "}
              <span className="font-mono text-amber-700">{flaggedSeq}</span>.
            </div>
          ) : null}

          {hoveredBucket ? (
            <div
              className="pointer-events-none absolute z-10 max-w-52 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs leading-5 text-slate-700"
              style={{
                left: `calc(${((hoveredBucket.index + 0.5) / bucketCount) * 100}% - 5.5rem)`,
                bottom: "4.75rem",
              }}
            >
              <div className="font-mono text-[11px] text-slate-500">
                {formatOffset(hoveredBucket.startMs)}
              </div>
              {flaggedSeq !== null && flaggedBucketIndex === hoveredBucket.index ? (
                <div>
                  Chain breaks here. Seq{" "}
                  <span className="font-mono text-amber-700">{flaggedSeq}</span>.
                </div>
              ) : null}
              {hoveredBucket.annotations.length > 0 ? (
                hoveredBucket.annotations.map((annotation) => (
                  <div key={`${annotation.seq}-${annotation.label}`}>
                    {annotation.label}
                  </div>
                ))
              ) : (
                <div>{hoveredBucket.editSeqs.length} edits captured</div>
              )}
              <div className="mt-1 text-slate-500">Click to jump.</div>
            </div>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-3 rounded-full bg-accent-500" />
            Paste
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-3 rounded-full bg-slate-400" />
            Run
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-3 rounded-full bg-accent-500" />
            Quiet thinking
          </span>
        </div>

        <input
          className="mt-4 w-full accent-teal-600"
          type="range"
          min={0}
          max={lastEditSeq}
          value={Math.min(currentSeq, lastEditSeq)}
          onMouseDown={() => setIsPlaying(false)}
          onTouchStart={() => setIsPlaying(false)}
          onChange={handleSliderChange}
          aria-label="Scrub replay"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span className="font-mono text-slate-500">
          {formatOffset(currentOffsetMs)}
        </span>
        <span className="text-slate-300">·</span>
        <span>{metadataDescription}</span>
        {state.size > 1 ? (
          <>
            <span className="text-slate-300">·</span>
            <select
              value={selectedFile ?? ""}
              onChange={(event) => setActiveFile(event.target.value)}
              className="bg-transparent text-xs text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40"
            >
              {[...state.keys()].map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>

      <div className="relative mt-4 h-60 overflow-hidden rounded-md border border-slate-200 bg-white md:h-80">
        <Editor
          height="100%"
          language={languageForFile(selectedFile)}
          theme="vs"
          value={selectedContent}
          loading={
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Loading replay...
            </div>
          }
          options={{
            readOnly: true,
            domReadOnly: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
            lineNumbers: "on",
            folding: false,
            glyphMargin: false,
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            contextmenu: false,
            automaticLayout: true,
          }}
          onMount={handleEditorMount}
        />
        {showInitialOverlay && isStartPosition ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/85 px-6 text-center">
            <div>
              <p className="text-sm text-slate-500">{overlayTitle}</p>
              <p className="mt-1 text-[13px] text-slate-400">
                {editEvents} edits, {runEvents} runs, {durationLabel} total.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
