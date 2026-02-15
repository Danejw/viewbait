import { describe, expect, it } from "vitest";
import { stepId, stepTitle, toSlug } from "./tour-runner";

describe("tour runner helpers", () => {
  it("creates deterministic step ids", () => {
    expect(stepId(0)).toBe("01");
    expect(stepId(9)).toBe("10");
  });

  it("creates stable slugs", () => {
    expect(toSlug("Click: Sign In!!!")).toBe("click-sign-in");
    expect(toSlug(" ")).toBe("step");
  });

  it("creates readable step titles", () => {
    expect(stepTitle({ click: { testId: "login-submit" } })).toBe("Click testId:login-submit");
    expect(stepTitle({ say: "Welcome" })).toContain("Narration");
  });
});
