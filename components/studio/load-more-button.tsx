"use client";

/**
 * LoadMoreButton
 *
 * Presentational "Load more" pagination button with spinner and label.
 * Use when hasNextPage and pass fetchNextPage / isFetchingNextPage from your query.
 */

import React from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { cn } from "@/lib/utils";

export interface LoadMoreButtonProps {
  onLoadMore: () => void;
  loading: boolean;
  className?: string;
}

export function LoadMoreButton({ onLoadMore, loading, className }: LoadMoreButtonProps) {
  return (
    <div className={cn("flex justify-center pt-4", className)}>
      <Button
        variant="outline"
        onClick={onLoadMore}
        data-tour="tour.studio.results.results.btn.loadMore"
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <>
            <ViewBaitLogo className="h-4 w-4 animate-spin" />
            Loading...
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" />
            Load More
          </>
        )}
      </Button>
    </div>
  );
}
