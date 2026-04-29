"use client";

import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { Receipt } from "@receipts/shared";

type Verification = {
  ok: boolean;
  brokenAtSeq?: number;
};

export function VerifyChainButton({ receiptId }: { receiptId: string }) {
  const [verification, setVerification] = useState<Verification | null>(null);
  const [totalEvents, setTotalEvents] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  async function verify() {
    const response = await fetch(`/api/receipts/${receiptId}`, {
      cache: "no-store",
    });
    const data = (await response.json()) as {
      receipt: Receipt;
      verification: Verification;
    };
    setVerification(data.verification);
    setTotalEvents(data.receipt.summary.totalEvents);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
    if (!verification?.ok && verification?.brokenAtSeq) {
      window.dispatchEvent(
        new CustomEvent("receipts:chain-flagged", {
          detail: {
            receiptId,
            brokenAtSeq: verification.brokenAtSeq,
          },
        }),
      );
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={verify}
        className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
      >
        <ShieldCheck className="h-4 w-4" />
        Verify chain
      </button>
      {open && verification ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[rgba(10,10,10,0.4)] px-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-chain-title"
            className="max-w-lg rounded-xl border border-gray-200 bg-white p-6 shadow-[0_8px_24px_rgba(10,10,10,0.08),0_1px_2px_rgba(10,10,10,0.04)]"
          >
            <h3
              id="verify-chain-title"
              className="text-lg font-semibold text-slate-950"
            >
              {verification.ok ? (
                "Chain verified."
              ) : (
                <>
                  Chain failed at seq{" "}
                  <span className="text-amber-700">
                    {verification.brokenAtSeq ?? "unknown"}
                  </span>
                  .
                </>
              )}
            </h3>
            {verification.ok ? (
              <p className="mt-3 max-w-prose text-sm leading-6 text-gray-700">
                All {totalEvents ?? "captured"} events form an unbroken hash chain
                from the first edit to the mint. No insertions, deletions, or
                rewrites occurred after this receipt was minted. What this does
                not prove: that the work was the author&apos;s, that no one helped
                verbally, or that the code was understood. See What it proves on
                the landing page for the full framing.
              </p>
            ) : (
              <>
                <p className="mt-3 max-w-prose text-sm leading-6 text-gray-700">
                  Event {verification.brokenAtSeq ?? "unknown"} reports a hash
                  that does not match its content. This means the event was
                  modified after the receipt was minted. Every event from seq{" "}
                  {verification.brokenAtSeq ?? "unknown"} onward is now suspect.
                  The first {verification.brokenAtSeq ?? "unknown"} events still
                  verify cleanly.
                </p>
                <p className="mt-3 text-[13px] text-gray-500">
                  Hover the timeline to see where seq{" "}
                  {verification.brokenAtSeq ?? "unknown"} falls in the session.
                </p>
              </>
            )}
            <button
              type="button"
              onClick={closeModal}
              className="mt-5 rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500/40"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
