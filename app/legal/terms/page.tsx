import { readFileSync } from "fs";
import { join } from "path";
import type { Metadata } from "next";
import { LegalPageView } from "@/components/landing/legal-page-view";
import { markdownToHtml } from "@/lib/server/utils/markdown-to-html";

export const metadata: Metadata = {
  title: "Terms of Service | ViewBait",
  description:
    "ViewBait Terms of Service. By accessing or using ViewBait, you agree to be bound by these Terms.",
};

/**
 * Terms of Service page. Reads app/legal/terms.md, renders markdown to HTML on the server,
 * and passes HTML to the client so ReactMarkdown/remarkGfm are not in the critical path.
 */
export default function TermsPage() {
  const raw = readFileSync(join(process.cwd(), "app/legal/terms.md"), "utf-8");
  const content = raw.replace(/^#\s+.+\n\n?/, "").trim();
  const contentHtml = markdownToHtml(content);

  return <LegalPageView title="Terms of Service" contentHtml={contentHtml} />;
}
