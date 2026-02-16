import fs from "node:fs";
import path from "node:path";
import routesConfig from "@/tourkit/config/routes.json";
import eventsConfig from "@/tourkit/config/events.json";

type TourStep =
  | { type: "say"; message: string }
  | { type: "goto"; routeKey: string }
  | { type: "click"; anchor: string; label?: string }
  | { type: "fill"; anchor: string; label?: string; value?: string; valueEnv?: string }
  | { type: "waitForEvent"; name: string; timeoutMs?: number; label?: string }
  | { type: "expectVisible"; anchor: string; timeoutMs?: number; label?: string }
  | { type: "waitMs"; ms: number }
  | { type: "snapshot"; name: string };

interface TourDocument {
  tourId: string;
  description: string;
  steps: TourStep[];
}

interface RouteEntry {
  routeKey: string;
  path: string;
}

interface EventEntry {
  name: string;
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }

  return matrix[a.length][b.length];
}

function nearestMatches(target: string, candidates: string[], limit = 3): string[] {
  return candidates
    .map((candidate) => ({ candidate, score: levenshtein(target, candidate) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

function loadText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function normalizeLine(line: string): string {
  return line.trim();
}

function expandFragmentIncludes(sourceLines: string[]): string[] {
  const out: string[] = [];

  for (const rawLine of sourceLines) {
    const line = normalizeLine(rawLine);
    const includeMatch = line.match(/^Include fragment:\s*([a-zA-Z0-9_-]+)$/);

    if (!includeMatch) {
      out.push(rawLine);
      continue;
    }

    const fragmentName = includeMatch[1];
    const fragmentPath = path.resolve(process.cwd(), `tourkit/guides/_fragments/${fragmentName}.md`);

    if (!fs.existsSync(fragmentPath)) {
      throw new Error(`Fragment not found: ${fragmentPath}`);
    }

    const fragmentLines = loadText(fragmentPath)
      .split(/\r?\n/)
      .filter((fragmentLine) => {
        const trimmed = normalizeLine(fragmentLine);
        if (!trimmed) return false;
        if (trimmed.startsWith("#")) return false;
        return true;
      });

    out.push(...fragmentLines);
  }

  return out;
}

function parseStep(line: string): TourStep | null {
  const trimmed = normalizeLine(line);
  if (!trimmed) return null;
  if (trimmed.startsWith("#")) return null;

  const sayMatch = trimmed.match(/^Say:\s*(.+)$/);
  if (sayMatch) return { type: "say", message: sayMatch[1].trim() };

  const gotoMatch = trimmed.match(/^Goto routeKey:\s*([a-zA-Z0-9._-]+)$/);
  if (gotoMatch) return { type: "goto", routeKey: gotoMatch[1] };

  const clickMatch = trimmed.match(/^Click\s+(.+?)\s+\((tour\.[^)]+)\)$/);
  if (clickMatch) return { type: "click", label: clickMatch[1].trim(), anchor: clickMatch[2].trim() };

  const fillLiteralMatch = trimmed.match(/^Fill\s+(.+?)\s+\((tour\.[^)]+)\)\s+value:(.+)$/);
  if (fillLiteralMatch) {
    return {
      type: "fill",
      label: fillLiteralMatch[1].trim(),
      anchor: fillLiteralMatch[2].trim(),
      value: fillLiteralMatch[3].trim(),
    };
  }

  const fillEnvMatch = trimmed.match(/^Fill\s+(.+?)\s+\((tour\.[^)]+)\)\s+env:([A-Z0-9_]+)$/);
  if (fillEnvMatch) {
    return {
      type: "fill",
      label: fillEnvMatch[1].trim(),
      anchor: fillEnvMatch[2].trim(),
      valueEnv: fillEnvMatch[3].trim(),
    };
  }

  const waitEventMatch = trimmed.match(/^Wait for\s+(.+?)\s+\((tour\.event\.[^)]+)\)(?:\s+timeout:(\d+))?$/);
  if (waitEventMatch) {
    return {
      type: "waitForEvent",
      label: waitEventMatch[1].trim(),
      name: waitEventMatch[2].trim(),
      timeoutMs: waitEventMatch[3] ? Number(waitEventMatch[3]) : 10_000,
    };
  }

  const expectVisibleMatch = trimmed.match(
    /^Expect visible\s+(.+?)\s+\((tour\.[^)]+)\)(?:\s+timeout:(\d+))?$/
  );
  if (expectVisibleMatch) {
    return {
      type: "expectVisible",
      label: expectVisibleMatch[1].trim(),
      anchor: expectVisibleMatch[2].trim(),
      timeoutMs: expectVisibleMatch[3] ? Number(expectVisibleMatch[3]) : 10_000,
    };
  }

  const waitMsMatch = trimmed.match(/^Wait\s+(\d+)ms$/);
  if (waitMsMatch) return { type: "waitMs", ms: Number(waitMsMatch[1]) };

  const snapshotMatch = trimmed.match(/^Snapshot\s+(.+?)(?:\s+name:([a-zA-Z0-9._-]+))?$/);
  if (snapshotMatch) {
    const fallback = snapshotMatch[1].trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    return { type: "snapshot", name: (snapshotMatch[2] || fallback).trim() };
  }

  throw new Error(`Unrecognized guide line: ${line}`);
}

function collectKnownAnchorsFromMap(mapPath: string): Set<string> | null {
  if (!fs.existsSync(mapPath)) return null;

  const rawMap = JSON.parse(loadText(mapPath)) as {
    routes?: Record<string, { anchors?: string[] }>;
  };

  const anchorSet = new Set<string>();
  if (rawMap.routes) {
    for (const route of Object.values(rawMap.routes)) {
      for (const anchor of route.anchors || []) anchorSet.add(anchor);
    }
  }

  return anchorSet;
}

function main() {
  const guideArg = process.argv[2];
  if (!guideArg) {
    console.error("Usage: tsx tourkit/scripts/generate-tour-from-guide.ts <guide-file>");
    process.exit(1);
  }

  const guidePath = path.resolve(process.cwd(), guideArg);
  if (!fs.existsSync(guidePath)) {
    console.error(`Guide file not found: ${guidePath}`);
    process.exit(1);
  }

  const tourId = path.basename(guidePath, path.extname(guidePath));
  const baseLines = loadText(guidePath).split(/\r?\n/);
  const expandedLines = expandFragmentIncludes(baseLines);

  const steps: TourStep[] = [];
  for (const line of expandedLines) {
    const parsed = parseStep(line);
    if (parsed) steps.push(parsed);
  }

  const allRouteKeys = (routesConfig.routes as RouteEntry[]).map((entry) => entry.routeKey);
  const allEventNames = (eventsConfig.events as EventEntry[]).map((entry) => entry.name);

  const mapPath = path.resolve(process.cwd(), "tourkit/maps/tour.map.json");
  const knownAnchors = collectKnownAnchorsFromMap(mapPath);
  if (!knownAnchors) {
    console.warn("[WARN] tourkit/maps/tour.map.json missing. Anchor existence checks skipped.");
  }

  const validationErrors: string[] = [];

  steps.forEach((step, index) => {
    const stepPrefix = `Step ${index + 1} (${step.type})`;

    if (step.type === "goto") {
      if (!allRouteKeys.includes(step.routeKey)) {
        const matches = nearestMatches(step.routeKey, allRouteKeys).join(", ");
        validationErrors.push(`${stepPrefix}: unknown routeKey \"${step.routeKey}\". Did you mean: ${matches}`);
      }
    }

    if (step.type === "waitForEvent") {
      if (!allEventNames.includes(step.name)) {
        const matches = nearestMatches(step.name, allEventNames).join(", ");
        validationErrors.push(`${stepPrefix}: unknown event \"${step.name}\". Did you mean: ${matches}`);
      }
    }

    if (step.type === "click" || step.type === "fill" || step.type === "expectVisible") {
      if (knownAnchors && !knownAnchors.has(step.anchor)) {
        const matches = nearestMatches(step.anchor, Array.from(knownAnchors)).join(", ");
        validationErrors.push(`${stepPrefix}: unknown anchor \"${step.anchor}\". Did you mean: ${matches}`);
      }
    }
  });

  if (validationErrors.length > 0) {
    console.error("Tour generation failed with validation errors:");
    validationErrors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  const output: TourDocument = {
    tourId,
    description: `Generated from ${path.basename(guidePath)}`,
    steps,
  };

  const outputPath = path.resolve(process.cwd(), `tourkit/tours/${tourId}.tour.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Generated tour: ${path.relative(process.cwd(), outputPath)}`);
  console.log(`Steps: ${steps.length}`);
}

main();
