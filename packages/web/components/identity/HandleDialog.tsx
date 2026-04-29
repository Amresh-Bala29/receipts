"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useHandlePopover } from "@/components/handle/HandlePopoverContext";
import { getHandle, subscribeToHandle } from "@/lib/identity";

export function HandleDialog() {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [handle, setHandleState] = useState<string | null>(null);
  const { open, anchorRef, setAnchor, openPopover, closePopover } =
    useHandlePopover();
  const isActiveTrigger = open && anchorRef.current === triggerRef.current;

  useEffect(() => {
    const sync = () => setHandleState(getHandle());

    sync();
    const unsubscribe = subscribeToHandle(setHandleState);
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

  const togglePopover = () => {
    if (isActiveTrigger) {
      closePopover();
      return;
    }

    setAnchor(triggerRef.current);
    openPopover();
  };

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={isActiveTrigger}
      onClick={togglePopover}
      className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500/40"
    >
      {handle ?? "Set handle"}
      <ChevronDown
        aria-hidden="true"
        className={`ml-1 h-3 w-3 text-slate-400 transition-transform duration-150 ${
          isActiveTrigger ? "rotate-180" : ""
        }`}
      />
    </button>
  );
}
