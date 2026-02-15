import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureTourParam } from "@/tourkit/app/tourMode";

type RoutesFile = { routes: Array<{ routeKey: string; path: string }> };
type EventsFile = { events: Array<{ name: string }> };
type TourMap = {
  routes: Record<string, { path: string; anchors: string[] }>;
  events: string[];
};

const ROOT = process.cwd();
const ROUTES_PATH = resolve(ROOT, "tourkit/config/routes.json");
const EVENTS_PATH = resolve(ROOT, "tourkit/config/events.json");
const MAP_PATH = resolve(ROOT, "tourkit/maps/tour.map.json");

function parseJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

async function routeContainsAnchors(baseUrl: string, path: string, anchors: string[]): Promise<string[]> {
  if (anchors.length === 0) return [];

  const target = ensureTourParam(`${baseUrl}${path}`);
  const response = await fetch(target);
  if (!response.ok) {
    throw new Error(`Could not fetch ${target} (${response.status})`);
  }

  const html = await response.text();
  return anchors.filter((anchor) => html.includes(`data-tour="${anchor}"`) || html.includes(`data-tour='${anchor}'`));
}

async function run(): Promise<void> {
  const warnings: string[] = [];
  const failures: string[] = [];

  let routes: RoutesFile;
  let events: EventsFile;
  let map: TourMap;

  try {
    routes = parseJson<RoutesFile>(ROUTES_PATH);
  } catch {
    throw new Error("Missing/invalid tourkit/config/routes.json");
  }

  try {
    events = parseJson<EventsFile>(EVENTS_PATH);
  } catch {
    throw new Error("Missing/invalid tourkit/config/events.json");
  }

  try {
    map = parseJson<TourMap>(MAP_PATH);
  } catch {
    throw new Error("Missing/invalid tourkit/maps/tour.map.json. Run npm run tourkit:map first.");
  }

  if (!process.env.E2E_EMAIL) warnings.push("E2E_EMAIL is not set.");
  if (!process.env.E2E_PASSWORD) warnings.push("E2E_PASSWORD is not set.");

  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  for (const route of routes.routes) {
    const mapped = map.routes[route.routeKey];
    if (!mapped) {
      failures.push(`Route ${route.routeKey} is missing in tour.map.json`);
      continue;
    }

    const expectedAnchors = mapped.anchors;
    try {
      const found = await routeContainsAnchors(baseUrl, route.path, expectedAnchors);
      const missing = expectedAnchors.filter((anchor) => !found.includes(anchor));
      if (missing.length > 0) {
        warnings.push(`Route ${route.routeKey} missing ${missing.length} anchors in current HTML (may require client hydration): ${missing.join(", ")}`);
      }
    } catch (error) {
      warnings.push(`Could not validate route ${route.routeKey} at ${route.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  const canonicalEventNames = events.events.map((event) => event.name).sort();
  const mappedEventNames = [...map.events].sort();
  for (const eventName of canonicalEventNames) {
    if (!mappedEventNames.includes(eventName)) {
      failures.push(`Event ${eventName} is missing from tour.map.json`);
    }
  }

  if (warnings.length > 0) {
    console.warn("[tourkit:doctor] warnings:");
    for (const warning of warnings) {
      console.warn(`- ${warning}`);
    }
  }

  if (failures.length > 0) {
    console.error("[tourkit:doctor] failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("[tourkit:doctor] ok");
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[tourkit:doctor] failed: ${message}`);
  process.exit(1);
});
