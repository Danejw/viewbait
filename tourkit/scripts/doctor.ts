import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import dotenv from "dotenv";

interface CheckResult {
  level: "PASS" | "WARN" | "FAIL";
  message: string;
}

interface TourStep {
  type: string;
  anchor?: string;
  name?: string;
}

interface TourDoc {
  tourId?: string;
  steps?: TourStep[];
}

function add(results: CheckResult[], level: CheckResult["level"], message: string): void {
  results.push({ level, message });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateRoutesShape(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (!Array.isArray(value.routes)) return false;
  return value.routes.every((route) => isObject(route) && typeof route.routeKey === "string" && typeof route.path === "string");
}

function validateEventsShape(value: unknown): boolean {
  if (!isObject(value)) return false;
  if (!Array.isArray(value.events)) return false;
  return value.events.every((event) => isObject(event) && typeof event.name === "string");
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function validateTourDoc(doc: TourDoc): string[] {
  const errors: string[] = [];

  if (typeof doc.tourId !== "string" || !/^[a-z][a-z0-9-]*$/.test(doc.tourId)) {
    errors.push("tourId missing or invalid");
  }

  if (!Array.isArray(doc.steps)) {
    errors.push("steps must be an array");
    return errors;
  }

  doc.steps.forEach((step, index) => {
    if (!step || typeof step.type !== "string") {
      errors.push(`step ${index + 1}: missing type`);
      return;
    }

    if (["click", "fill", "expectVisible"].includes(step.type)) {
      if (!step.anchor || !step.anchor.startsWith("tour.")) {
        errors.push(`step ${index + 1}: ${step.type} missing valid anchor`);
      }
    }

    if (step.type === "waitForEvent") {
      if (!step.name || !step.name.startsWith("tour.event.")) {
        errors.push(`step ${index + 1}: waitForEvent missing valid event name`);
      }
    }
  });

  return errors;
}

function collectMapAnchors(mapPath: string): Set<string> {
  const map = readJson(mapPath) as { routes?: Record<string, { anchors?: string[] }> };
  const anchors = new Set<string>();

  for (const route of Object.values(map.routes || {})) {
    for (const anchor of route.anchors || []) anchors.add(anchor);
  }

  return anchors;
}

function runDoctor(): number {
  const results: CheckResult[] = [];
  const root = process.cwd();

  const routesPath = path.resolve(root, "tourkit/config/routes.json");
  const eventsPath = path.resolve(root, "tourkit/config/events.json");
  const mapPath = path.resolve(root, "tourkit/maps/tour.map.json");
  const envPath = path.resolve(root, "tourkit/.env.tourkit");
  const toursDir = path.resolve(root, "tourkit/tours");

  try {
    if (!fs.existsSync(routesPath)) {
      add(results, "FAIL", "routes.json missing — run Prompt 01 first");
    } else if (!validateRoutesShape(readJson(routesPath))) {
      add(results, "FAIL", "routes.json exists but shape is invalid");
    } else {
      add(results, "PASS", "routes.json exists and valid");
    }
  } catch (error) {
    add(results, "FAIL", `routes.json parse failed — ${(error as Error).message}`);
  }

  try {
    if (!fs.existsSync(eventsPath)) {
      add(results, "FAIL", "events.json missing — run Prompt 01 first");
    } else if (!validateEventsShape(readJson(eventsPath))) {
      add(results, "FAIL", "events.json exists but shape is invalid");
    } else {
      add(results, "PASS", "events.json exists and valid");
    }
  } catch (error) {
    add(results, "FAIL", `events.json parse failed — ${(error as Error).message}`);
  }

  if (!fs.existsSync(mapPath)) {
    add(results, "WARN", "tour.map.json missing — run: npm run tourkit:map");
  } else {
    add(results, "PASS", "tour.map.json exists");
  }

  if (!fs.existsSync(envPath)) {
    add(results, "WARN", ".env.tourkit missing — copy .env.tourkit.example to .env.tourkit");
  } else {
    add(results, "PASS", ".env.tourkit exists");
    dotenv.config({ path: envPath });
  }

  if (process.env.E2E_EMAIL) {
    add(results, "PASS", "E2E_EMAIL present");
  } else {
    add(results, "FAIL", "E2E_EMAIL missing — edit tourkit/.env.tourkit");
  }

  if (process.env.E2E_PASSWORD) {
    add(results, "PASS", "E2E_PASSWORD present");
  } else {
    add(results, "FAIL", "E2E_PASSWORD missing — edit tourkit/.env.tourkit");
  }

  try {
    const versionOutput = execSync("npx playwright --version", { stdio: ["ignore", "pipe", "pipe"] })
      .toString()
      .trim();
    add(results, "PASS", `Playwright installed (${versionOutput})`);
  } catch (error) {
    add(results, "FAIL", `Playwright is not installed or not runnable — ${(error as Error).message}`);
  }

  const hasMap = fs.existsSync(mapPath);
  const mapAnchors = hasMap ? collectMapAnchors(mapPath) : new Set<string>();

  const tourFiles = fs.existsSync(toursDir)
    ? fs.readdirSync(toursDir).filter((fileName) => fileName.endsWith(".tour.json"))
    : [];

  if (tourFiles.length === 0) {
    add(results, "WARN", "No tour JSON files found in tourkit/tours/");
  }

  for (const fileName of tourFiles) {
    const fullPath = path.join(toursDir, fileName);
    try {
      const doc = readJson(fullPath) as TourDoc;
      const schemaErrors = validateTourDoc(doc);

      if (schemaErrors.length > 0) {
        add(results, "FAIL", `${fileName} invalid: ${schemaErrors.join("; ")}`);
        continue;
      }

      add(results, "PASS", `${fileName} valid against schema checks`);

      if (hasMap && Array.isArray(doc.steps)) {
        const missingAnchors = doc.steps
          .filter((step) => ["click", "fill", "expectVisible"].includes(step.type))
          .map((step) => step.anchor)
          .filter((anchor): anchor is string => Boolean(anchor) && !mapAnchors.has(anchor));

        if (missingAnchors.length > 0) {
          add(results, "FAIL", `${fileName} references anchors not in map: ${Array.from(new Set(missingAnchors)).join(", " )}`);
        } else {
          add(results, "PASS", `${fileName} anchors found in tour.map.json`);
        }
      }
    } catch (error) {
      add(results, "FAIL", `${fileName} JSON parse failed — ${(error as Error).message}`);
    }
  }

  console.log("TourKit Doctor");
  console.log("==============");
  for (const result of results) {
    console.log(`[${result.level}] ${result.message}`);
  }

  const passCount = results.filter((result) => result.level === "PASS").length;
  const warnCount = results.filter((result) => result.level === "WARN").length;
  const failCount = results.filter((result) => result.level === "FAIL").length;

  console.log();
  console.log(`${passCount} passed, ${warnCount} warnings, ${failCount} failures`);

  return failCount > 0 ? 1 : 0;
}

process.exit(runDoctor());
