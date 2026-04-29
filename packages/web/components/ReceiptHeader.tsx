import type { Receipt } from "@receipts/shared";
import { formatDuration } from "@/lib/format/duration";

export function ReceiptHeader({ receipt }: { receipt: Receipt }) {
  return (
    <section className="border-b border-gray-100 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent-700">
          Public receipt
        </p>
        <div className="mt-4 flex flex-col gap-x-16 gap-y-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-4xl font-semibold tracking-normal text-slate-950">
              {receipt.author.name}
            </h1>
            <p className="mt-2 text-slate-600">
              {receipt.author.handle} built for {formatDuration(receipt.summary.durationMs)}
            </p>
          </div>
          <dl className="flex flex-wrap items-start gap-x-12 gap-y-6">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-gray-500">
                Minted
              </dt>
              <dd className="mt-1.5 text-[15px] tabular-nums text-gray-900">
                {new Date(receipt.createdAt).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-gray-500">
                Signature
              </dt>
              <dd className="mt-1.5 font-mono text-[15px] tabular-nums text-gray-900">
                {receipt.signatureSnippet}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-[0.12em] text-gray-500">
                Chain
              </dt>
              <dd className="mt-1.5 text-[15px] tabular-nums">
                <span className={receipt.chainOk ? "text-accent-600" : "text-amber-700"}>
                  {receipt.chainOk ? "Verified" : "Failed"}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
