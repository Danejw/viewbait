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
  if (typeof window === "undefined") {
    return url.includes("tour=1") ? url : `${url}${url.includes("?") ? "&" : "?"}tour=1`;
  }

  const nextUrl = new URL(url, window.location.origin);
  nextUrl.searchParams.set("tour", "1");
  return nextUrl.toString();
}
