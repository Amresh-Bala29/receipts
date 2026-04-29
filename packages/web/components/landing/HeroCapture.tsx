"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { mulberry32 } from "@/lib/prng";

const TARGET_CODE =
  "def total_score(values):\n    return sum(values)\n\nprint(total_score([7, 8, 9]))";
const MAX_BARS = 80;

type Action =
  | { type: "type"; char: string; delay: number }
  | { type: "backspace"; delay: number }
  | { type: "pause"; delay: number };

function formatTimer(seconds: number): string {
  const normalized = seconds % 120;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
    normalized % 60,
  ).padStart(2, "0")}`;
}

function buildActions(): Action[] {
  const random = mulberry32(7321);
  const actions: Action[] = [];

  TARGET_CODE.split("").forEach((char, index) => {
    if (index === 21) {
      actions.push({ type: "type", char: "s", delay: 78 });
      actions.push({ type: "type", char: "s", delay: 64 });
      actions.push({ type: "pause", delay: 420 });
      actions.push({ type: "backspace", delay: 80 });
      actions.push({ type: "backspace", delay: 74 });
    }

    const delay = 30 + Math.round(random() * 80);
    actions.push({ type: "type", char, delay });

    if (index === 23 || index === 44 || index === 63) {
      actions.push({ type: "pause", delay: 400 + Math.round(random() * 220) });
    }
  });

  actions.push({ type: "pause", delay: 1500 });
  return actions;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return reduced;
}

function pushBar(bars: number[], delay: number, thinking = false): number[] {
  const cps = thinking ? 1 : 1000 / Math.max(delay, 1);
  const height = thinking ? 6 : Math.min(32, Math.max(5, cps * 2.1));
  return [...bars, height].slice(-MAX_BARS);
}

export function HeroCapture() {
  const reducedMotion = useReducedMotion();
  const actions = useMemo(buildActions, []);
  const [code, setCode] = useState("");
  const [bars, setBars] = useState<number[]>([]);
  const [seconds, setSeconds] = useState(42);
  const [events, setEvents] = useState(142);
  const actionIndexRef = useRef(0);
  const nextActionAtRef = useRef(0);
  const lastFrameAtRef = useRef<number | null>(null);
  const timerAccumulatorRef = useRef(0);
  const snapshotAccumulatorRef = useRef(0);
  const codeRef = useRef("");

  useEffect(() => {
    if (reducedMotion) {
      setCode(TARGET_CODE);
      setBars(Array.from({ length: 80 }, () => 8));
      setSeconds(42);
      setEvents(142);
      return;
    }

    let frame = 0;
    let stopped = false;

    function tick(now: number) {
      if (stopped) return;

      if (document.visibilityState !== "visible") {
        lastFrameAtRef.current = null;
        frame = window.requestAnimationFrame(tick);
        return;
      }

      const previous = lastFrameAtRef.current ?? now;
      const delta = now - previous;
      lastFrameAtRef.current = now;
      timerAccumulatorRef.current += delta;
      snapshotAccumulatorRef.current += delta;
      nextActionAtRef.current -= delta;

      if (timerAccumulatorRef.current >= 1000) {
        timerAccumulatorRef.current -= 1000;
        setSeconds((value) => (value + 1) % 120);
      }

      if (snapshotAccumulatorRef.current >= 5000) {
        snapshotAccumulatorRef.current -= 5000;
        setEvents((value) => value + 1);
      }

      while (nextActionAtRef.current <= 0) {
        const action = actions[actionIndexRef.current];

        if (!action) {
          actionIndexRef.current = 0;
          codeRef.current = "";
          setCode("");
          nextActionAtRef.current = 0;
          break;
        }

        actionIndexRef.current += 1;
        nextActionAtRef.current += action.delay;

        if (action.type === "type") {
          codeRef.current += action.char;
          setCode(codeRef.current);
          setBars((current) => pushBar(current, action.delay));
          setEvents((value) => value + 1);
        } else if (action.type === "backspace") {
          codeRef.current = codeRef.current.slice(0, -1);
          setCode(codeRef.current);
          setBars((current) => pushBar(current, action.delay));
          setEvents((value) => value + 1);
        } else if (action.delay > 250) {
          setBars((current) => pushBar(current, action.delay, true));
        }
      }

      frame = window.requestAnimationFrame(tick);
    }

    frame = window.requestAnimationFrame(tick);
    return () => {
      stopped = true;
      window.cancelAnimationFrame(frame);
    };
  }, [actions, reducedMotion]);

  const lines = code.split("\n");
  const displayLines = lines.length > 1 || lines[0] ? lines : [""];
  const visibleBars = bars.length ? bars : Array.from({ length: 80 }, () => 0);

  return (
    <div
      aria-label="Live capture demo"
      className="capture-card rounded-[12px] border border-refined-200 bg-white p-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="capture-dot h-2 w-2 rounded-full bg-accent-600" />
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-refined-950">
            Capturing
          </span>
        </div>
        <span className="font-mono text-xs tabular-nums text-refined-500">
          {formatTimer(seconds)}
        </span>
      </div>

      <div className="mt-6 min-h-[144px] font-mono text-[13px] leading-[1.7] text-refined-950">
        {displayLines.map((line, index) => (
          <div key={index} className="grid grid-cols-[24px_1fr] gap-3">
            <span className="select-none text-right tabular-nums text-refined-400">
              {index + 1}
            </span>
            <span className="whitespace-pre">
              {line}
              {index === displayLines.length - 1 && !reducedMotion ? (
                <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 bg-refined-950" />
              ) : null}
            </span>
          </div>
        ))}
      </div>

      <div className="my-4 h-px bg-refined-100" />

      <svg
        aria-hidden="true"
        className="h-8 w-full max-w-[240px]"
        viewBox="0 0 240 32"
      >
        {visibleBars.map((height, index) => {
          const x = index * 3;
          const opacity = 0.18 + (index / Math.max(visibleBars.length, 1)) * 0.67;
          return (
            <rect
              key={`${index}-${height}`}
              x={x}
              y={32 - height}
              width="2"
              height={height}
              rx="1"
              fill="#0d9488"
              opacity={opacity}
            />
          );
        })}
      </svg>

      <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-xs tabular-nums text-refined-500">
        <span>events {events}</span>
        <span>·</span>
        <span>pastes 0</span>
        <span>·</span>
        <span className="inline-flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-600" />
          chain ok
        </span>
      </div>
    </div>
  );
}
