/**
 * Tour mode detection.
 * Tour mode is active when URL has ?tour=1 OR env var is set.
 */

export function isTourMode(): boolean {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  if (params.get("tour") === "1") return true;

  if (process.env.NEXT_PUBLIC_TOUR_MODE === "1") return true;

  return false;
}

export function ensureTourParam(url: string): string {
  const u = new URL(url, window.location.origin);
  u.searchParams.set("tour", "1");
  return u.toString();
}
