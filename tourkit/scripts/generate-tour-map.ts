import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { ensureTourParam } from "@/tourkit/app/tourMode";

type RouteConfig = { routeKey: string; path: string };
type RoutesFile = { routes: RouteConfig[]; primaryFlow: string };
type EventsFile = { events: Array<{ name: string }> };

type TourMap = {
  generatedAt: string;
  routes: Record<string, { path: string; anchors: string[] }>;
  events: string[];
};

const ROOT = process.cwd();
const ROUTES_PATH = resolve(ROOT, "tourkit/config/routes.json");
const EVENTS_PATH = resolve(ROOT, "tourkit/config/events.json");
const MAP_JSON_PATH = resolve(ROOT, "tourkit/maps/tour.map.json");
const MAP_MD_PATH = resolve(ROOT, "tourkit/maps/TOUR_MAP.md");

const FALLBACK_ANCHORS: Record<string, string[]> = {
  home: [
    "tour.home.nav.cta.openStudio",
    "tour.home.hero.cta.openStudio",
  ],
  auth: [
    "tour.auth.form.tab.signin",
    "tour.auth.form.input.email",
    "tour.auth.form.input.password",
    "tour.auth.form.btn.submit",
  ],
  "studio.create": [
    "tour.studio.create.tab.manual",
    "tour.studio.create.input.title",
    "tour.studio.create.input.customInstructions",
    "tour.studio.create.btn.aspectRatio.16_9",
    "tour.studio.create.btn.resolution.1k",
    "tour.studio.create.btn.generate",
  ],
  results: [
    "tour.results.main.grid.thumbnails",
    "tour.results.main.card.thumbnail.first",
  ],
};

function parseJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function groupByAreaType(anchors: string[]): Record<string, Record<string, string[]>> {
  const grouped: Record<string, Record<string, string[]>> = {};

  for (const anchor of anchors) {
    const parts = anchor.split(".");
    const area = parts[2] ?? "unknown";
    const type = parts[3] ?? "unknown";
    grouped[area] ??= {};
    grouped[area][type] ??= [];
    grouped[area][type].push(anchor);
  }

  for (const area of Object.keys(grouped)) {
    for (const type of Object.keys(grouped[area])) {
      grouped[area][type].sort();
    }
  }

  return grouped;
}

async function fetchAnchorsWithBrowser(baseUrl: string, routePath: string): Promise<string[]> {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const target = ensureTourParam(`${baseUrl}${routePath}`);
    await page.goto(target, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const anchors = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>("[data-tour]"))
        .map((node) => node.dataset.tour)
        .filter((value): value is string => Boolean(value))
    );
    return Array.from(new Set(anchors)).sort();
  } finally {
    await page.close();
    await browser.close();
  }
}

function toMarkdown(map: TourMap): string {
  const lines: string[] = [];
  lines.push("# Tour Map");
  lines.push("");
  lines.push(`Generated: ${map.generatedAt}`);
  lines.push("");

  for (const [routeKey, routeData] of Object.entries(map.routes)) {
    lines.push(`## ${routeKey} (${routeData.path})`);
    const grouped = groupByAreaType(routeData.anchors);
    const areas = Object.keys(grouped).sort();

    if (areas.length === 0) {
      lines.push("- (no anchors found)");
      lines.push("");
      continue;
    }

    for (const area of areas) {
      lines.push(`- **${area}**`);
      const types = Object.keys(grouped[area]).sort();
      for (const type of types) {
        lines.push(`  - *${type}*`);
        for (const anchor of grouped[area][type]) {
          lines.push(`    - \`${anchor}\``);
        }
      }
    }

    lines.push("");
  }

  lines.push("## Events");
  for (const eventName of map.events) {
    lines.push(`- \`${eventName}\``);
  }

  lines.push("");
  return lines.join("\n");
}

async function run(): Promise<void> {
  const routes = parseJson<RoutesFile>(ROUTES_PATH);
  const events = parseJson<EventsFile>(EVENTS_PATH);
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const map: TourMap = {
    generatedAt: new Date().toISOString(),
    routes: {},
    events: events.events.map((event) => event.name),
  };

  for (const route of routes.routes) {
    let anchors: string[] = [];

    try {
      anchors = await fetchAnchorsWithBrowser(baseUrl, route.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[tourkit:map] browser crawl unavailable for ${route.routeKey}: ${message}`);
      anchors = [];
    }

    if (anchors.length === 0) {
      anchors = [...(FALLBACK_ANCHORS[route.routeKey] ?? [])];
      if (anchors.length > 0) {
        console.warn(`[tourkit:map] using fallback contract anchors for ${route.routeKey}`);
      }
    }

    map.routes[route.routeKey] = {
      path: route.path,
      anchors: Array.from(new Set(anchors)).sort(),
    };

    console.log(`[tourkit:map] ${route.routeKey}: ${map.routes[route.routeKey].anchors.length} anchors`);
  }

  mkdirSync(resolve(ROOT, "tourkit/maps"), { recursive: true });
  writeFileSync(MAP_JSON_PATH, `${JSON.stringify(map, null, 2)}\n`);
  writeFileSync(MAP_MD_PATH, toMarkdown(map));
  console.log(`[tourkit:map] wrote ${MAP_JSON_PATH}`);
  console.log(`[tourkit:map] wrote ${MAP_MD_PATH}`);
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[tourkit:map] failed: ${message}`);
  process.exit(1);
});
