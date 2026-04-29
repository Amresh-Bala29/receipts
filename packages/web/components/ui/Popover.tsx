"use client";

import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { zIndex } from "@/lib/ui/zindex";

type Placement =
  | "bottom-end"
  | "bottom-start"
  | "bottom"
  | "top-end"
  | "top-start"
  | "top";

type PopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchor: React.RefObject<HTMLElement>;
  placement?: Placement;
  offset?: number;
  children: ReactNode;
  className?: string;
  label?: string;
};

type Position = {
  top: number;
  left?: number;
  right?: number;
  maxHeight: number;
};

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => !element.hasAttribute("disabled"))
    .filter((element) => element.offsetParent !== null);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function computePosition(
  anchorRect: DOMRect,
  panel: HTMLElement,
  preferredPlacement: Placement,
  offset: number,
): Position {
  const width = panel.offsetWidth || 240;
  const height = panel.offsetHeight || 1;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const spaceAbove = anchorRect.top - offset;
  const spaceBelow = viewportHeight - anchorRect.bottom - offset;
  const wantsBottom = preferredPlacement.startsWith("bottom");
  const shouldFlipToTop =
    wantsBottom && anchorRect.bottom + offset + height > viewportHeight && spaceAbove > spaceBelow;
  const placement = shouldFlipToTop
    ? (preferredPlacement.replace("bottom", "top") as Placement)
    : preferredPlacement;
  const verticalSpace = placement.startsWith("top") ? spaceAbove : spaceBelow;
  const alternateSpace = placement.startsWith("top") ? spaceBelow : spaceAbove;
  const finalPlacement =
    verticalSpace < height && alternateSpace > verticalSpace
      ? (placement.startsWith("top")
          ? preferredPlacement.replace("top", "bottom")
          : preferredPlacement.replace("bottom", "top")) as Placement
      : placement;
  const availableSpace = Math.max(
    64,
    finalPlacement.startsWith("top") ? spaceAbove : spaceBelow,
  );
  const top = finalPlacement.startsWith("top")
    ? Math.max(8, anchorRect.top - offset - Math.min(height, availableSpace))
    : Math.min(viewportHeight - 8, anchorRect.bottom + offset);
  const maxHeight = Math.max(64, availableSpace - 16);

  if (finalPlacement.endsWith("end")) {
    return {
      top,
      right: Math.max(8, viewportWidth - anchorRect.right),
      maxHeight,
    };
  }

  if (finalPlacement.endsWith("start")) {
    return {
      top,
      left: Math.max(8, Math.min(anchorRect.left, viewportWidth - width - 8)),
      maxHeight,
    };
  }

  return {
    top,
    left: Math.max(
      8,
      Math.min(anchorRect.left + anchorRect.width / 2 - width / 2, viewportWidth - width - 8),
    ),
    maxHeight,
  };
}

export function Popover({
  open,
  onOpenChange,
  anchor,
  placement = "bottom-end",
  offset = 8,
  children,
  className = "",
  label,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeFromInsideRef = useRef(false);
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const [position, setPosition] = useState<Position>({
    top: 0,
    right: 8,
    maxHeight: 360,
  });

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => setVisible(true));
      return;
    }

    setVisible(false);
    if (prefersReducedMotion()) {
      setMounted(false);
      return;
    }

    const timeout = window.setTimeout(() => setMounted(false), 100);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useLayoutEffect(() => {
    if (!mounted) return;

    const update = () => {
      const anchorElement = anchor.current;
      const panelElement = panelRef.current;
      if (!anchorElement || !panelElement) return;
      setPosition(
        computePosition(
          anchorElement.getBoundingClientRect(),
          panelElement,
          placement,
          offset,
        ),
      );
    };

    update();
    const frame = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor, mounted, offset, placement]);

  useEffect(() => {
    if (!open) return;

    const focusFrame = requestAnimationFrame(() => {
      const panelElement = panelRef.current;
      if (!panelElement) return;
      getFocusable(panelElement)[0]?.focus();
    });

    return () => cancelAnimationFrame(focusFrame);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;

    const panelElement = panelRef.current;
    if (!panelElement) return;

    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        panelElement.contains(target) ||
        anchor.current?.contains(target)
      ) {
        return;
      }
      onOpenChange(false);
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeFromInsideRef.current = true;
      onOpenChange(false);
      anchor.current?.focus();
    };

    const onBlur = () => onOpenChange(false);

    const onScroll = (event: Event) => {
      const target = event.target as Node | null;
      if (target && panelElement.contains(target)) return;
      onOpenChange(false);
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", onBlur);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [anchor, mounted, onOpenChange]);

  useEffect(() => {
    if (open || !mounted) return;
    const panelElement = panelRef.current;
    if (
      panelElement &&
      document.activeElement instanceof HTMLElement &&
      panelElement.contains(document.activeElement)
    ) {
      anchor.current?.focus();
    } else if (closeFromInsideRef.current) {
      anchor.current?.focus();
    }
    closeFromInsideRef.current = false;
  }, [anchor, mounted, open]);

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;

    const panelElement = panelRef.current;
    if (!panelElement) return;
    const focusable = getFocusable(panelElement);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      aria-modal="false"
      onKeyDown={onPanelKeyDown}
      className={`fixed min-w-[240px] max-w-[360px] overflow-y-auto rounded-xl border border-refined-200 bg-white shadow-[0_8px_24px_rgba(10,10,10,0.08),0_1px_2px_rgba(10,10,10,0.04)] transition-[opacity,transform] duration-100 ease-[cubic-bezier(0.22,0.61,0.36,1)] motion-reduce:transition-none ${
        visible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
      } ${className}`}
      style={{
        zIndex: zIndex.popover,
        top: position.top,
        left: position.left,
        right: position.right,
        maxHeight: position.maxHeight,
      }}
    >
      {children}
    </div>,
    document.body,
  );
}

export function PopoverPanel({ children }: { children: ReactNode }) {
  return <div className="p-4 text-sm text-refined-700">{children}</div>;
}
