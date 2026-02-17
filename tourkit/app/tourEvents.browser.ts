/**
 * Emit TourKit custom events.
 * SSR-safe: no-ops when window is not available.
 */

export function emitTourEvent(name: string, detail?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(name, { detail: detail ?? {} }));
}
