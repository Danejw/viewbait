/**
 * Performance and network score script.
 * Runs Lighthouse (performance category) per page and outputs per-page scores plus summary.
 * Use:
 *   node scripts/performance-score.js              — score all configured pages (default base http://localhost:3000)
 *   node scripts/performance-score.js [baseUrl]   — score all pages at baseUrl (e.g. http://localhost:3000)
 *   node scripts/performance-score.js [fullUrl]   — score single URL only (legacy; e.g. http://localhost:3000/studio)
 * Prerequisite: Start the app (e.g. npm run dev) before running.
 */

const path = require("path");
const fs = require("fs");

const DEFAULT_BASE_URL = "http://localhost:3000";

/** Pages to score when running in "all pages" mode. Path is relative to base URL. */
const PAGES = [
  { path: "/", label: "Home / Landing" },
  { path: "/studio", label: "Studio" },
  { path: "/studio/assistant", label: "Studio Assistant" },
  { path: "/onboarding", label: "Onboarding" },
  { path: "/auth", label: "Auth" },
  { path: "/auth/forgot-password", label: "Forgot Password" },
  { path: "/auth/reset-password", label: "Reset Password" },
  { path: "/admin", label: "Admin" },
  { path: "/legal/terms", label: "Legal — Terms" },
  { path: "/legal/privacy", label: "Legal — Privacy" },
];

/**
 * Extract key performance metrics from Lighthouse audits.
 * @param {Record<string, { numericValue?: number }>} audits
 * @returns {{ lcp: number | null, fcp: number | null, tbt: number | null, cls: number | null, speedIndex: number | null, tti: number | null }}
 */
function extractPerformanceMetrics(audits) {
  const getMs = (id) => {
    const v = audits[id]?.numericValue;
    return v != null ? Math.round(Number(v)) : null;
  };
  const getCls = () => {
    const v = audits["cumulative-layout-shift"]?.numericValue;
    return v != null ? Number(v) : null;
  };
  return {
    lcp: getMs("largest-contentful-paint"),
    fcp: getMs("first-contentful-paint"),
    tbt: getMs("total-blocking-time"),
    cls: getCls(),
    speedIndex: getMs("speed-index"),
    tti: getMs("interactive"),
  };
}

/**
 * Run Lighthouse for a single URL.
 * @param {string} url
 * @param {import("lighthouse").Flags} options
 * @returns {{ score: number, performance: ReturnType<typeof extractPerformanceMetrics> } | null}
 */
async function runLighthouseForUrl(url, options) {
  const { default: lighthouse } = await import("lighthouse");
  const runnerResult = await lighthouse(url, options);
  const perfCategory = runnerResult?.lhr?.categories?.performance;
  const rawScore = perfCategory?.score;
  if (rawScore == null) return null;
  const score = Math.round(Number(rawScore) * 100);
  const audits = runnerResult.lhr.audits || {};
  const performance = extractPerformanceMetrics(audits);
  return { score, performance };
}

/**
 * Print a simple table row for one page result.
 * @param {{ path: string, label: string, score: number, performance: object }} result
 */
function printRow(result) {
  const { path: pagePath, label, score, performance } = result;
  const lcp = performance.lcp != null ? `${performance.lcp} ms` : "—";
  const fcp = performance.fcp != null ? `${performance.fcp} ms` : "—";
  const tbt = performance.tbt != null ? `${performance.tbt} ms` : "—";
  const cls = performance.cls != null ? performance.cls.toFixed(3) : "—";
  const pad = (s, n) => String(s).padEnd(n);
  console.log(
    [
      pad(score, 4),
      pad(pagePath, 24),
      pad(label, 22),
      pad(lcp, 10),
      pad(fcp, 10),
      pad(tbt, 8),
      pad(cls, 8),
    ].join("  ")
  );
}

/**
 * Read existing score history from JSON file; normalize to { scores: Run[] }.
 * Handles: missing file, legacy single-run shape, legacy all-pages shape, or existing scores array.
 * @param {string} reportPath
 * @returns {{ scores: Array<object> }}
 */
function readScoreHistory(reportPath) {
  if (!fs.existsSync(reportPath)) {
    return { scores: [] };
  }
  try {
    const raw = fs.readFileSync(reportPath, "utf8").trim();
    if (!raw) return { scores: [] };
    const data = JSON.parse(raw);
    if (Array.isArray(data.scores)) {
      return { scores: data.scores };
    }
    // Legacy: file is a single run (has timestamp and either pages+summary or score+url)
    const asRun = data.timestamp != null ? data : null;
    if (asRun) {
      return { scores: [data] };
    }
    return { scores: [] };
  } catch {
    return { scores: [] };
  }
}

/**
 * Append a run to the score history and write back to the file.
 * @param {string} reportPath
 * @param {object} run - One run (single-URL or all-pages shape)
 */
function appendScoreToHistory(reportPath, run) {
  const { scores } = readScoreHistory(reportPath);
  scores.push(run);
  fs.writeFileSync(reportPath, JSON.stringify({ scores }, null, 2), "utf8");
}

/**
 * Determine mode: single URL (one arg that looks like full URL with path) vs all pages.
 * @param {string} [arg]
 * @returns {{ mode: 'single' | 'all', baseUrl: string, singleUrl?: string }}
 */
function parseArgs(arg) {
  const base = arg || DEFAULT_BASE_URL;
  try {
    const u = new URL(base);
    const hasPath = u.pathname && u.pathname !== "/";
    if (hasPath) {
      return { mode: "single", baseUrl: u.origin, singleUrl: base };
    }
    return { mode: "all", baseUrl: base.replace(/\/$/, "") };
  } catch {
    return { mode: "all", baseUrl: base.replace(/\/$/, "") };
  }
}

async function main() {
  const arg = process.argv[2];
  const { mode, baseUrl, singleUrl } = parseArgs(arg);

  const { launch: launchChrome } = await import("chrome-launcher");
  let chrome;
  try {
    chrome = await launchChrome({
      chromeFlags: ["--headless", "--disable-gpu", "--no-sandbox"],
    });
  } catch (err) {
    console.error("Failed to launch Chrome. Is Chrome/Chromium installed?", err.message);
    process.exit(1);
  }

  const options = {
    logLevel: "error",
    onlyCategories: ["performance"],
    port: chrome.port,
    output: "json",
  };

  try {
    if (mode === "single" && singleUrl) {
      const result = await runLighthouseForUrl(singleUrl, options);
      await chrome.kill();
      if (result == null) {
        console.error("Lighthouse did not return a performance score. Is the app running at " + singleUrl + "?");
        process.exit(1);
      }
      const score = result.score;
      console.log("Score:", score);
      console.log("PERFORMANCE_SCORE=" + score);
      const reportDir = path.join(__dirname, "..", "docs", "audits");
      const reportPath = path.join(reportDir, "performance-score.json");
      try {
        if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
        const run = {
          timestamp: new Date().toISOString(),
          baseUrl: new URL(singleUrl).origin,
          mode: "single",
          url: singleUrl,
          score: result.score,
          performance: result.performance,
        };
        appendScoreToHistory(reportPath, run);
      } catch (writeErr) {
        console.error("Could not write report file:", writeErr.message);
      }
      return;
    }

    // Multi-page mode: run each page and collect results
    const results = [];
    for (const { path: pagePath, label } of PAGES) {
      const url = baseUrl + (pagePath === "/" ? "" : pagePath);
      process.stderr.write("Scoring: " + url + " … ");
      const result = await runLighthouseForUrl(url, options);
      if (result == null) {
        process.stderr.write("no score (page may redirect or error)\n");
        results.push({
          path: pagePath,
          label,
          url,
          score: null,
          performance: extractPerformanceMetrics({}),
          error: "No performance score returned",
        });
      } else {
        process.stderr.write(result.score + "\n");
        results.push({
          path: pagePath,
          label,
          url,
          score: result.score,
          performance: result.performance,
        });
      }
    }

    await chrome.kill();

    const withScore = results.filter((r) => r.score != null);
    const scores = withScore.map((r) => r.score);
    const averageScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const minScore = scores.length ? Math.min(...scores) : null;
    const maxScore = scores.length ? Math.max(...scores) : null;
    const worst = withScore.length
      ? withScore.reduce((a, b) => (a.score <= b.score ? a : b))
      : null;

    console.log("\n--- Per-page performance ---");
    console.log(
      [
        "Score".padEnd(4),
        "Path".padEnd(24),
        "Label".padEnd(22),
        "LCP".padEnd(10),
        "FCP".padEnd(10),
        "TBT".padEnd(8),
        "CLS".padEnd(8),
      ].join("  ")
    );
    console.log("-".repeat(100));
    results.forEach((r) => {
      if (r.score != null) printRow(r);
      else console.log("  —   " + r.path.padEnd(24) + "  " + (r.error || "failed"));
    });

    console.log("\n--- Summary ---");
    if (averageScore != null) {
      console.log("Average score:  " + averageScore);
      console.log("Min score:      " + minScore + (worst ? " (" + worst.path + ")" : ""));
      console.log("Max score:      " + maxScore);
      console.log("Pages scored:   " + withScore.length + " / " + results.length);
    } else {
      console.log("No pages could be scored. Is the app running at " + baseUrl + "?");
    }

    console.log("\nPERFORMANCE_SCORE=" + (averageScore != null ? averageScore : ""));

    const reportDir = path.join(__dirname, "..", "docs", "audits");
    const reportPath = path.join(reportDir, "performance-score.json");
    try {
      if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
      const report = {
        timestamp: new Date().toISOString(),
        baseUrl,
        mode: "all",
        pages: results.map((r) => ({
          path: r.path,
          label: r.label,
          url: r.url,
          score: r.score,
          performance: r.performance,
          ...(r.error ? { error: r.error } : {}),
        })),
        summary: {
          averageScore,
          minScore,
          maxScore,
          worstPage: worst ? worst.path : null,
          pagesScored: withScore.length,
          pagesTotal: results.length,
        },
      };
      appendScoreToHistory(reportPath, report);
      console.log("\nReport written to " + reportPath + " (run appended to history)");
    } catch (writeErr) {
      console.error("Could not write report file:", writeErr.message);
    }
  } catch (err) {
    await chrome.kill().catch(() => {});
    console.error("Lighthouse run failed. Is the app running at", baseUrl + "?", err.message);
    process.exit(1);
  }
}

main();
