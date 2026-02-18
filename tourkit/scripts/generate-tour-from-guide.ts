import fs from "node:fs";
import path from "node:path";

type StepMetadata = {
  preDelayMs?: number;
  narration?: string;
  capture?: { when: "before" | "after"; name: string; fullPage?: boolean };
  annotate?: { targetScreenshot?: string; instructions: string; style?: string; notes?: string };
};

type TourStepBase = StepMetadata & {
  label?: string;
  timeoutMs?: number;
};

type TourStep =
  | (TourStepBase & { type: "narration" | "say"; message: string })
  | (TourStepBase & { type: "goto"; routeKey: string })
  | (TourStepBase & { type: "click"; anchor: string })
  | (TourStepBase & { type: "fill"; anchor: string; value?: string; valueEnv?: string })
  | (TourStepBase & { type: "waitForEvent"; name: string; timeoutMs: number })
  | (TourStepBase & { type: "expectVisible"; anchor: string; timeoutMs: number })
  | (TourStepBase & { type: "waitMs"; durationMs: number })
  | (TourStepBase & { type: "screenshot" | "snapshot"; name: string; fullPage?: boolean })
  | (TourStepBase & {
      type: "annotate";
      targetScreenshot?: string;
      instructions: string;
      style?: string;
      notes?: string;
    });

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
const INTRO_BY_TOUR: Record<string, string> = {
  "title-custom-instructions-tips":
    "Welcome! In this quick tour, we'll compare thumbnail titles with and without subtitles, then use custom instructions to make results more relevant to your video context.",
};

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
  return candidates
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

function extractQuoted(text: string): string {
  const trimmed = text.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitBaseAndModifiers(line: string): { base: string; meta: StepMetadata } {
  const parts = line.split(" |").map((part) => part.trim());
  const base = parts[0]?.trim() ?? line;
  const meta: StepMetadata = {};

  for (const raw of parts.slice(1)) {
    if (!raw) continue;

    if (raw.startsWith("predelay:")) {
      const n = Number(raw.replace(/^predelay:/, "").trim());
      if (Number.isFinite(n) && n >= 0) meta.preDelayMs = n;
      continue;
    }

    if (raw.startsWith("narration:")) {
      meta.narration = extractQuoted(raw.replace(/^narration:/, ""));
      continue;
    }

    if (raw.startsWith("capture:")) {
      const m = raw.match(/^capture:(before|after):([^:]+)(?::fullPage=(true|false))?$/i);
      if (m) {
        meta.capture = {
          when: m[1].toLowerCase() as "before" | "after",
          name: m[2].trim(),
          ...(m[3] ? { fullPage: m[3].toLowerCase() === "true" } : {}),
        };
      }
      continue;
    }

    if (raw.startsWith("annotate:")) {
      meta.annotate = { instructions: extractQuoted(raw.replace(/^annotate:/, "")) };
      continue;
    }
  }

  return { base, meta };
}

function parseGuideLines(lines: string[]): TourStep[] {
  const steps: TourStep[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const { base, meta } = splitBaseAndModifiers(line);

    if (base.startsWith("Narration:")) {
      steps.push({ type: "narration", message: base.replace(/^Narration:\s*/, ""), ...meta });
      continue;
    }

    if (base.startsWith("Say:")) {
      steps.push({ type: "narration", message: base.replace(/^Say:\s*/, ""), ...meta });
      continue;
    }

    if (base.startsWith("Goto routeKey:")) {
      steps.push({ type: "goto", routeKey: base.replace(/^Goto routeKey:\s*/, "").trim(), ...meta });
      continue;
    }

    if (base.startsWith("Click ")) {
      const anchor = extractParenValue(base);
      const label = base.replace(/^Click\s+/, "").replace(/\s*\([^)]+\)\s*$/, "").trim();
      steps.push({ type: "click", label, anchor, ...meta });
      continue;
    }

    if (base.startsWith("Fill ")) {
      const anchor = extractParenValue(base);
      const label = base
        .replace(/^Fill\s+/, "")
        .replace(/\s*\([^)]+\)\s*(value|env):.*$/, "")
        .trim();

      const envMatch = base.match(/\senv:([A-Z0-9_]+)/);
      const valueMatch = base.match(/\svalue:(.+)$/);

      if (!envMatch && !valueMatch) {
        throw new Error(`Fill step requires value:<literal> or env:<ENV>. Line: ${base}`);
      }

      steps.push({
        type: "fill",
        label,
        anchor,
        ...(envMatch ? { valueEnv: envMatch[1] } : {}),
        ...(valueMatch ? { value: valueMatch[1].trim() } : {}),
        ...meta,
      });
      continue;
    }

    if (base.startsWith("Wait for ")) {
      const name = extractParenValue(base);
      const timeoutMatch = base.match(/\stimeout:(\d+)/);
      const label = base
        .replace(/^Wait for\s+/, "")
        .replace(/\s*\([^)]+\)\s*(timeout:\d+)?\s*$/, "")
        .trim();

      steps.push({
        type: "waitForEvent",
        label,
        name,
        timeoutMs: parseTimeout(timeoutMatch?.[1]),
        ...meta,
      });
      continue;
    }

    if (base.startsWith("Expect visible ")) {
      const anchor = extractParenValue(base);
      const timeoutMatch = base.match(/\stimeout:(\d+)/);
      const label = base
        .replace(/^Expect visible\s+/, "")
        .replace(/\s*\([^)]+\)\s*(timeout:\d+)?\s*$/, "")
        .trim();

      steps.push({
        type: "expectVisible",
        label,
        anchor,
        timeoutMs: parseTimeout(timeoutMatch?.[1]),
        ...meta,
      });
      continue;
    }

    const waitMatch = base.match(/^Wait\s+(\d+)ms$/);
    if (waitMatch) {
      steps.push({ type: "waitMs", durationMs: Number(waitMatch[1]), ...meta });
      continue;
    }

    if (base.startsWith("Screenshot ")) {
      const nameMatch = base.match(/\sname:([^\s]+)$/);
      const fullPageMatch = base.match(/\sfullPage:(true|false)$/);
      const label = base
        .replace(/^Screenshot\s+/, "")
        .replace(/\sname:[^\s]+\s*(fullPage:(true|false))?\s*$/, "")
        .trim();
      const name = nameMatch?.[1] ?? label;

      steps.push({
        type: "screenshot",
        label,
        name,
        ...(fullPageMatch ? { fullPage: fullPageMatch[1] === "true" } : {}),
        ...meta,
      });
      continue;
    }

    if (base.startsWith("Snapshot ")) {
      const nameMatch = base.match(/\sname:([^\s]+)$/);
      const label = base.replace(/^Snapshot\s+/, "").replace(/\sname:[^\s]+\s*$/, "").trim();
      const name = nameMatch?.[1] ?? label;
      steps.push({ type: "screenshot", label, name, ...meta });
      continue;
    }

    if (base.startsWith("Annotate ")) {
      const targetMatch = base.match(/\starget:([^\s]+)\s/);
      const instructionsMatch = base.match(/\sinstructions:(.+)$/);
      if (!instructionsMatch) {
        throw new Error(`Annotate step requires instructions:<text>. Line: ${base}`);
      }

      const label = base
        .replace(/^Annotate\s+/, "")
        .replace(/\starget:[^\s]+\s+instructions:.+$/, "")
        .replace(/\sinstructions:.+$/, "")
        .trim();

      steps.push({
        type: "annotate",
        label,
        ...(targetMatch ? { targetScreenshot: targetMatch[1] } : {}),
        instructions: instructionsMatch[1].trim(),
        ...meta,
      });
      continue;
    }

    throw new Error(`Unsupported DSL line: ${base}`);
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

function ensureIntroStep(tourId: string, steps: TourStep[]): TourStep[] {
  if (steps.length > 0 && (steps[0].type === "narration" || steps[0].type === "say")) {
    return steps;
  }

  const message =
    INTRO_BY_TOUR[tourId] ??
    "Welcome! In this quick tour we'll walk through this workflow step by step and highlight the most important controls and outcomes.";

  return [{ type: "narration", message }, ...steps];
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
  let steps = parseGuideLines(resolvedLines);

  const tourId = path.basename(guidePath, path.extname(guidePath));
  steps = ensureIntroStep(tourId, steps);

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
