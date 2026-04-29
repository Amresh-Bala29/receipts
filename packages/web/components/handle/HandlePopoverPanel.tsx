"use client";

import { type KeyboardEvent, useEffect, useMemo, useState } from "react";
import {
  clearHandle,
  getHandle,
  setHandle,
  subscribeToHandle,
  validateHandle,
} from "@/lib/identity";

const helperText =
  "3 to 30 chars, lowercase, letters, numbers, dot, underscore, hyphen.";

type HandlePopoverPanelProps = {
  closePopover: () => void;
};

export function HandlePopoverPanel({ closePopover }: HandlePopoverPanelProps) {
  const [handle, setHandleState] = useState<string | null>(null);
  const [value, setValue] = useState("");

  useEffect(() => {
    const sync = () => {
      const next = getHandle();
      setHandleState(next);
      setValue(next ?? "");
    };

    sync();
    const unsubscribe = subscribeToHandle((next) => {
      setHandleState(next);
      setValue(next ?? "");
    });
    window.addEventListener("receipts:handle-changed", sync);
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      unsubscribe();
      window.removeEventListener("receipts:handle-changed", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const normalized = value.trim().toLowerCase();
  const validation = useMemo(
    () => (normalized ? validateHandle(normalized) : null),
    [normalized],
  );
  const canSave = Boolean(normalized && validation?.ok);

  const save = () => {
    if (!canSave) return;
    setHandle(normalized);
    closePopover();
  };

  const cancel = () => {
    setValue(handle ?? "");
    closePopover();
  };

  const clear = () => {
    if (!handle) return;
    clearHandle();
    closePopover();
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  const hint = validation && !validation.ok ? validation.reason : helperText;

  return (
    <div className="p-4 text-sm text-refined-700">
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-refined-950">
            Your handle
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-refined-600">
            Save and reuse a handle so your future receipts are linked together.
            No account needed.
          </p>
        </div>
        <div>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder="your-handle"
            className="h-9 w-full rounded-lg border border-refined-200 px-3 py-2 text-sm text-refined-950 outline-none transition-colors placeholder:text-refined-400 focus:border-accent-600/60 focus:ring-2 focus:ring-accent-500/20"
          />
          <p
            className={`mt-1 h-4 text-[11px] leading-4 ${
              validation && !validation.ok ? "text-[#B45309]" : "text-refined-500"
            }`}
          >
            {hint}
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={clear}
            disabled={!handle}
            className="text-sm font-medium text-refined-500 hover:text-refined-700 disabled:cursor-not-allowed disabled:text-refined-400"
          >
            Clear
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancel}
              className="rounded-lg border border-refined-200 bg-white px-3.5 py-2 text-sm font-medium text-refined-950 hover:border-refined-300 hover:bg-refined-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="rounded-lg bg-accent-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
