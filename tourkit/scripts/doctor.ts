import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import Ajv from "ajv";

type Status = "PASS" | "WARN" | "FAIL";

type CheckResult = {
  status: Status;
  message: string;
};

type RoutesConfig = { routes?: unknown[] };
type EventsConfig = { events?: Array<{ name?: string }> };
type TourMap = { routes?: Record<string, { anchors?: string[] }> };

function check(condition: boolean, passMessage: string, failMessage: string): CheckResult {
  return {
    status: condition ? "PASS" : "FAIL",
    message: condition ? passMessage : failMessage,
  };
}

function warn(message: string): CheckResult {
  return { status: "WARN", message };
}

function readJsonSafe<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function validateRoutes(filePath: string): CheckResult {
  if (!fs.existsSync(filePath)) {
    return { status: "FAIL", message: "routes.json missing" };
  }

  const data = readJsonSafe<RoutesConfig>(filePath);
  if (!data || !Array.isArray(data.routes)) {
    return { status: "FAIL", message: "routes.json invalid shape" };
  }

  return { status: "PASS", message: "routes.json exists and valid" };
}

function validateEvents(filePath: string): CheckResult {
  if (!fs.existsSync(filePath)) {
    return { status: "FAIL", message: "events.json missing" };
  }

  const data = readJsonSafe<EventsConfig>(filePath);
  if (!data || !Array.isArray(data.events)) {
    return { status: "FAIL", message: "events.json invalid shape" };
  }

  const allNamed = data.events.every((event) => typeof event.name === "string" && event.name.startsWith("tour.event."));
  if (!allNamed) {
    return { status: "FAIL", message: "events.json contains invalid event names" };
  }

  return { status: "PASS", message: "events.json exists and valid" };
}

function validateTourFilesAgainstSchema(toursDir: string, schemaPath: string): CheckResult[] {
  const results: CheckResult[] = [];

  if (!fs.existsSync(toursDir)) {
    results.push(warn("tours directory missing — no tour files to validate"));
    return results;
  }

  if (!fs.existsSync(schemaPath)) {
    results.push({ status: "FAIL", message: "tour schema missing (tourkit/schema/tour.schema.json)" });
    return results;
  }

  const schema = readJsonSafe<object>(schemaPath);
  if (!schema) {
    results.push({ status: "FAIL", message: "tour schema is invalid JSON" });
    return results;
  }

  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);

  const tourFiles = fs
    .readdirSync(toursDir)
    .filter((file) => file.endsWith(".tour.json"))
    .map((file) => path.join(toursDir, file));

  if (tourFiles.length === 0) {
    results.push(warn("no tour files found in /tourkit/tours"));
    return results;
  }

  for (const tourFile of tourFiles) {
    const payload = readJsonSafe<unknown>(tourFile);
    if (!payload) {
      results.push({ status: "FAIL", message: `${path.basename(tourFile)} is not valid JSON` });
      continue;
    }

    const valid = validate(payload);
    if (!valid) {
      const detail = (validate.errors ?? []).map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ");
      results.push({ status: "FAIL", message: `${path.basename(tourFile)} invalid vs schema — ${detail}` });
      continue;
    }

    results.push({ status: "PASS", message: `${path.basename(tourFile)} valid against schema` });
  }

  return results;
}

function validateTourAnchorsExistInMap(toursDir: string, mapPath: string): CheckResult[] {
  if (!fs.existsSync(toursDir)) return [];
  if (!fs.existsSync(mapPath)) return [warn("anchor cross-check skipped (tour.map.json missing)")];

  const mapData = readJsonSafe<TourMap>(mapPath);
  if (!mapData) {
    return [{ status: "FAIL", message: "tour.map.json invalid JSON" }];
  }

  const knownAnchors = new Set(
    Object.values(mapData.routes ?? {})
      .flatMap((route) => route.anchors ?? [])
      .filter((anchor): anchor is string => typeof anchor === "string")
  );

  const tourFiles = fs.readdirSync(toursDir).filter((file) => file.endsWith(".tour.json"));
  const results: CheckResult[] = [];

  for (const file of tourFiles) {
    const payload = readJsonSafe<{ steps?: Array<{ anchor?: string }> }>(path.join(toursDir, file));
    if (!payload || !Array.isArray(payload.steps)) continue;

    const unknown = payload.steps
      .map((step) => step.anchor)
      .filter((anchor): anchor is string => typeof anchor === "string")
      .filter((anchor) => !knownAnchors.has(anchor));

    if (unknown.length === 0) {
      results.push({ status: "PASS", message: `${file} anchors all present in tour map` });
    } else {
      results.push({
        status: "FAIL",
        message: `${file} has unknown anchors: ${Array.from(new Set(unknown)).join(", ")}`,
      });
    }
  }

  return results;
}

function printResult(result: CheckResult): void {
  console.log(`[${result.status}] ${result.message}`);
}

function main(): void {
  console.log("TourKit Doctor");
  console.log("==============");

  const root = process.cwd();
  const tourkitRoot = path.resolve(root, "tourkit");

  const routesPath = path.join(tourkitRoot, "config/routes.json");
  const eventsPath = path.join(tourkitRoot, "config/events.json");
  const mapPath = path.join(tourkitRoot, "maps/tour.map.json");
  const envPath = path.join(tourkitRoot, ".env.tourkit");
  const toursDir = path.join(tourkitRoot, "tours");
  const schemaPath = path.join(tourkitRoot, "schema/tour.schema.json");

  dotenv.config({ path: envPath });

  const results: CheckResult[] = [];
  results.push(validateRoutes(routesPath));
  results.push(validateEvents(eventsPath));

  if (!fs.existsSync(mapPath)) {
    results.push(warn("tour.map.json missing — run: npm run tourkit:map"));
  } else {
    results.push({ status: "PASS", message: "tour.map.json exists" });
  }

  if (fs.existsSync(envPath)) {
    results.push({ status: "PASS", message: ".env.tourkit exists" });
  } else {
    results.push(warn(".env.tourkit missing — copy .env.tourkit.example to .env.tourkit"));
  }
  results.push(check(Boolean(process.env.E2E_EMAIL), "E2E_EMAIL present", "E2E_EMAIL missing — edit tourkit/.env.tourkit"));
  results.push(check(Boolean(process.env.E2E_PASSWORD), "E2E_PASSWORD present", "E2E_PASSWORD missing — edit tourkit/.env.tourkit"));

  try {
    const version = execSync("npx playwright --version", { stdio: "pipe", encoding: "utf8" }).trim();
    results.push({ status: "PASS", message: `Playwright installed (${version})` });
  } catch {
    results.push({ status: "FAIL", message: "Playwright not installed" });
  }

  results.push(...validateTourFilesAgainstSchema(toursDir, schemaPath));
  results.push(...validateTourAnchorsExistInMap(toursDir, mapPath));

  for (const result of results) {
    printResult(result);
  }

  const passCount = results.filter((result) => result.status === "PASS").length;
  const warnCount = results.filter((result) => result.status === "WARN").length;
  const failCount = results.filter((result) => result.status === "FAIL").length;

  console.log(`\n${passCount} passed, ${warnCount} warning${warnCount === 1 ? "" : "s"}, ${failCount} failure${failCount === 1 ? "" : "s"}`);

  process.exit(failCount > 0 ? 1 : 0);
}

main();
