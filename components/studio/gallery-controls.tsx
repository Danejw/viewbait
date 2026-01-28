"use client";

/**
 * Gallery Controls Component
 * 
 * Provides sorting and filtering controls for the thumbnail gallery.
 * - Sort dropdown: Newest First, Oldest First, Title A-Z, Title Z-A
 * - Favorites toggle: Show only favorites
 * 
 * Uses memoization to prevent unnecessary re-renders (rerender-memo)
 */

import React, { memo, useCallback } from "react";
import { ArrowUpDown, Heart, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { ThumbnailSortOption, SortDirection } from "@/lib/hooks/useThumbnails";

/**
 * Sort option configuration
 */
interface SortOption {
  value: string;
  label: string;
  orderBy: ThumbnailSortOption;
  orderDirection: SortDirection;
}

const SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First", orderBy: "created_at", orderDirection: "desc" },
  { value: "oldest", label: "Oldest First", orderBy: "created_at", orderDirection: "asc" },
  { value: "title-asc", label: "Title A-Z", orderBy: "title", orderDirection: "asc" },
  { value: "title-desc", label: "Title Z-A", orderBy: "title", orderDirection: "desc" },
];

/**
 * Get sort option value from orderBy and orderDirection
 */
function getSortValue(orderBy: ThumbnailSortOption, orderDirection: SortDirection): string {
  const option = SORT_OPTIONS.find(
    (opt) => opt.orderBy === orderBy && opt.orderDirection === orderDirection
  );
  return option?.value ?? "newest";
}

/**
 * Get orderBy and orderDirection from sort option value
 */
function parseSortValue(value: string): { orderBy: ThumbnailSortOption; orderDirection: SortDirection } {
  const option = SORT_OPTIONS.find((opt) => opt.value === value);
  return {
    orderBy: option?.orderBy ?? "created_at",
    orderDirection: option?.orderDirection ?? "desc",
  };
}

export interface GalleryControlsProps {
  /** Current sort field */
  orderBy: ThumbnailSortOption;
  /** Current sort direction */
  orderDirection: SortDirection;
  /** Whether to show only favorites */
  favoritesOnly: boolean;
  /** Callback when sort changes */
  onSortChange: (orderBy: ThumbnailSortOption, orderDirection: SortDirection) => void;
  /** Callback when favorites toggle changes */
  onFavoritesToggle: (favoritesOnly: boolean) => void;
  /** Total count of items (optional, for display) */
  totalCount?: number;
  /** Additional class name */
  className?: string;
}

/**
 * Gallery Controls - memoized for performance
 */
export const GalleryControls = memo(function GalleryControls({
  orderBy,
  orderDirection,
  favoritesOnly,
  onSortChange,
  onFavoritesToggle,
  totalCount,
  className,
}: GalleryControlsProps) {
  // Handle sort change using functional callback pattern (rerender-functional-setstate)
  const handleSortChange = useCallback(
    (value: string) => {
      const { orderBy: newOrderBy, orderDirection: newOrderDirection } = parseSortValue(value);
      onSortChange(newOrderBy, newOrderDirection);
    },
    [onSortChange]
  );

  // Handle favorites toggle
  const handleFavoritesToggle = useCallback(
    (checked: boolean) => {
      onFavoritesToggle(checked);
    },
    [onFavoritesToggle]
  );

  const currentSortValue = getSortValue(orderBy, orderDirection);

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4", className)}>
      {/* Left side - Count and filters */}
      <div className="flex items-center gap-4">
        {totalCount !== undefined && (
          <span className="text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? "thumbnail" : "thumbnails"}
          </span>
        )}

        {/* Favorites filter */}
        <div className="flex items-center gap-2">
          <Switch
            id="favorites-filter"
            checked={favoritesOnly}
            onCheckedChange={handleFavoritesToggle}
            size="sm"
          />
          <Label
            htmlFor="favorites-filter"
            className="flex cursor-pointer items-center gap-1.5 text-sm"
          >
            <Heart
              className={cn(
                "h-3.5 w-3.5 transition-colors",
                favoritesOnly ? "fill-primary text-primary" : "text-muted-foreground"
              )}
            />
            Favorites only
          </Label>
        </div>
      </div>

      {/* Right side - Sort dropdown */}
      <div className="flex items-center gap-2">
        <Label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort
        </Label>
        <Select value={currentSortValue} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
});

export default GalleryControls;
