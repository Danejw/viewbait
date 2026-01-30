import { readFileSync } from "fs";
import { join } from "path";
import type { Metadata } from "next";
import { LegalPageView } from "@/components/landing/legal-page-view";

export const metadata: Metadata = {
  title: "Privacy Policy | ViewBait",
  description:
    "ViewBait Privacy Policy. How we collect, use, disclose, and safeguard your information when you use our AI-powered thumbnail generation service.",
};

/**
 * Privacy Policy page. Reads app/legal/privacy.md and renders it with the landing design.
 */
export default function PrivacyPage() {
  const raw = readFileSync(join(process.cwd(), "app/legal/privacy.md"), "utf-8");
  const content = raw.replace(/^#\s+.+\n\n?/, "").trim();

  return <LegalPageView title="Privacy Policy" content={content} />;
}
