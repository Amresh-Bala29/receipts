"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Receipt } from "@receipts/shared";
import { formatDuration } from "@/lib/format/duration";
import { getHandle, setHandle, validateHandle } from "@/lib/identity";

function goodSignalCount(receipt: Receipt): number {
  return receipt.signals.filter((signal) => signal.status === "good").length;
}

export function DashboardClient() {
  const [handle, setCurrentHandle] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = getHandle();
      setCurrentHandle(next);
      setDraft(next ?? "");
    };

    sync();
    window.addEventListener("receipts:handle-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("receipts:handle-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    if (!handle) {
      setReceipts([]);
      return;
    }

    setLoading(true);
    fetch(`/api/receipts?handle=${encodeURIComponent(handle)}`, {
      cache: "no-store",
    })
      .then((response) => response.json())
      .then((data: { receipts: Receipt[] }) => setReceipts(data.receipts))
      .finally(() => setLoading(false));
  }, [handle]);

  const saveHandle = () => {
    const next = draft.trim().toLowerCase();
    const validation = validateHandle(next);
    if (!validation.ok) {
      setError(validation.reason);
      return;
    }
    setHandle(next);
    setError(null);
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
            Student dashboard
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">
            Your receipts
          </h1>
        </div>
        <Link
          href="/editor"
          className="rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
        >
          New session
        </Link>
      </div>

      {!handle ? (
        <section className="mt-8 rounded-md border border-slate-200 bg-white p-6 shadow-soft">
          <h2 className="text-lg font-semibold text-slate-950">
            Pick a handle to start tracking your Receipts.
          </h2>
          <div className="mt-4 flex max-w-md flex-col gap-3 sm:flex-row">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="maya.codes"
              className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent-600 focus:ring-2 focus:ring-[rgba(13,148,136,0.25)]"
            />
            <button
              type="button"
              onClick={saveHandle}
              className="rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
            >
              Save handle
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-amber-700">{error}</p> : null}
        </section>
      ) : (
        <div className="mt-8 overflow-hidden rounded-md border border-slate-200 bg-white shadow-soft">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Receipt</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Signals</th>
                <th className="px-4 py-3 font-medium">Chain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {receipts.map((receipt) => {
                const goodCount = goodSignalCount(receipt);
                return (
                  <tr key={receipt.id} className="hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <Link
                        href={`/r/${receipt.id}`}
                        className="font-semibold text-slate-950 hover:text-accent-700"
                      >
                        /r/{receipt.id}
                      </Link>
                      <p className="mt-1 text-xs text-slate-500">
                        {receipt.languages.join(", ")}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {new Date(receipt.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {formatDuration(receipt.summary.durationMs)}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {goodCount} check{goodCount === 1 ? "" : "s"}
                    </td>
                    <td
                      className={`px-4 py-4 font-medium ${
                        receipt.chainOk ? "text-accent-700" : "text-amber-700"
                      }`}
                    >
                      {receipt.chainOk ? "Verified" : "Failed"}
                    </td>
                  </tr>
                );
              })}
              {receipts.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-slate-500" colSpan={5}>
                    {loading ? "Loading receipts..." : "No receipts for this handle yet."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
