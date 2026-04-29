"use client";

import { useEffect, useRef, useState } from "react";

const citations = [
  "Stanford HAI, 2024: AI detectors falsely flagged 61% of writing by non-native English speakers.",
  "Common Sense Media, 2024: 1 in 4 teachers say AI detectors have wrongly accused a student in their class.",
  "Inside Higher Ed, 2025: Universities are quietly stepping back from automated AI detection after lawsuits.",
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

function References() {
  return (
    <aside className="lg:pt-10">
      <div className="border-t border-refined-100 pt-12 lg:border-t-0 lg:pt-0">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-refined-400">
          REFERENCES
        </p>
        <div className="mt-5 space-y-3">
          {citations.map((citation) => (
            <cite
              key={citation}
              className="block text-sm leading-6 text-refined-500 transition-colors hover:underline"
            >
              {citation}
            </cite>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function WhyNowSection() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      className={`landing-section mx-auto max-w-[1200px] px-8 py-[72px] lg:px-20 lg:py-[120px] ${
        visible ? "is-visible" : ""
      }`}
    >
      <div className="grid gap-12 lg:grid-cols-[minmax(0,0.6fr)_minmax(320px,0.4fr)] lg:gap-16">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-refined-500">
            WHY NOW
          </p>
          <h2 className="mt-5 max-w-[820px] font-serif text-[42px] font-normal leading-[1.1] tracking-[-0.02em] text-refined-950">
            AI detectors are flagging real work as fake.
          </h2>
          <div className="mt-8 max-w-[720px] text-[17px] leading-[1.6] text-refined-700">
            <p>
              In 2024 and 2025, universities across the United States adopted AI
              detection tools that mark student work as machine-generated. The
              detectors have documented false positive rates between 4% and 9%,
              with some studies finding much higher rates on writing by
              non-native English speakers. Real students who wrote their own
              work are being penalized for sounding wrong to a model.
            </p>
            <p className="mt-6">
              Receipts takes a different position. Instead of guessing whether
              work is AI-generated, it records how the work was made and lets
              anyone verify the record themselves. The chain is cryptographic.
              The replay is observable. The honesty is the product.
            </p>
          </div>
        </div>

        <References />
      </div>
    </section>
  );
}
