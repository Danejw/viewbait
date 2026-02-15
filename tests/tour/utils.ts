import type { TourManifest } from "@/tests/tour/types";

export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function formatTourMarkdown(manifest: TourManifest): string {
  const lines = [
    `# Onboarding Tour Script: ${manifest.tourName}`,
    "",
    `Generated: ${manifest.generatedAt}`,
    "",
  ];

  for (const step of manifest.steps) {
    lines.push(`## ${step.id} — ${step.title}`);
    lines.push("");
    lines.push(step.narration);
    lines.push("");
    lines.push(`- Screenshot: \`${step.screenshot}\``);
    lines.push(`- Timestamp: ${step.timestamp}`);
    if (typeof step.durationMs === "number") {
      lines.push(`- Duration (ms): ${step.durationMs}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
