import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(__dirname, "..");
const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".next",
  "coverage",
  "node_modules",
  "out",
]);
const SECRET_PATTERNS = [
  {
    name: "Supabase access token",
    pattern: /sbp_[A-Za-z0-9]+/,
  },
];

function collectFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    const relativePath = path.relative(REPO_ROOT, fullPath);

    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }

    const stats = lstatSync(fullPath);
    if (stats.isSymbolicLink()) {
      return [];
    }

    if (stats.isDirectory()) {
      return collectFiles(fullPath);
    }

    if (!stats.isFile() || stats.size > 500_000) {
      return [];
    }

    return [relativePath];
  });
}

describe("committed secrets", () => {
  it("does not include Supabase access tokens in committed text files", () => {
    const findings = collectFiles(REPO_ROOT).flatMap((relativePath) => {
      const fullPath = path.join(REPO_ROOT, relativePath);
      if (!existsSync(fullPath)) {
        return [];
      }

      const contents = readFileSync(fullPath, "utf8");
      return SECRET_PATTERNS.filter(({ pattern }) => pattern.test(contents)).map(
        ({ name }) => `${name}: ${relativePath}`
      );
    });

    expect(findings).toEqual([]);
  });
});
