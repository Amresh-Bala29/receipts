"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  {
    number: "01",
    title: "Write code in the Receipts editor.",
    body: "Edits, runs, pastes, and pauses are captured in your browser. The full text of pastes is never recorded.",
  },
  {
    number: "02",
    title: "Every event joins a hash chain.",
    body: "Each event references the hash of the one before it. Any later tampering breaks the chain visibly.",
  },
  {
    number: "03",
    title: "Mint a public, verifiable receipt.",
    body: "Share one URL. Anyone can replay your session and re-verify the chain themselves.",
  },
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

export function HowItWorks() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      className={`landing-section mx-auto max-w-[1200px] px-8 py-[72px] lg:px-20 lg:py-[120px] ${
        visible ? "is-visible" : ""
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-refined-500">
        THREE STEPS
      </p>
      <h2 className="mt-5 font-serif text-[40px] font-normal leading-tight tracking-[-0.02em] text-refined-950">
        Capture. Hash. Mint.
      </h2>

      <div className="mt-[72px] grid gap-12 lg:grid-cols-3 lg:gap-24">
        {steps.map((step) => (
          <article key={step.number}>
            <p className="font-serif text-[32px] leading-none text-refined-400">
              {step.number}
            </p>
            <h3 className="mt-7 text-lg font-semibold leading-7 text-refined-950">
              {step.title}
            </h3>
            <p className="mt-4 max-w-[280px] text-[15px] leading-7 text-refined-500">
              {step.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
