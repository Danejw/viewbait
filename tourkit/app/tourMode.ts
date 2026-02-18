// tourkit/app/tourMode.ts

const DEFAULT_BASE_URL = "http://localhost:3000";

/**
 * Whether the runner should force ?tour=1 on URLs.
 * This is used by the Node-side runner, so it must NOT touch window.
 */
export function isTourModeActive(): boolean {
  const v = String(process.env.TOUR_MODE ?? "").toLowerCase();
  return v === "tour_mode" || v === "1" || v === "true";
}

/**
 * Tour overlay rendering toggle for the UI.
 * Per your update: this is TOUR_OVERLAY (not NEXT_PUBLIC_*).
 */
export function isTourOverlayEnabled(): boolean {
  const v = String(process.env.TOUR_OVERLAY ?? "").toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * Node-safe: accepts absolute URLs or paths.
 * If passed a path like "/auth", it uses PLAYWRIGHT_BASE_URL as base.
 */
export function ensureTourParam(inputUrl: string): string {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_BASE_URL;

  const u = new URL(inputUrl, base);
  u.searchParams.set("tour", "1");
  return u.toString();
}
