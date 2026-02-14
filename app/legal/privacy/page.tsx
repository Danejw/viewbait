import { readFileSync } from "fs";
import { join } from "path";
import type { Metadata } from "next";
import { LegalPageView } from "@/components/landing/legal-page-view";
import { markdownToHtml } from "@/lib/server/utils/markdown-to-html";

export const metadata: Metadata = {
  title: "Privacy Policy | ViewBait",
  description:
    "ViewBait Privacy Policy. How we collect, use, disclose, and safeguard your information when you use our AI-powered thumbnail generation service.",
};

/**
 * Privacy Policy page. Reads app/legal/privacy.md, renders markdown to HTML on the server,
 * and passes HTML to the client so ReactMarkdown/remarkGfm are not in the critical path.
 */
export default function PrivacyPage() {
  const raw = readFileSync(join(process.cwd(), "app/legal/privacy.md"), "utf-8");
  const content = raw.replace(/^#\s+.+\n\n?/, "").trim();
  const contentHtml = markdownToHtml(content);

  return <LegalPageView title="Privacy Policy" contentHtml={contentHtml} />;
}
