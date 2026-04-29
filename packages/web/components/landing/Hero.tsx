import Link from "next/link";
import type { CSSProperties } from "react";
import { HeroCapture } from "./HeroCapture";

const focusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(13,148,136,0.4)] focus-visible:ring-offset-2";

function BuiltWithCodexBadge() {
  return (
    <a
      href="https://openai.com/codex"
      target="_blank"
      rel="noopener noreferrer"
      className="landing-animate mb-6 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-[12px] font-medium text-gray-700 transition-colors duration-150 hover:border-gray-300 hover:bg-gray-50"
      style={{ animationDelay: "0ms", "--landing-offset": "6px" } as CSSProperties}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="codex-badge-ping absolute inline-flex h-full w-full rounded-full bg-teal-500 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-500" />
      </span>
      <span>Built with</span>
      <span className="font-semibold text-gray-900">Codex</span>
    </a>
  );
}

export function Hero() {
  return (
    <section className="mx-auto grid min-h-[calc(100vh-65px)] max-w-[1200px] items-center gap-14 px-8 py-[72px] lg:grid-cols-[minmax(0,0.6fr)_minmax(360px,0.4fr)] lg:px-20 lg:py-[120px]">
      <div>
        <BuiltWithCodexBadge />
        <p
          className="landing-animate text-xs font-medium uppercase tracking-[0.12em] text-refined-500"
          style={{ animationDelay: "60ms", "--landing-offset": "0px" } as CSSProperties}
        >
          PROCESS RECEIPTS FOR CODE
        </p>
        <h1
          className="landing-animate mt-6 max-w-[760px] font-serif text-[clamp(48px,7vw,96px)] font-normal leading-[1.05] tracking-[-0.02em] text-refined-950"
          style={{ animationDelay: "120ms", "--landing-offset": "12px" } as CSSProperties}
        >
          Proof of how you wrote it.
        </h1>
        <p
          className="landing-animate mt-6 max-w-[520px] text-lg font-normal leading-[1.6] text-refined-500"
          style={{ animationDelay: "200ms", "--landing-offset": "8px" } as CSSProperties}
        >
          Receipts is a tamper-evident record of your coding process, not a
          polygraph, just the truth about your keystrokes.
        </p>
        <div
          className="landing-animate mt-9 flex flex-wrap gap-4"
          style={{ animationDelay: "280ms", "--landing-offset": "6px" } as CSSProperties}
        >
          <Link
            href="/editor"
            className={`${focusClass} rounded-lg bg-accent-600 px-5 py-3 text-[15px] font-medium text-white transition duration-[180ms] ease-out hover:-translate-y-px hover:brightness-105`}
          >
            Try the editor
          </Link>
          <Link
            href="/r/demo"
            className={`${focusClass} rounded-lg border border-refined-200 bg-white px-5 py-3 text-[15px] font-medium text-refined-950 transition duration-[180ms] ease-out hover:border-[#CFCFCF] hover:bg-refined-50`}
          >
            View a sample receipt
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-2 text-[13px] text-gray-500">
          <span>No clipboard contents.</span>
          <span aria-hidden="true" className="text-gray-300">
            ·
          </span>
          <span>No telemetry.</span>
          <span aria-hidden="true" className="text-gray-300">
            ·
          </span>
          <span>Verifiable hash chain.</span>
        </div>
      </div>
      <HeroCapture />
    </section>
  );
}
