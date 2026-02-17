import fs from "node:fs";
import path from "node:path";

type TourStep =
  | { type: "say"; message: string }
  | { type: "goto"; routeKey: string }
  | { type: "click"; label: string; anchor: string }
  | { type: "fill"; label: string; anchor: string; value?: string; valueEnv?: string }
  | { type: "waitForEvent"; label: string; name: string; timeoutMs: number }
  | { type: "expectVisible"; label: string; anchor: string; timeoutMs: number }
  | { type: "waitMs"; ms: number }
  | { type: "snapshot"; label: string; name: string };

type TourFile = {
  tourId: string;
  description?: string;
  steps: TourStep[];
};

type RoutesConfig = { routes: Array<{ routeKey: string; path: string }> };
type EventsConfig = { events: Array<{ name: string }> };
type TourMap = {
  routes?: Record<string, { path?: string; anchors?: string[] }>;
};

const DEFAULT_TIMEOUT = 10_000;

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));

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

function nearestMatches(target: string, candidates: string[], max = 3): string[] {
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score:
        candidate.startsWith(target) || target.startsWith(candidate)
          ? 0
          : levenshtein(target.toLowerCase(), candidate.toLowerCase()),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, max)
    .map((item) => item.candidate);

  return ranked;
}

function extractParenValue(input: string): string {
  const match = input.match(/\(([^)]+)\)/);
  if (!match) throw new Error(`Missing (...) machine identifier in line: ${input}`);
  return match[1].trim();
}

function parseTimeout(raw: string | undefined): number {
  if (!raw) return DEFAULT_TIMEOUT;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_TIMEOUT;
}

function parseGuideLines(lines: string[]): TourStep[] {
  const steps: TourStep[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("Say:")) {
      steps.push({ type: "say", message: line.replace(/^Say:\s*/, "") });
      continue;
    }

    if (line.startsWith("Goto routeKey:")) {
      steps.push({ type: "goto", routeKey: line.replace(/^Goto routeKey:\s*/, "").trim() });
      continue;
    }

    if (line.startsWith("Click ")) {
      const anchor = extractParenValue(line);
      const label = line.replace(/^Click\s+/, "").replace(/\s*\([^)]+\)\s*$/, "").trim();
      steps.push({ type: "click", label, anchor });
      continue;
    }

    if (line.startsWith("Fill ")) {
      const anchor = extractParenValue(line);
      const label = line
        .replace(/^Fill\s+/, "")
        .replace(/\s*\([^)]+\)\s*(value|env):.*$/, "")
        .trim();

      const envMatch = line.match(/\senv:([A-Z0-9_]+)/);
      const valueMatch = line.match(/\svalue:(.+)$/);

      if (!envMatch && !valueMatch) {
        throw new Error(`Fill step requires value:<literal> or env:<ENV>. Line: ${line}`);
      }

      steps.push({
        type: "fill",
        label,
        anchor,
        ...(envMatch ? { valueEnv: envMatch[1] } : {}),
        ...(valueMatch ? { value: valueMatch[1].trim() } : {}),
      });
      continue;
    }

    if (line.startsWith("Wait for ")) {
      const name = extractParenValue(line);
      const timeoutMatch = line.match(/\stimeout:(\d+)/);
      const label = line
        .replace(/^Wait for\s+/, "")
        .replace(/\s*\([^)]+\)\s*(timeout:\d+)?\s*$/, "")
        .trim();

      steps.push({ type: "waitForEvent", label, name, timeoutMs: parseTimeout(timeoutMatch?.[1]) });
      continue;
    }

    if (line.startsWith("Expect visible ")) {
      const anchor = extractParenValue(line);
      const timeoutMatch = line.match(/\stimeout:(\d+)/);
      const label = line
        .replace(/^Expect visible\s+/, "")
        .replace(/\s*\([^)]+\)\s*(timeout:\d+)?\s*$/, "")
        .trim();

      steps.push({ type: "expectVisible", label, anchor, timeoutMs: parseTimeout(timeoutMatch?.[1]) });
      continue;
    }

    const waitMatch = line.match(/^Wait\s+(\d+)ms$/);
    if (waitMatch) {
      steps.push({ type: "waitMs", ms: Number(waitMatch[1]) });
      continue;
    }

    if (line.startsWith("Snapshot ")) {
      const nameMatch = line.match(/\sname:([^\s]+)$/);
      const label = line.replace(/^Snapshot\s+/, "").replace(/\sname:[^\s]+\s*$/, "").trim();
      const name = nameMatch?.[1] ?? label;
      steps.push({ type: "snapshot", label, name });
      continue;
    }

    throw new Error(`Unsupported DSL line: ${line}`);
  }

  return steps;
}

function inlineFragments(lines: string[], guidesRoot: string): string[] {
  const out: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith("Include fragment:")) {
      const name = line.replace(/^Include fragment:\s*/, "").trim();
      const fragmentPath = path.join(guidesRoot, "_fragments", `${name}.md`);

      if (!fs.existsSync(fragmentPath)) {
        throw new Error(`Fragment not found: ${name} (${fragmentPath})`);
      }

      const fragmentLines = fs.readFileSync(fragmentPath, "utf8").split(/\r?\n/);
      for (const fragmentLine of fragmentLines) {
        if (fragmentLine.trim().startsWith("#")) continue;
        out.push(fragmentLine);
      }

      continue;
    }

    out.push(rawLine);
  }

  return out;
}

function main(): void {
  const guideArg = process.argv[2];
  if (!guideArg) {
    die("Usage: tsx tourkit/scripts/generate-tour-from-guide.ts <guide-file-path>");
  }

  const guidePath = path.resolve(process.cwd(), guideArg);
  if (!fs.existsSync(guidePath)) {
    die(`Guide file not found: ${guidePath}`);
  }

  const configDir = path.resolve(process.cwd(), "tourkit/config");
  const routes = readJson<RoutesConfig>(path.join(configDir, "routes.json"));
  const events = readJson<EventsConfig>(path.join(configDir, "events.json"));

  const routeKeys = new Set(routes.routes.map((route) => route.routeKey));
  const eventNames = new Set(events.events.map((event) => event.name));

  const rawLines = fs.readFileSync(guidePath, "utf8").split(/\r?\n/);
  const resolvedLines = inlineFragments(rawLines, path.resolve(process.cwd(), "tourkit/guides"));
  const steps = parseGuideLines(resolvedLines);

  const mapPath = path.resolve(process.cwd(), "tourkit/maps/tour.map.json");
  const mapExists = fs.existsSync(mapPath);

  let mapAnchors = new Set<string>();
  if (mapExists) {
    const map = readJson<TourMap>(mapPath);
    mapAnchors = new Set(
      Object.values(map.routes ?? {})
        .flatMap((route) => route.anchors ?? [])
        .filter((anchor): anchor is string => typeof anchor === "string")
    );
  } else {
    console.warn("[WARN] tourkit/maps/tour.map.json not found. Anchor validation skipped. Generate map in Prompt 02C.");
  }

  const errors: string[] = [];

  for (const step of steps) {
    if (step.type === "goto") {
      if (!routeKeys.has(step.routeKey)) {
        const matches = nearestMatches(step.routeKey, Array.from(routeKeys));
        errors.push(`Unknown routeKey "${step.routeKey}". Did you mean: ${matches.join(", ") || "<none>"}`);
      }
    }

    if (step.type === "waitForEvent") {
      if (!eventNames.has(step.name)) {
        const matches = nearestMatches(step.name, Array.from(eventNames));
        errors.push(`Unknown event "${step.name}". Did you mean: ${matches.join(", ") || "<none>"}`);
      }
    }

    if ((step.type === "click" || step.type === "fill" || step.type === "expectVisible") && mapExists) {
      if (!mapAnchors.has(step.anchor)) {
        const matches = nearestMatches(step.anchor, Array.from(mapAnchors));
        errors.push(`Unknown anchor "${step.anchor}". Did you mean: ${matches.join(", ") || "<none>"}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("\nTour generation failed validation:\n");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  const tourId = path.basename(guidePath, path.extname(guidePath));
  const tourFile: TourFile = {
    tourId,
    description: `Generated from guide ${path.basename(guidePath)}`,
    steps,
  };

  const outPath = path.resolve(process.cwd(), `tourkit/tours/${tourId}.tour.json`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(tourFile, null, 2));

  console.log(`Generated tour: ${outPath}`);
  console.log(`Steps: ${steps.length}`);
}

main();
