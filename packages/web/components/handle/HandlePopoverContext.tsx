"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { HandlePopoverPanel } from "@/components/handle/HandlePopoverPanel";
import { Popover } from "@/components/ui/Popover";

type HandlePopoverContextValue = {
  open: boolean;
  openPopover: () => void;
  closePopover: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  setAnchor: (el: HTMLElement | null) => void;
};

export const HandlePopoverContext =
  createContext<HandlePopoverContextValue | null>(null);

export function useHandlePopover() {
  const ctx = useContext(HandlePopoverContext);
  if (!ctx) {
    throw new Error("useHandlePopover must be inside HandlePopoverProvider");
  }
  return ctx;
}

export function HandlePopoverProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [, forceUpdate] = useState(0);
  const [placement, setPlacement] = useState<"bottom-end" | "bottom-start">(
    "bottom-end",
  );
  const anchorRef = useRef<HTMLElement | null>(null);

  const setAnchor = useCallback((el: HTMLElement | null) => {
    anchorRef.current = el;
    setPlacement(
      el?.dataset.handlePopoverPlacement === "bottom-start"
        ? "bottom-start"
        : "bottom-end",
    );
    forceUpdate((value) => value + 1);
  }, []);

  const openPopover = useCallback(() => {
    if (anchorRef.current) {
      setOpen(true);
    }
  }, []);

  const closePopover = useCallback(() => setOpen(false), []);

  const value = useMemo<HandlePopoverContextValue>(
    () => ({
      open,
      openPopover,
      closePopover,
      anchorRef,
      setAnchor,
    }),
    [closePopover, open, openPopover, setAnchor],
  );

  return (
    <HandlePopoverContext.Provider value={value}>
      {children}
      <Popover
        open={open}
        onOpenChange={setOpen}
        anchor={anchorRef}
        placement={placement}
        offset={8}
        label="Your handle"
      >
        <HandlePopoverPanel closePopover={closePopover} />
      </Popover>
    </HandlePopoverContext.Provider>
  );
}
