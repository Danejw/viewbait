"use client";

/**
 * StudioViewRoadmap
 * Admin-only view that displays brainstorm markdown docs as the roadmap.
 * Sections: New Features, Content Topics, Marketing Strategy, Technical Solutions.
 * Renders each top-level section (## or #) as a card with labeled subsections (###).
 * Non-admins are redirected to generator.
 */

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useStudio } from "@/components/studio/studio-provider";
import { ViewHeader } from "@/components/studio/view-controls";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** Parsed section: top-level heading (## or #) with title and body. */
export interface RoadmapSection {
  title: string;
  body: string;
}

/**
 * Split markdown into preamble (before first ## or #) and sections (each ## or # block).
 * Section title = first line of the block (heading text); body = rest.
 */
/** Strip leading markdown heading hashes so display titles never show # or ## */
function stripHeadingHashes(text: string): string {
  return text.replace(/^#+\s*/, "").trim();
}

export function parseRoadmapSections(markdown: string): { preamble: string; sections: RoadmapSection[] } {
  // Normalize line endings so splits and regex match correctly (avoids \r\n leaving \r before ##)
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const trimmed = normalized.trim();
  if (!trimmed) return { preamble: "", sections: [] };

  // Split on newline followed by ## or # (at start of line)
  const parts = trimmed.split(/\n(?=#{1,2}\s)/);

  const firstPart = parts[0] ?? "";
  const preamble = firstPart.startsWith("#") ? "" : firstPart.trim();
  const sectionBlocks = firstPart.startsWith("#") ? parts : parts.slice(1);

  const sections: RoadmapSection[] = [];

  for (const block of sectionBlocks) {
    if (!block.trim()) continue;
    // Remove leading # or ## and optional space to get the heading line; fallback to first line if regex doesn't match
    const firstLineMatch = block.match(/^#+\s+(.+?)(?:\n|$)/);
    const rawTitle = firstLineMatch ? firstLineMatch[1].trim() : block.split("\n")[0]?.trim() ?? "";
    const title = stripHeadingHashes(rawTitle);
    const bodyStart = block.indexOf("\n");
    const body = bodyStart >= 0 ? block.slice(bodyStart + 1).trim() : "";

    if (title) {
      sections.push({ title, body });
    }
  }

  return { preamble, sections };
}

export const ROADMAP_DOCS = [
  { slug: "new_features", label: "New Features" },
  { slug: "content_topics", label: "Content Topics" },
  { slug: "marketing_strategy", label: "Marketing Strategy" },
  { slug: "technical_solutions", label: "Technical Solutions" },
] as const;

type RoadmapDocSlug = (typeof ROADMAP_DOCS)[number]["slug"];

export default function StudioViewRoadmap() {
  const { isAdmin, isLoading } = useUserRole();
  const { actions: { setView } } = useStudio();
  const [activeTab, setActiveTab] = useState<RoadmapDocSlug>("new_features");
  const [contentByDoc, setContentByDoc] = useState<Partial<Record<RoadmapDocSlug, string>>>({});
  const [loadingByDoc, setLoadingByDoc] = useState<Partial<Record<RoadmapDocSlug, boolean>>>({});
  const [errorByDoc, setErrorByDoc] = useState<Partial<Record<RoadmapDocSlug, string | null>>>({});

  const fetchDoc = useCallback((doc: RoadmapDocSlug) => {
    if (contentByDoc[doc] != null) return;
    setLoadingByDoc((prev) => ({ ...prev, [doc]: true }));
    setErrorByDoc((prev) => ({ ...prev, [doc]: null }));

    fetch(`/api/admin/roadmap?doc=${encodeURIComponent(doc)}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 403 ? "Forbidden" : "Failed to load");
        return res.json();
      })
      .then((data: { content?: string }) => {
        if (typeof data?.content === "string") {
          setContentByDoc((prev) => ({ ...prev, [doc]: data.content }));
        } else {
          setErrorByDoc((prev) => ({ ...prev, [doc]: "Invalid response" }));
        }
      })
      .catch((err) => {
        setErrorByDoc((prev) => ({ ...prev, [doc]: err instanceof Error ? err.message : "Failed to load" }));
      })
      .finally(() => {
        setLoadingByDoc((prev) => ({ ...prev, [doc]: false }));
      });
  }, [contentByDoc]);

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      setView("generator");
    }
  }, [isAdmin, isLoading, setView]);

  useEffect(() => {
    if (!isAdmin) return;
    fetchDoc(activeTab);
  }, [isAdmin, activeTab, fetchDoc]);

  if (isLoading || !isAdmin) {
    return (
      <div>
        <ViewHeader title="Roadmap" description="Brainstorms and roadmap docs." />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground text-sm">Access denied. Admin role required.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <ViewHeader
        title="Roadmap"
        description="Brainstorms and roadmap docs."
      />
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RoadmapDocSlug)} className="flex flex-1 flex-col gap-4 min-h-0 min-w-0">
        <TabsList variant="line" className="flex w-full max-w-full shrink-0 flex-nowrap overflow-x-auto hide-scrollbar">
          {ROADMAP_DOCS.map(({ slug, label }) => (
            <TabsTrigger
              key={slug}
              value={slug}
              className="shrink-0 px-2 text-xs sm:px-3 sm:text-sm hover:text-primary data-[state=active]:after:bg-primary"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {ROADMAP_DOCS.map(({ slug }) => (
          <TabsContent key={slug} value={slug} className="mt-0 flex-1 min-h-0 flex flex-col data-[state=inactive]:hidden">
            <RoadmapTabPanel
              doc={slug}
              content={contentByDoc[slug]}
              loading={loadingByDoc[slug]}
              error={errorByDoc[slug]}
              onRetry={() => fetchDoc(slug)}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/** Prose: titles stay strong (foreground), descriptions/values use a lighter gray; descriptions indented under headers; responsive indent */
const proseClasses = cn(
  "prose prose-sm dark:prose-invert max-w-none",
  "[&_p]:my-2.5 [&_p]:text-foreground/60 [&_p]:leading-relaxed [&_p]:text-[15px] [&_p]:pl-3 [&_p]:sm:pl-5",
  "[&_ul]:my-3 [&_ul]:text-foreground/60 [&_ul]:text-[15px] [&_ul]:pl-3 [&_ul]:sm:pl-5 [&_li]:my-1.5 [&_li]:leading-relaxed",
  "[&_ol]:my-3 [&_ol]:text-foreground/60 [&_ol]:text-[15px] [&_ol]:pl-3 [&_ol]:sm:pl-5 [&_ol_li]:my-1.5 [&_ol_li]:leading-relaxed",
  "[&_strong]:text-foreground [&_strong]:font-semibold [&_b]:text-foreground",
  "[&_pre]:my-2 [&_pre]:rounded-lg [&_pre]:bg-muted/60 [&_pre]:p-3 [&_pre]:overflow-x-auto [&_pre]:text-foreground/55 [&_pre]:text-xs [&_pre]:pl-3 [&_pre]:sm:pl-5",
  "[&_code]:text-xs",
  "[&_table]:w-full [&_table]:min-w-0 [&_table]:text-sm [&_table]:ml-3 [&_table]:sm:ml-5",
  "[&_th]:border [&_th]:border-border [&_th]:bg-muted/50 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground",
  "[&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2.5 [&_td]:text-foreground/60 [&_td]:leading-relaxed",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:opacity-90"
);

/** Prose for preamble only: doc title (h1) strong, rest muted */
const preambleProseClasses = cn(
  proseClasses,
  "[&_h1]:!text-lg [&_h1]:!font-semibold [&_h1]:!text-foreground [&_h1]:!mb-3 [&_h1]:!mt-0"
);

const markdownComponents = {
  code({ className, children, ...props }: { className?: string; children?: React.ReactNode }) {
    const isBlock = className?.startsWith("language-");
    return isBlock ? (
      <code className={cn("block text-xs text-muted-foreground", className)} {...props}>
        {children}
      </code>
    ) : (
      <code className="rounded bg-muted/80 px-1.5 py-0.5 text-xs text-foreground" {...props}>
        {children}
      </code>
    );
  },
  h1({ children }: { children?: React.ReactNode }) {
    return (
      <div className="mb-3 mt-0">
        <span className="text-lg font-semibold text-foreground">{children}</span>
      </div>
    );
  },
  h2({ children }: { children?: React.ReactNode }) {
    return (
      <div className="mt-6 pt-4 border-t border-border first:mt-0 first:pt-0 first:border-t-0">
        <span className="text-sm font-semibold text-foreground tracking-tight">
          {children}
        </span>
      </div>
    );
  },
  h3({ children }: { children?: React.ReactNode }) {
    return (
      <div className="mt-4 pt-2 border-l-2 border-primary/40 pl-3 first:mt-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/90">
          {children}
        </span>
      </div>
    );
  },
  table({ children, ...props }: { children?: React.ReactNode }) {
    return (
      <div className="my-4 w-full max-w-full overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
        <table className="w-full min-w-0 text-sm border-collapse" {...props}>
          {children}
        </table>
      </div>
    );
  },
};

function RoadmapTabPanel({
  doc,
  content,
  loading,
  error,
  onRetry,
}: {
  doc: RoadmapDocSlug;
  content: string | undefined;
  loading: boolean | undefined;
  error: string | null | undefined;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <Card className="flex-1 flex items-center justify-center">
        <CardContent className="py-12">
          <p className="text-muted-foreground">Loading…</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="flex-1 flex items-center justify-center">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-2">
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (content == null || content === "") {
    return (
      <Card className="flex-1 flex items-center justify-center">
        <CardContent className="py-12">
          <p className="text-muted-foreground text-sm">No content.</p>
        </CardContent>
      </Card>
    );
  }

  const { preamble, sections } = parseRoadmapSections(content);

  return (
    <ScrollArea className="flex-1 min-w-0 pr-2 sm:pr-4">
      <article className="w-full max-w-3xl min-w-0 mx-auto pb-8 space-y-6">
        {preamble ? (
          <Card className="bg-muted/20 border-border">
            <CardContent className="px-4 pt-6 pb-6 sm:px-6">
              <div className={preambleProseClasses}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {preamble}
                </ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {sections.map((section, index) => (
          <Card key={`${section.title}-${index}`} className="overflow-hidden border-border">
            <CardHeader className="pb-2 pt-5 px-4 sm:px-6">
              <CardTitle className="text-[15px] font-semibold leading-snug text-foreground">
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-5 px-4 sm:px-6">
              {section.body ? (
                <div className={cn(proseClasses, "min-w-0")}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                    {section.body}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">—</p>
              )}
            </CardContent>
          </Card>
        ))}
      </article>
    </ScrollArea>
  );
}
