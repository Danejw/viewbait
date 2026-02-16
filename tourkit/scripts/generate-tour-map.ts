import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { chromium } from "@playwright/test";
import routesConfig from "@/tourkit/config/routes.json";
import eventsConfig from "@/tourkit/config/events.json";

interface RouteEntry {
  routeKey: string;
  path: string;
}

interface RouteMapEntry {
  path: string;
  anchors: string[];
  skippedReason?: string;
}

interface TourMap {
  generatedAt: string;
  routes: Record<string, RouteMapEntry>;
  events: string[];
}

function toNavigablePath(routePath: string): string {
  const withDynamicSegments = routePath.replace(/\[([^\]]+)\]/g, "demo");
  const [pathname, query = ""] = withDynamicSegments.split("?");
  const params = new URLSearchParams(query);
  params.set("tour", "1");
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}

function groupAnchor(anchor: string): string {
  const parts = anchor.split(".");
  return `${parts[1] || "unknown"}.${parts[2] || "unknown"}.${parts[3] || "unknown"}`;
}

function buildMapMarkdown(map: TourMap): string {
  const lines: string[] = [];
  lines.push("# Tour Map");
  lines.push("");
  lines.push(`Generated: ${map.generatedAt}`);
  lines.push("");

  for (const [routeKey, route] of Object.entries(map.routes)) {
    lines.push(`## ${routeKey} (${route.path})`);
    lines.push("");

    if (route.skippedReason) {
      lines.push(`_Skipped_: ${route.skippedReason}`);
      lines.push("");
      continue;
    }

    if (route.anchors.length === 0) {
      lines.push("No anchors found.");
      lines.push("");
      continue;
    }

    const grouped = new Map<string, string[]>();
    for (const anchor of route.anchors) {
      const key = groupAnchor(anchor);
      const bucket = grouped.get(key) ?? [];
      bucket.push(anchor);
      grouped.set(key, bucket);
    }

    for (const [group, anchors] of grouped.entries()) {
      lines.push(`### ${group}`);
      for (const anchor of anchors.sort()) {
        lines.push(`- \`${anchor}\``);
      }
      lines.push("");
    }
  }

  lines.push("## Events");
  lines.push("");
  for (const eventName of map.events) {
    lines.push(`- \`${eventName}\``);
  }
  lines.push("");

  return `${lines.join("\n")}\n`;
}

async function generateMap() {
  dotenv.config({ path: path.resolve(process.cwd(), "tourkit/.env.tourkit") });

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
  const routes = routesConfig.routes as RouteEntry[];
  const events = (eventsConfig.events as Array<{ name: string }>).map((entry) => entry.name);

  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext();
  const page = await context.newPage();

  const output: TourMap = {
    generatedAt: new Date().toISOString(),
    routes: {},
    events,
  };

  const skipped: Array<{ routeKey: string; reason: string }> = [];
  let crawledCount = 0;
  let totalAnchors = 0;

  for (const route of routes) {
    const navigablePath = toNavigablePath(route.path);
    const url = new URL(navigablePath, baseURL).toString();

    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);

      const currentPath = new URL(page.url()).pathname;
      const redirectedToAuth = route.routeKey !== "auth" && currentPath.startsWith("/auth") && !route.path.startsWith("/auth");

      if (redirectedToAuth) {
        const reason = `redirected to auth (${currentPath})`;
        output.routes[route.routeKey] = {
          path: route.path,
          anchors: [],
          skippedReason: reason,
        };
        skipped.push({ routeKey: route.routeKey, reason });
        continue;
      }

      if (response && response.status() >= 400) {
        const reason = `HTTP ${response.status()}`;
        output.routes[route.routeKey] = {
          path: route.path,
          anchors: [],
          skippedReason: reason,
        };
        skipped.push({ routeKey: route.routeKey, reason });
        continue;
      }

      const anchors = await page.$$eval("[data-tour]", (elements) => {
        const values = new Set<string>();
        for (const element of elements) {
          const anchor = element.getAttribute("data-tour");
          if (anchor) values.add(anchor);
        }
        return Array.from(values).sort();
      });

      output.routes[route.routeKey] = {
        path: route.path,
        anchors,
      };

      crawledCount += 1;
      totalAnchors += anchors.length;
    } catch (error) {
      const reason = (error as Error).message;
      output.routes[route.routeKey] = {
        path: route.path,
        anchors: [],
        skippedReason: reason,
      };
      skipped.push({ routeKey: route.routeKey, reason });
    }
  }

  await context.close();
  await browser.close();

  const mapJsonPath = path.resolve(process.cwd(), "tourkit/maps/tour.map.json");
  const mapMdPath = path.resolve(process.cwd(), "tourkit/maps/TOUR_MAP.md");

  fs.mkdirSync(path.dirname(mapJsonPath), { recursive: true });
  fs.writeFileSync(mapJsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  fs.writeFileSync(mapMdPath, buildMapMarkdown(output), "utf8");

  console.log(`Tour map written: ${path.relative(process.cwd(), mapJsonPath)}`);
  console.log(`Tour map doc written: ${path.relative(process.cwd(), mapMdPath)}`);
  console.log(`Routes crawled: ${crawledCount}/${routes.length}`);
  console.log(`Anchors found: ${totalAnchors}`);
  if (skipped.length > 0) {
    console.log("Skipped routes:");
    for (const item of skipped) {
      console.log(`- ${item.routeKey}: ${item.reason}`);
    }
  }
}

generateMap().catch((error) => {
  console.error(`Failed to generate tour map: ${(error as Error).message}`);
  process.exit(1);
});
