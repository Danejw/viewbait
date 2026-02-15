import { describe, expect, it } from "vitest";
import { formatTourMarkdown, slugifyTitle } from "@/tests/tour/utils";

describe("slugifyTitle", () => {
  it("creates deterministic lowercase slugs", () => {
    expect(slugifyTitle("Open Home")).toBe("open-home");
    expect(slugifyTitle("Navigate to X!")).toBe("navigate-to-x");
  });

  it("collapses separators and trims edges", () => {
    expect(slugifyTitle("  Step --- 01  ")).toBe("step-01");
  });
});

describe("formatTourMarkdown", () => {
  it("builds a narration script aligned to step order", () => {
    const markdown = formatTourMarkdown({
      tourName: "example-onboarding",
      generatedAt: "2026-01-01T00:00:00.000Z",
      steps: [
        {
          id: "01",
          title: "Open Home",
          narration: "We start on the landing page.",
          screenshot: "01-open-home.png",
          timestamp: "2026-01-01T00:00:10.000Z",
          durationMs: 1200,
        },
      ],
    });

    expect(markdown).toContain("# Onboarding Tour Script: example-onboarding");
    expect(markdown).toContain("## 01 — Open Home");
    expect(markdown).toContain("We start on the landing page.");
    expect(markdown).toContain("Screenshot: `01-open-home.png`");
  });
});
