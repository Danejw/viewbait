import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ensureTourArtifactDir } from "@/tests/tour/context";

describe("ensureTourArtifactDir", () => {
  it("recreates only the target tour directory", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "tour-artifacts-"));
    const untouchedTourDir = path.join(root, "other-tour");
    fs.mkdirSync(untouchedTourDir, { recursive: true });
    fs.writeFileSync(path.join(untouchedTourDir, "keep.txt"), "keep");

    const targetDir = path.join(root, "example-tour");
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(path.join(targetDir, "old.txt"), "remove");

    const resolved = ensureTourArtifactDir({ artifactsRoot: root, tourName: "example-tour" });

    expect(resolved).toBe(targetDir);
    expect(fs.existsSync(path.join(targetDir, "old.txt"))).toBe(false);
    expect(fs.existsSync(path.join(untouchedTourDir, "keep.txt"))).toBe(true);
  });
});
