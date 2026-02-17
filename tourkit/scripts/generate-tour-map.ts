import fs from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "@playwright/test";

type RoutesConfig = {
  routes: Array<{ routeKey: string; path: string }>;
};

type EventsConfig = {
  events: Array<{ name: string }>;
};

type MapRouteEntry = {
  path: string;
  anchors: string[];
  skipped?: boolean;
  skipReason?: string;
};

type TourMapFile = {
  generatedAt: string;
  routes: Record<string, MapRouteEntry>;
  events: string[];
};

function ensureTourParam(input: string): string {
  const url = new URL(input, "http://localhost");
  url.searchParams.set("tour", "1");
  return `${url.pathname}${url.search}${url.hash}`;
}

function toAreaTypeKey(anchor: string): string {
  const parts = anchor.split(".");
  if (parts.length < 4) return "misc";
  return `${parts[2]}.${parts[3]}`;
}

function extractAnchorsFromHtml(html: string): string[] {
  const anchors = new Set<string>();
  const regex = /data-tour\s*=\s*(["'])(.*?)\1/g;
  for (const match of html.matchAll(regex)) {
    const value = match[2]?.trim();
    if (value) anchors.add(value);
  }

  return Array.from(anchors).sort();
}

function collectAnchorsFromSource(root: string): string[] {
  const sourceRoots = [path.resolve(root, "app"), path.resolve(root, "components")];
  const anchors = new Set<string>();
  const tourToken = /["'](tour\.[A-Za-z0-9_.]+)["']/g;

  const walk = (dir: string): void => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, "utf8");
      for (const match of text.matchAll(tourToken)) {
        const value = match[1]?.trim();
        if (value && value.startsWith("tour.") && !value.startsWith("tour.event.")) {
          anchors.add(value);
        }
      }
    }
  };

  for (const src of sourceRoots) walk(src);
  return Array.from(anchors).sort();
}

function inferAnchorsForRoute(routeKey: string, allAnchors: string[]): string[] {
  const includePrefixes: string[] = [];
  const includeExact = new Set<string>();

  if (routeKey === "home") includePrefixes.push("tour.home.");
  if (routeKey === "auth") includePrefixes.push("tour.auth.");
  if (routeKey === "onboarding") includePrefixes.push("tour.onboarding.");

  if (routeKey.startsWith("studio.")) {
    includePrefixes.push(`tour.${routeKey}.`, "tour.studio.nav.");
  }

  if (routeKey === "studio.create") {
    includeExact.add("tour.studio.create.form.btn.aspectRatio.16_9");
    includeExact.add("tour.studio.create.form.btn.resolution.1k");
    includeExact.add("tour.studio.create.form.btn.variations.1");
  }

  if (routeKey === "share.project") includePrefixes.push("tour.share.project.");
  if (routeKey === "share.editor") includePrefixes.push("tour.share.editor.");

  return allAnchors
    .filter((anchor) => includeExact.has(anchor) || includePrefixes.some((prefix) => anchor.startsWith(prefix)))
    .sort();
}

async function main(): Promise<void> {
  const root = process.cwd();
  const routesPath = path.resolve(root, "tourkit/config/routes.json");
  const eventsPath = path.resolve(root, "tourkit/config/events.json");

  if (!fs.existsSync(routesPath) || !fs.existsSync(eventsPath)) {
    console.error("Missing routes/events config. Run Prompt 01 outputs first.");
    process.exit(1);
  }

  const routes = JSON.parse(fs.readFileSync(routesPath, "utf8")) as RoutesConfig;
  const events = JSON.parse(fs.readFileSync(eventsPath, "utf8")) as EventsConfig;

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const sourceAnchors = collectAnchorsFromSource(root);

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let crawlMode: "playwright" | "http" = "playwright";

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ baseURL });
    page = await context.newPage();
  } catch (error) {
    crawlMode = "http";
    console.warn("Playwright browser unavailable, falling back to HTML crawl mode.");
    console.warn(error instanceof Error ? error.message : String(error));
  }

  const routeMap: Record<string, MapRouteEntry> = {};
  const skipped: Array<{ routeKey: string; reason: string }> = [];
  let totalAnchors = 0;
  let crawled = 0;

  for (const route of routes.routes) {
    if (route.path.includes("[")) {
      routeMap[route.routeKey] = {
        path: route.path,
        anchors: [],
        skipped: true,
        skipReason: "dynamic path",
      };
      skipped.push({ routeKey: route.routeKey, reason: "dynamic path" });
      continue;
    }

    try {
      const target = ensureTourParam(route.path);
      let currentPath = route.path;
      let anchors: string[] = [];

      if (crawlMode === "playwright" && page) {
        await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);
        currentPath = new URL(page.url()).pathname;

        anchors = await page.evaluate(() => {
          const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-tour]"));
          const values = nodes
            .map((node) => node.getAttribute("data-tour")?.trim() ?? "")
            .filter((value) => value.length > 0);
          return Array.from(new Set(values)).sort();
        });
      } else {
        const targetUrl = new URL(target, baseURL).toString();
        const response = await fetch(targetUrl, { redirect: "follow" });
        const html = await response.text();
        currentPath = new URL(response.url).pathname;
        anchors = extractAnchorsFromHtml(html);
      }

      if (route.routeKey !== "auth" && currentPath.startsWith("/auth")) {
        const inferredAnchors = inferAnchorsForRoute(route.routeKey, sourceAnchors);
        routeMap[route.routeKey] = {
          path: route.path,
          anchors: inferredAnchors,
          skipped: true,
          skipReason: "auth redirect",
        };
        skipped.push({ routeKey: route.routeKey, reason: "auth redirect" });
        continue;
      }

      if (anchors.length === 0) {
        anchors = inferAnchorsForRoute(route.routeKey, sourceAnchors);
      }

      totalAnchors += anchors.length;
      crawled += 1;
      routeMap[route.routeKey] = {
        path: route.path,
        anchors,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      routeMap[route.routeKey] = {
        path: route.path,
        anchors: [],
        skipped: true,
        skipReason: reason,
      };
      skipped.push({ routeKey: route.routeKey, reason });
    }
  }

  if (context) await context.close();
  if (browser) await browser.close();

  const mapFile: TourMapFile = {
    generatedAt: new Date().toISOString(),
    routes: routeMap,
    events: events.events.map((event) => event.name),
  };

  const mapOut = path.resolve(root, "tourkit/maps/tour.map.json");
  fs.mkdirSync(path.dirname(mapOut), { recursive: true });
  fs.writeFileSync(mapOut, JSON.stringify(mapFile, null, 2));

  const mdLines: string[] = [];
  mdLines.push("# Tour Map");
  mdLines.push("");
  mdLines.push(`Generated at: ${mapFile.generatedAt}`);
  mdLines.push("");

  for (const [routeKey, entry] of Object.entries(mapFile.routes)) {
    mdLines.push(`## ${routeKey} (${entry.path})`);
    mdLines.push("");

    if (entry.skipped) {
      mdLines.push(`- Skipped: ${entry.skipReason ?? "unknown"}`);
      mdLines.push("");
      continue;
    }

    if (entry.anchors.length === 0) {
      mdLines.push("- No anchors found");
      mdLines.push("");
      continue;
    }

    const grouped = new Map<string, string[]>();
    for (const anchor of entry.anchors) {
      const key = toAreaTypeKey(anchor);
      grouped.set(key, [...(grouped.get(key) ?? []), anchor]);
    }

    for (const [groupKey, anchors] of grouped.entries()) {
      mdLines.push(`### ${groupKey}`);
      for (const anchor of anchors) {
        mdLines.push(`- ${anchor}`);
      }
      mdLines.push("");
    }
  }

  const mapMdOut = path.resolve(root, "tourkit/maps/TOUR_MAP.md");
  fs.writeFileSync(mapMdOut, mdLines.join("\n"));

  console.log(`Routes crawled: ${crawled}/${routes.routes.length}`);
  console.log(`Crawl mode: ${crawlMode}`);
  console.log(`Anchors found: ${totalAnchors}`);
  if (skipped.length > 0) {
    console.log("Skipped routes:");
    for (const item of skipped) {
      console.log(`- ${item.routeKey}: ${item.reason}`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
