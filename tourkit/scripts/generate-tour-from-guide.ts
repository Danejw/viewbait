import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";

type TourStep =
  | { type: "say"; text: string }
  | { type: "goto"; routeKey: string }
  | { type: "click"; anchor: string }
  | { type: "fill"; anchor: string; value?: string; valueEnv?: string }
  | { type: "expectVisible"; anchor: string }
  | { type: "waitForEvent"; name: string; timeoutMs?: number }
  | { type: "waitMs"; durationMs: number }
  | { type: "snapshot"; name: string };

type Tour = { id: string; title?: string; steps: TourStep[] };

type TourMap = {
  routes: Record<string, { path: string; anchors: string[] }>;
  events: string[];
};

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => Array.from<number>({ length: b.length + 1 }));
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function nearest(value: string, universe: string[], max = 3): string[] {
  return [...universe]
    .sort((a, b) => levenshtein(value, a) - levenshtein(value, b))
    .slice(0, max);
}

function parseAnchor(line: string): string | null {
  const match = line.match(/\((tour\.[^)]+)\)/);
  return match?.[1] ?? null;
}

function parseEvent(line: string): string | null {
  const match = line.match(/\((tour\.event\.[^)]+)\)/);
  return match?.[1] ?? null;
}

function parseTourStep(line: string): TourStep {
  if (line.startsWith("Say:")) {
    return { type: "say", text: line.replace(/^Say:\s*/, "").trim() };
  }

  if (line.startsWith("Goto routeKey:")) {
    return { type: "goto", routeKey: line.replace(/^Goto routeKey:\s*/, "").trim() };
  }

  if (line.startsWith("Click ")) {
    const anchor = parseAnchor(line);
    if (!anchor) {
      throw new Error(`Click step missing anchor. Use: Click <label> (tour....)\nLine: ${line}`);
    }
    return { type: "click", anchor };
  }

  if (line.startsWith("Fill ")) {
    const anchor = parseAnchor(line);
    if (!anchor) {
      throw new Error(`Fill step missing anchor. Use: Fill <label> (tour....) env:E2E_EMAIL\nLine: ${line}`);
    }
    const envMatch = line.match(/\benv:([A-Z0-9_]+)/);
    const valueMatch = line.match(/\bvalue:(.+)$/);
    if (!envMatch && !valueMatch) {
      throw new Error(`Fill step missing value or env. Use env:VAR or value:text\nLine: ${line}`);
    }

    return {
      type: "fill",
      anchor,
      valueEnv: envMatch?.[1],
      value: valueMatch?.[1]?.trim(),
    };
  }

  if (/^Expect\s+visible\s+/i.test(line)) {
    const anchor = parseAnchor(line);
    if (!anchor) {
      throw new Error(`Expect visible step missing anchor.\nLine: ${line}`);
    }
    return { type: "expectVisible", anchor };
  }

  if (line.startsWith("Wait for ")) {
    const eventName = parseEvent(line);
    if (!eventName) {
      throw new Error(`Wait for step missing event. Use: Wait for <name> (tour.event....) timeout:30000\nLine: ${line}`);
    }
    const timeout = line.match(/\btimeout:(\d+)/);
    return {
      type: "waitForEvent",
      name: eventName,
      timeoutMs: timeout ? Number(timeout[1]) : undefined,
    };
  }

  if (line.startsWith("Wait ms:")) {
    const value = Number(line.replace(/^Wait ms:\s*/, "").trim());
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Wait ms must be > 0.\nLine: ${line}`);
    }
    return { type: "waitMs", durationMs: value };
  }

  if (line.startsWith("Snapshot ")) {
    const nameMatch = line.match(/\bname:([a-zA-Z0-9._-]+)/);
    if (!nameMatch) {
      throw new Error(`Snapshot step missing name:<value>.\nLine: ${line}`);
    }
    return { type: "snapshot", name: nameMatch[1] };
  }

  throw new Error(`Unsupported DSL line.\nLine: ${line}`);
}

function validateTour(tour: Tour): void {
  for (const step of tour.steps) {
    if ((step.type === "click" || step.type === "fill" || step.type === "expectVisible") && !step.anchor.startsWith("tour.")) {
      throw new Error(`Anchor must start with 'tour.': ${step.anchor}`);
    }
    if (step.type === "waitForEvent" && !step.name.startsWith("tour.event.")) {
      throw new Error(`Event must start with 'tour.event.': ${step.name}`);
    }
  }
}

function run(): void {
  const guideArg = process.argv[2];
  const guidePath = resolve(process.cwd(), guideArg ?? "tourkit/guides/first-thumbnail.md");
  const guideName = basename(guidePath, ".md");

  const mapPath = resolve(process.cwd(), "tourkit/maps/tour.map.json");
  const map = JSON.parse(readFileSync(mapPath, "utf8")) as TourMap;
  const knownAnchors = new Set(Object.values(map.routes).flatMap((route) => route.anchors));
  const knownEvents = new Set(map.events);

  const source = readFileSync(guidePath, "utf8");
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  const steps = lines.map(parseTourStep);
  const tour: Tour = {
    id: guideName,
    title: guideName,
    steps,
  };

  validateTour(tour);

  const unknownAnchors = new Set<string>();
  const unknownEvents = new Set<string>();

  for (const step of tour.steps) {
    if (step.type === "click" || step.type === "fill" || step.type === "expectVisible") {
      if (!knownAnchors.has(step.anchor)) unknownAnchors.add(step.anchor);
    }
    if (step.type === "waitForEvent") {
      if (!knownEvents.has(step.name)) unknownEvents.add(step.name);
    }
  }

  if (unknownAnchors.size > 0 || unknownEvents.size > 0) {
    const allAnchors = [...knownAnchors];
    const allEvents = [...knownEvents];
    const errors: string[] = [];

    for (const anchor of unknownAnchors) {
      errors.push(`Unknown anchor: ${anchor}`);
      errors.push(`Nearest: ${nearest(anchor, allAnchors).join(", ")}`);
    }

    for (const eventName of unknownEvents) {
      errors.push(`Unknown event: ${eventName}`);
      errors.push(`Nearest: ${nearest(eventName, allEvents).join(", ")}`);
    }

    throw new Error(errors.join("\n"));
  }

  const outDir = resolve(process.cwd(), "tourkit/tours");
  mkdirSync(outDir, { recursive: true });
  const outputPath = resolve(outDir, `${guideName}.tour.json`);
  writeFileSync(outputPath, `${JSON.stringify(tour, null, 2)}\n`);
  console.log(`[tourkit:gen] wrote ${outputPath}`);
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[tourkit:gen] failed: ${message}`);
  process.exit(1);
}
