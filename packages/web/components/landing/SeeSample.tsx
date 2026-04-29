"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const focusClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(13,148,136,0.4)] focus-visible:ring-offset-2";

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

export function SeeSample() {
  const { ref, visible } = useReveal();

  return (
    <section
      ref={ref}
      className={`landing-section border-t border-refined-100 px-8 py-24 text-center lg:px-20 ${
        visible ? "is-visible" : ""
      }`}
    >
      <p className="text-base font-medium text-refined-500">
        See what a real Receipt looks like.
      </p>
      <div className="mt-6">
        <Link
          href="/r/demo"
          className={`${focusClass} inline-flex rounded-lg border border-refined-200 bg-white px-5 py-3 text-[15px] font-medium text-refined-950 transition duration-[180ms] ease-out hover:border-[#CFCFCF] hover:bg-refined-50`}
        >
          Open sample receipt
        </Link>
      </div>
    </section>
  );
}
