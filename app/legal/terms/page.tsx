import { readFileSync } from "fs";
import { join } from "path";
import type { Metadata } from "next";
import { LegalPageView } from "@/components/landing/legal-page-view";

export const metadata: Metadata = {
  title: "Terms of Service | ViewBait",
  description:
    "ViewBait Terms of Service. By accessing or using ViewBait, you agree to be bound by these Terms.",
};

/**
 * Terms of Service page. Reads app/legal/terms.md and renders it with the landing design.
 */
export default function TermsPage() {
  const raw = readFileSync(join(process.cwd(), "app/legal/terms.md"), "utf-8");
  const content = raw.replace(/^#\s+.+\n\n?/, "").trim();

  return <LegalPageView title="Terms of Service" content={content} />;
}
