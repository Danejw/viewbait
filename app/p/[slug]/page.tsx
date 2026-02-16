"use client";

/**
 * Shared Project Gallery Page (public, no auth)
 *
 * Displays a project's gallery by share slug. View-only; no edit/delete actions.
 * Layout and branding match Studio and root for consistent brand identity.
 * Refetches periodically so new thumbnails added by the owner appear.
 * Clicking a thumbnail opens ImageModal for full-size view and records the click (approval score).
 * Grid zoom slider: zoom in = fewer columns (larger thumbnails), zoom out = more columns (more thumbnails). Preference persisted in localStorage.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageModal } from "@/components/ui/modal";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { useSharedProjectGallery } from "@/lib/hooks/useProjects";
import { MasonryGrid, type MasonryGridBreakpoints } from "@/components/studio/masonry-grid";
import { GridZoomSlider } from "@/components/studio/grid-zoom-slider";
import { SharedGalleryCard, SharedGalleryCardSkeleton } from "@/components/studio/shared-gallery-card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { recordSharedProjectClick } from "@/lib/services/projects";
import { getMasonryBreakpointCols, DEFAULT_ZOOM_LEVEL } from "@/lib/utils/grid-zoom";
import { useGridZoom } from "@/lib/hooks/useGridZoom";
import type { PublicThumbnailData } from "@/lib/types/database";
import { emitTourEvent } from "@/tourkit/app/tourEvents.browser";

/** Shared gallery header bar: ViewBait brand + back + optional title/zoom. Responsive: on small screens only icons (logo + back), no title text. */
function SharedGalleryHeader({
  projectName,
  subtitle,
  thumbnailsLength,
  zoomLevel,
  onZoomChange,
  showZoom,
}: {
  projectName?: string;
  subtitle?: string;
  thumbnailsLength: number;
  zoomLevel: number;
  onZoomChange: (value: number[]) => void;
  showZoom: boolean;
}) {
  return (
    <header className="border-b border-border bg-card shrink-0">
      <div className="flex h-14 min-h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
            aria-label="ViewBait home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <ViewBaitLogo className="h-4 w-4 text-primary-foreground" variant="white" />
            </div>
            <span className="hidden text-lg font-semibold text-foreground sm:inline">
              View<span className="text-primary">Bait</span>
            </span>
          </Link>
          <div className="h-6 w-px shrink-0 bg-border hidden sm:block" aria-hidden />
          <Button asChild variant="ghost" size="icon" className="shrink-0 h-9 w-9 sm:h-10 sm:w-10">
            <Link href="/" aria-label="Go home">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          {projectName != null && (
            <div className="min-w-0 hidden md:block">
              <h1 className="truncate text-lg font-semibold text-foreground">{projectName}</h1>
              {subtitle != null && (
                <p className="truncate text-sm text-muted-foreground">
                  {subtitle}
                  {thumbnailsLength >= 0 && (
                    <>
                      {" · "}
                      <span className="text-accent font-medium">
                        {thumbnailsLength} image{thumbnailsLength !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
        {showZoom && (
          <GridZoomSlider value={zoomLevel} onValueChange={onZoomChange} />
        )}
      </div>
    </header>
  );
}

export default function SharedProjectGalleryPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : null;
  const { data, canComment, projectId, isLoading, error, refetch } = useSharedProjectGallery(slug);
  const [selectedThumbnail, setSelectedThumbnail] = useState<PublicThumbnailData | null>(null);
  const [zoomLevel, , handleZoomChange] = useGridZoom("shared-gallery-zoom");
  /** One click per 1 second per thumbnail (different thumbnails can be recorded without waiting). */
  const lastRecordedByThumbIdRef = useRef<Record<string, number>>({});
  const CLICK_COOLDOWN_MS = 1000;

  useEffect(() => {
    emitTourEvent("tour.event.route.ready", {
      routeKey: "share.project",
      anchorsPresent: ["tour.share.project.header.container.main", "tour.share.project.grid.thumbnails"],
    });
  }, []);

  /** Open full-size modal and record click (approval score) at most once per 1s per thumbnail. */
  const handleThumbnailClick = useCallback(
    (thumbnail: PublicThumbnailData) => {
      setSelectedThumbnail(thumbnail);
      if (!slug) return;
      const now = Date.now();
      const last = lastRecordedByThumbIdRef.current[thumbnail.id] ?? 0;
      if (now - last >= CLICK_COOLDOWN_MS) {
        lastRecordedByThumbIdRef.current[thumbnail.id] = now;
        void recordSharedProjectClick(slug, thumbnail.id);
      }
    },
    [slug]
  );

  if (!slug) {
    return (
      <div className="flex min-h-screen flex-col bg-background" data-tour="tour.share.project.header.container.main">
        <SharedGalleryHeader
          projectName={undefined}
          subtitle={undefined}
          thumbnailsLength={0}
          zoomLevel={DEFAULT_ZOOM_LEVEL}
          onZoomChange={() => {}}
          showZoom={false}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">Invalid share link.</p>
            <Button asChild variant="link" className="mt-4">
              <Link href="/">Go home</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-background" data-tour="tour.share.project.header.container.main">
        <SharedGalleryHeader
          projectName={undefined}
          subtitle={undefined}
          thumbnailsLength={0}
          zoomLevel={DEFAULT_ZOOM_LEVEL}
          onZoomChange={() => {}}
          showZoom={false}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6">
          <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">{error.message}</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>
              Try again
            </Button>
            <Button asChild variant="link" className="mt-4 ml-2">
              <Link href="/">Go home</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen flex-col bg-background" data-tour="tour.share.project.header.container.main">
        <SharedGalleryHeader
          projectName={undefined}
          subtitle={undefined}
          thumbnailsLength={0}
          zoomLevel={DEFAULT_ZOOM_LEVEL}
          onZoomChange={() => {}}
          showZoom={false}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6 hide-scrollbar">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex items-baseline gap-3">
              <Skeleton className="h-8 w-48 rounded-md" />
              <Skeleton className="h-4 w-20 rounded-md" />
            </div>
            <MasonryGrid
              breakpointCols={getMasonryBreakpointCols(DEFAULT_ZOOM_LEVEL) as MasonryGridBreakpoints}
              gap={12}
              className="w-full"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <SharedGalleryCardSkeleton key={i} />
              ))}
            </MasonryGrid>
          </div>
        </main>
      </div>
    );
  }

  const { projectName, shareMode, thumbnails } = data;
  const subtitle = shareMode === "favorites" ? "Favorites" : "All thumbnails";

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex min-h-screen flex-col bg-background" data-tour="tour.share.project.header.container.main">
        <SharedGalleryHeader
          projectName={projectName}
          subtitle={subtitle}
          thumbnailsLength={thumbnails.length}
          zoomLevel={zoomLevel}
          onZoomChange={handleZoomChange}
          showZoom={thumbnails.length > 0}
        />
        <main className="flex-1 overflow-y-auto bg-muted/30 p-6 hide-scrollbar">
          <div className="mx-auto max-w-6xl">
            {thumbnails.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card py-16 text-center">
                <ImageIcon className="h-12 w-12 text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">
                  {shareMode === "favorites"
                    ? "No favorite thumbnails in this project yet."
                    : "No thumbnails in this project yet."}
                </p>
              </div>
            ) : (
              <>
                <MasonryGrid
                  data-tour="tour.share.project.grid.thumbnails"
                  breakpointCols={getMasonryBreakpointCols(zoomLevel) as MasonryGridBreakpoints}
                  gap={12}
                  className="w-full"
                >
                  {thumbnails.map((thumb) => (
                    <SharedGalleryCard
                      key={thumb.id}
                      thumbnail={thumb}
                      onClick={handleThumbnailClick}
                      canComment={canComment}
                      projectId={projectId}
                      slug={slug}
                      onCommentSuccess={() => void refetch()}
                    />
                  ))}
                </MasonryGrid>
                {selectedThumbnail && (
                  <ImageModal
                    open={selectedThumbnail !== null}
                    onOpenChange={(open) => !open && setSelectedThumbnail(null)}
                    src={selectedThumbnail.image_url}
                    alt={selectedThumbnail.title}
                    title={selectedThumbnail.title}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}
