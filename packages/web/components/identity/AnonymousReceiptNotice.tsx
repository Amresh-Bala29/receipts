"use client";

import { useState } from "react";
import { setHandle, validateHandle } from "@/lib/identity";

export function AnonymousReceiptNotice() {
  const [value, setValue] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const save = () => {
    const next = value.trim().toLowerCase();
    const validation = validateHandle(next);
    if (!validation.ok) {
      setMessage(validation.reason);
      return;
    }
    setHandle(next);
    setMessage("Handle saved for future receipts.");
  };

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-soft">
      <p className="text-sm leading-6 text-slate-600">
        This receipt is anonymous. Pick a handle to claim future receipts.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="testuser"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-accent-600 focus:ring-2 focus:ring-[rgba(13,148,136,0.25)]"
        />
        <button
          type="button"
          onClick={save}
          className="rounded-md bg-accent-600 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-700"
        >
          Save handle
        </button>
      </div>
      {message ? <p className="mt-2 text-sm text-slate-500">{message}</p> : null}
    </section>
  );
}
