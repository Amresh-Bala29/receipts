import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { ChainedEvent, Receipt } from "@receipts/shared";
import { AnalyzerSummary } from "@/components/AnalyzerSummary";
import { AnonymousReceiptNotice } from "@/components/identity/AnonymousReceiptNotice";
import { ReceiptHeader } from "@/components/ReceiptHeader";
import { ReplayPlayer } from "@/components/ReplayPlayer";
import { VerifyChainButton } from "@/components/VerifyChainButton";

type ReceiptPayload = {
  receipt: Receipt;
  events: ChainedEvent[];
  verification: { ok: boolean; brokenAtSeq?: number };
};

async function getReceipt(id: string): Promise<ReceiptPayload | null> {
  const host = headers().get("host") ?? "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const response = await fetch(`${protocol}://${host}/api/receipts/${id}`, {
    cache: "no-store",
  });

  if (response.status === 404) return null;
  return (await response.json()) as ReceiptPayload;
}

export default async function PublicReceiptPage({
  params,
}: {
  params: { id: string };
}) {
  const payload = await getReceipt(params.id);

  if (!payload) {
    notFound();
  }

  const { receipt, events } = payload;

  return (
    <main>
      <ReceiptHeader receipt={receipt} />
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <AnalyzerSummary signals={receipt.signals} summary={receipt.summary} />
          <ReplayPlayer
            receiptId={receipt.id}
            events={events}
            durationMs={receipt.summary.durationMs}
            authorHandle={receipt.author.handle}
            totalEvents={receipt.summary.totalEvents}
            editEvents={receipt.summary.editEvents}
            runEvents={receipt.summary.runEvents}
            chainOk={payload.verification.ok}
            brokenAtSeq={payload.verification.brokenAtSeq}
          />
        </div>
        <aside className="space-y-4">
          <div className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-slate-950">Summary</h2>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Events</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {receipt.summary.totalEvents}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Runs</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {receipt.summary.runEvents}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Edits</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {receipt.summary.editEvents}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Snapshots</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {receipt.summary.snapshotCount}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">External pastes</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {receipt.summary.externalPastes}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Internal pastes</dt>
                <dd className="mt-1 font-semibold text-slate-950">
                  {receipt.summary.internalPastes}
                </dd>
              </div>
            </dl>
          </div>
          <VerifyChainButton receiptId={receipt.id} />
          {receipt.author.handle === "anonymous" ? (
            <AnonymousReceiptNotice />
          ) : null}
        </aside>
      </div>
    </main>
  );
}
