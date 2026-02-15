export function isTourMode(): boolean {
  if (process.env.NEXT_PUBLIC_TOUR_MODE === "1") {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("tour") === "1";
}

export function ensureTourParam(url: string): string {
  try {
    const parsed = new URL(url, "http://localhost");
    parsed.searchParams.set("tour", "1");

    if (/^https?:\/\//i.test(url)) {
      return parsed.toString();
    }

    const query = parsed.searchParams.toString();
    return `${parsed.pathname}${query ? `?${query}` : ""}${parsed.hash}`;
  } catch {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}tour=1`;
  }
}
