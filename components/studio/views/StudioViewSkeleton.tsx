"use client";

/**
 * StudioViewSkeleton
 * Minimal fallback for Suspense while a lazy Studio view chunk loads.
 * Keeps layout stable (main panel area) without view-specific UI.
 */

import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

export function StudioViewSkeleton() {
  return (
    <div className="flex min-h-[320px] flex-col gap-6 p-6" aria-busy="true" aria-label="Loading view">
      <div className="flex items-center justify-center gap-3">
        <Spinner className="h-6 w-6 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
      <div className="flex flex-1 flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid grid-cols-3 gap-4 pt-4">
          <Skeleton className="aspect-video rounded-lg" />
          <Skeleton className="aspect-video rounded-lg" />
          <Skeleton className="aspect-video rounded-lg" />
        </div>
      </div>
    </div>
  );
}
