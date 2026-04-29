import { CheckCircle2, Info, MinusCircle } from "lucide-react";
import type { AnalyzerSignal, ReceiptSummary } from "@receipts/shared";

const styles = {
  good: "border-accent-200 bg-accent-50 text-accent-700",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
  concern: "border-amber-200 bg-amber-50 text-amber-700",
};

export function AnalyzerSummary({
  signals,
  summary,
}: {
  signals: AnalyzerSignal[];
  summary: ReceiptSummary;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-950">
          Analyzer summary
        </h2>
        <span className="text-right text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
          {signals.length} signals computed from {summary.totalEvents} events
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {signals.map((signal) => {
          const Icon = signal.status === "good" ? CheckCircle2 : MinusCircle;
          return (
            <div
              key={signal.id}
              title={signal.detail}
              className={`group relative inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${styles[signal.status]}`}
            >
              <Icon className="h-4 w-4" />
              {signal.label}
              <Info className="h-3.5 w-3.5 opacity-60" />
              <span className="pointer-events-none absolute left-0 top-full z-10 mt-2 hidden w-72 rounded-md border border-slate-200 bg-white p-3 text-xs font-normal leading-5 text-slate-600 shadow-soft group-hover:block">
                {signal.detail}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
