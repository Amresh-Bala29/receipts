export const HANDLE_KEY = "receipts:handle";

const listeners = new Set<(handle: string | null) => void>();

function notifyHandleChanged(handle: string | null) {
  listeners.forEach((listener) => listener(handle));
  window.dispatchEvent(
    new CustomEvent("receipts:handle-changed", { detail: { handle } }),
  );
}

export function validateHandle(
  input: string,
): { ok: true } | { ok: false; reason: string } {
  const handle = input.trim().toLowerCase();

  if (handle.length < 3 || handle.length > 30) {
    return { ok: false, reason: "Use 3 to 30 characters." };
  }
  if (!/^[a-z0-9._-]+$/.test(handle)) {
    return { ok: false, reason: "Use lowercase letters, numbers, dots, underscores, or hyphens." };
  }
  if (/^[._-]|[._-]$/.test(handle)) {
    return { ok: false, reason: "Do not start or end with punctuation." };
  }
  if (handle.includes("..")) {
    return { ok: false, reason: "Do not use consecutive dots." };
  }

  return { ok: true };
}

export function getHandle(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(HANDLE_KEY);
}

export function setHandle(handle: string): void {
  if (typeof window === "undefined") return;
  const next = handle.trim().toLowerCase();
  window.localStorage.setItem(HANDLE_KEY, next);
  notifyHandleChanged(next);
}

export function clearHandle(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HANDLE_KEY);
  notifyHandleChanged(null);
}

export function subscribeToHandle(fn: (handle: string | null) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
