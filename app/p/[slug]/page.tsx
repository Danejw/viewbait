"use client";

/**
 * Shared Project Gallery Page (public, no auth)
 *
 * Displays a project's gallery by share slug. View-only; no edit/delete actions.
 * Refetches periodically so new thumbnails added by the owner appear.
 */

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSharedProjectGallery } from "@/lib/hooks/useProjects";
import { SharedGalleryCard, SharedGalleryCardSkeleton } from "@/components/studio/shared-gallery-card";

export default function SharedProjectGalleryPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : null;
  const { data, isLoading, error, refetch } = useSharedProjectGallery(slug);

  if (!slug) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">Invalid share link.</p>
          <Button asChild variant="link" className="mt-4">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">{error.message}</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            Try again
          </Button>
          <Button asChild variant="link" className="mt-4 ml-2">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center gap-4">
            <Skeleton className="h-9 w-48 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <SharedGalleryCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const { projectName, shareMode, thumbnails } = data;

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon">
              <Link href="/" aria-label="Go home">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-foreground">{projectName}</h1>
              <p className="text-sm text-muted-foreground">
                {shareMode === "favorites" ? "Favorites" : "All thumbnails"} · {thumbnails.length} image{thumbnails.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </header>

        {thumbnails.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
            <ImageIcon className="h-12 w-12 text-muted-foreground" />
            <p className="mt-2 text-muted-foreground">
              {shareMode === "favorites"
                ? "No favorite thumbnails in this project yet."
                : "No thumbnails in this project yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {thumbnails.map((thumb) => (
              <SharedGalleryCard key={thumb.id} thumbnail={thumb} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
