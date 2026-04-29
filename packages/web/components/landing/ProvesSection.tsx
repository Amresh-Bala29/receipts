"use client";

import { Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const proves = [
  "Event ordering integrity from start to mint",
  "No insertions, deletions, or rewrites after mint",
  "Paste lengths and sources, never paste contents",
  "Run history with timing and exit codes",
  "Idle periods longer than 30 seconds",
];

const doesNot = [
  "Whether the thinking was the author's",
  "Whether a separate device was used",
  "Whether the author understood the code",
  "Whether help was received verbally",
  "Whether the work is original to the world",
];

function useReveal() {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

export function ProvesSection() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      className={`landing-section mx-auto max-w-[1200px] px-8 py-[72px] lg:px-20 lg:py-[120px] ${
        visible ? "is-visible" : ""
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-refined-500">
        HONEST FRAMING
      </p>
      <h2 className="mt-5 max-w-[720px] font-serif text-[40px] font-normal leading-tight tracking-[-0.02em] text-refined-950">
        Receipts proves the process, not the thinking.
      </h2>

      <div className="mt-[72px] grid gap-10 lg:grid-cols-[1fr_1px_1fr] lg:gap-12">
        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-refined-500">
            What it proves
          </h3>
          <div className="mt-5">
            {proves.map((item) => (
              <div key={item} className="flex h-12 items-center gap-3.5">
                <Check
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-refined-500"
                  strokeWidth={1.5}
                />
                <span className="text-[15px] leading-6 text-refined-700">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div aria-hidden="true" className="hidden bg-refined-100 lg:block" />

        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-refined-500">
            What it does not
          </h3>
          <div className="mt-5">
            {doesNot.map((item) => (
              <div key={item} className="flex h-12 items-center gap-3.5">
                <X
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-refined-500"
                  strokeWidth={1.5}
                />
                <span className="text-[15px] leading-6 text-refined-700">
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
