"use client";

/**
 * Browse Controls Component
 * 
 * Provides search and sorting controls for the public content browser.
 * - Search input (client-side filtering with debounce)
 * - Sort dropdown (Newest, Oldest, Most Popular, Name A-Z, Name Z-A)
 * - Total count display
 * 
 * Uses memoization to prevent unnecessary re-renders (rerender-memo)
 */

import React, { memo, useCallback, useState, useEffect } from "react";
import { Search, ArrowUpDown, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { PublicSortOption, SortDirection } from "@/lib/hooks/usePublicContent";

/**
 * Sort option configuration
 */
interface SortOption {
  value: string;
  label: string;
  orderBy: PublicSortOption;
  orderDirection: SortDirection;
}

const SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First", orderBy: "created_at", orderDirection: "desc" },
  { value: "oldest", label: "Oldest First", orderBy: "created_at", orderDirection: "asc" },
  { value: "popular", label: "Most Popular", orderBy: "like_count", orderDirection: "desc" },
  { value: "name-asc", label: "Name A-Z", orderBy: "name", orderDirection: "asc" },
  { value: "name-desc", label: "Name Z-A", orderBy: "name", orderDirection: "desc" },
];

/**
 * Get sort option value from orderBy and orderDirection
 */
function getSortValue(orderBy: PublicSortOption, orderDirection: SortDirection): string {
  const option = SORT_OPTIONS.find(
    (opt) => opt.orderBy === orderBy && opt.orderDirection === orderDirection
  );
  return option?.value ?? "newest";
}

/**
 * Get orderBy and orderDirection from sort option value
 */
function parseSortValue(value: string): { orderBy: PublicSortOption; orderDirection: SortDirection } {
  const option = SORT_OPTIONS.find((opt) => opt.value === value);
  return {
    orderBy: option?.orderBy ?? "created_at",
    orderDirection: option?.orderDirection ?? "desc",
  };
}

export interface BrowseControlsProps {
  /** Current search query */
  searchQuery: string;
  /** Callback when search query changes */
  onSearchChange: (query: string) => void;
  /** Current sort field */
  orderBy: PublicSortOption;
  /** Current sort direction */
  orderDirection: SortDirection;
  /** Callback when sort changes */
  onSortChange: (orderBy: PublicSortOption, orderDirection: SortDirection) => void;
  /** Total count of items (before filtering) */
  totalCount?: number;
  /** Filtered count of items (after search) */
  filteredCount?: number;
  /** Placeholder text for search input */
  searchPlaceholder?: string;
  /** Additional class name */
  className?: string;
}

/**
 * Browse Controls - memoized for performance
 */
export const BrowseControls = memo(function BrowseControls({
  searchQuery,
  onSearchChange,
  orderBy,
  orderDirection,
  onSortChange,
  totalCount,
  filteredCount,
  searchPlaceholder = "Search...",
  className,
}: BrowseControlsProps) {
  // Local state for debounced search
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Debounce search input (200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        onSearchChange(localSearch);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, onSearchChange]);

  // Sync local state when external search changes
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Handle sort change
  const handleSortChange = useCallback(
    (value: string) => {
      const { orderBy: newOrderBy, orderDirection: newOrderDirection } = parseSortValue(value);
      onSortChange(newOrderBy, newOrderDirection);
    },
    [onSortChange]
  );

  // Handle search input change
  const handleSearchInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setLocalSearch(e.target.value);
    },
    []
  );

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setLocalSearch("");
    onSearchChange("");
  }, [onSearchChange]);

  const currentSortValue = getSortValue(orderBy, orderDirection);

  // Display count
  const showFilteredCount = filteredCount !== undefined && filteredCount !== totalCount;
  const countText = showFilteredCount
    ? `${filteredCount} of ${totalCount}`
    : `${totalCount ?? 0}`;

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-4", className)}>
      {/* Left side - Search and count */}
      <div className="flex items-center gap-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={searchPlaceholder}
            value={localSearch}
            onChange={handleSearchInput}
            className="w-[200px] pl-9 pr-8"
          />
          {localSearch && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearSearch}
              className="absolute right-1 top-1/2 h-6 w-6 -translate-y-1/2"
            >
              <X className="h-3 w-3" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>

        {/* Count display */}
        {totalCount !== undefined && (
          <span className="text-sm text-muted-foreground">
            {countText} {totalCount === 1 ? "item" : "items"}
          </span>
        )}
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

export default BrowseControls;
