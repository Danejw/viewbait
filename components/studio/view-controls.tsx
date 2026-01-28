"use client";

/**
 * ViewControls Component
 * 
 * Reusable controls bar for consistent layout across all studio views:
 * - Gallery, Styles, Palettes, Faces
 * 
 * Provides:
 * - Search input
 * - Filter dropdown (customizable options)
 * - Sort dropdown
 * - Favorites toggle
 * - Add button (optional)
 * - Refresh button
 * 
 * Layout: [Search] [Filter] [Sort] [Favorites] [Add] [Refresh]
 */

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  ArrowUpDown,
  Heart,
  Plus,
  RefreshCw,
  Filter,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

/**
 * Filter option configuration
 */
export interface FilterOption {
  value: string;
  label: string;
}

/**
 * Sort option configuration
 */
export interface SortOption {
  value: string;
  label: string;
}

/**
 * Default sort options (can be overridden)
 */
export const DEFAULT_SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
];

export interface ViewControlsProps {
  /** Search query value */
  searchQuery?: string;
  /** Callback when search changes */
  onSearchChange?: (query: string) => void;
  /** Placeholder for search input */
  searchPlaceholder?: string;
  /** Whether to show search */
  showSearch?: boolean;

  /** Current filter value */
  filterValue?: string;
  /** Filter options */
  filterOptions?: FilterOption[];
  /** Callback when filter changes */
  onFilterChange?: (value: string) => void;
  /** Whether to show filter */
  showFilter?: boolean;

  /** Current sort value */
  sortValue?: string;
  /** Sort options */
  sortOptions?: SortOption[];
  /** Callback when sort changes */
  onSortChange?: (value: string) => void;
  /** Whether to show sort */
  showSort?: boolean;

  /** Whether favorites filter is active */
  favoritesOnly?: boolean;
  /** Callback when favorites toggle changes */
  onFavoritesToggle?: (favoritesOnly: boolean) => void;
  /** Whether to show favorites toggle */
  showFavorites?: boolean;

  /** Callback when add button is clicked */
  onAdd?: () => void;
  /** Add button label */
  addLabel?: string;
  /** Whether to show add button */
  showAdd?: boolean;

  /** Callback when refresh button is clicked */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Whether to show refresh button */
  showRefresh?: boolean;

  /** Additional class name */
  className?: string;
}

/**
 * Breakpoints for responsive text visibility
 * These are based on container width, not viewport width
 */
const BREAKPOINTS = {
  compact: 400,   // Show only icons
  medium: 600,    // Show some text
  large: 800,     // Show all text
};

/**
 * ViewControls - memoized for performance
 */
export const ViewControls = memo(function ViewControls({
  searchQuery = "",
  onSearchChange,
  searchPlaceholder = "Search...",
  showSearch = true,

  filterValue,
  filterOptions = [],
  onFilterChange,
  showFilter = false,

  sortValue = "newest",
  sortOptions = DEFAULT_SORT_OPTIONS,
  onSortChange,
  showSort = true,

  favoritesOnly = false,
  onFavoritesToggle,
  showFavorites = true,

  onAdd,
  addLabel = "Add New",
  showAdd = false,

  onRefresh,
  isRefreshing = false,
  showRefresh = true,

  className,
}: ViewControlsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [isCompact, setIsCompact] = useState(false);
  const [isMedium, setIsMedium] = useState(false);

  // Track container width with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Set initial width
    setContainerWidth(container.offsetWidth);

    // Create ResizeObserver to track width changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        setContainerWidth(width);
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Determine responsive states based on container width
  useEffect(() => {
    setIsCompact(containerWidth < BREAKPOINTS.compact);
    setIsMedium(containerWidth >= BREAKPOINTS.compact && containerWidth < BREAKPOINTS.large);
  }, [containerWidth]);

  // Handle search change with debounce-ready callback
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange?.(e.target.value);
    },
    [onSearchChange]
  );

  // Clear search
  const handleClearSearch = useCallback(() => {
    onSearchChange?.("");
  }, [onSearchChange]);

  // Handle filter change
  const handleFilterChange = useCallback(
    (value: string) => {
      onFilterChange?.(value);
    },
    [onFilterChange]
  );

  // Handle sort change
  const handleSortChange = useCallback(
    (value: string) => {
      onSortChange?.(value);
    },
    [onSortChange]
  );

  // Handle favorites toggle
  const handleFavoritesToggle = useCallback(
    (checked: boolean) => {
      onFavoritesToggle?.(checked);
    },
    [onFavoritesToggle]
  );

  // Determine if we should show text labels based on container width
  const showText = !isCompact;
  const showFullText = !isCompact && !isMedium;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-nowrap items-center justify-between overflow-hidden rounded-lg border border-border bg-card/50",
        isCompact ? "gap-1 p-1" : isMedium ? "gap-1.5 p-1.5" : "gap-2 p-2 md:gap-3 md:p-3",
        className
      )}
    >
      {/* Left side: Search Input */}
      {showSearch && onSearchChange && (
        <div 
          className={cn(
            "relative shrink-0",
            isCompact ? "w-[100px]" : isMedium ? "w-[160px]" : "w-[240px] md:w-[280px]"
          )}
        >
          <Search 
            className={cn(
              "absolute top-1/2 -translate-y-1/2 text-muted-foreground",
              isCompact ? "left-2 h-3.5 w-3.5" : "left-2.5 h-4 w-4"
            )} 
          />
          <Input
            type="text"
            placeholder={isCompact ? "" : searchPlaceholder}
            value={searchQuery}
            onChange={handleSearchChange}
            className={cn(
              "w-full truncate",
              isCompact ? "h-8 pl-7 pr-6 text-xs" : isMedium ? "h-9 pl-8 pr-7 text-sm" : "h-10 pl-9 pr-8"
            )}
            title={isCompact ? searchPlaceholder : undefined}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className={cn(
                "absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground",
                isCompact ? "right-1.5" : "right-2"
              )}
            >
              <X className={cn(isCompact ? "h-3 w-3" : "h-3.5 w-3.5")} />
            </button>
          )}
        </div>
      )}

      {/* Spacer to push controls to the right */}
      <div className="flex-1 min-w-0" />

      {/* Right side: Controls group */}
      <div 
        className={cn(
          "flex shrink-0 items-center",
          isCompact ? "gap-1" : isMedium ? "gap-1.5" : "gap-2 md:gap-3"
        )}
      >
        {/* Filter Dropdown - Adapts based on container width */}
        {showFilter && filterOptions.length > 0 && onFilterChange && (
          <div className="flex shrink-0 items-center">
            <Select value={filterValue} onValueChange={handleFilterChange}>
              <SelectTrigger 
                className={cn(
                  "gap-1 text-xs",
                  isCompact 
                    ? "h-8 w-auto px-1.5" 
                    : isMedium 
                    ? "h-9 w-[100px] px-2 text-sm" 
                    : "h-10 w-[130px] px-3"
                )}
                title={filterOptions.find(opt => opt.value === filterValue)?.label || "Filter"}
              >
                <Filter className="h-3.5 w-3.5 shrink-0" />
                {showText && (
                  <SelectValue 
                    placeholder="Filter..." 
                    className="inline-flex"
                  />
                )}
              </SelectTrigger>
              <SelectContent>
                {filterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Sort Dropdown - Adapts based on container width */}
        {showSort && sortOptions.length > 0 && onSortChange && (
          <div className="flex shrink-0 items-center">
            <Select value={sortValue} onValueChange={handleSortChange}>
              <SelectTrigger 
                className={cn(
                  "gap-1 text-xs",
                  isCompact 
                    ? "h-8 w-auto px-1.5" 
                    : isMedium 
                    ? "h-9 w-[100px] px-2 text-sm" 
                    : "h-10 w-[130px] px-3"
                )}
                title={sortOptions.find(opt => opt.value === sortValue)?.label || "Sort"}
              >
                <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
                {showText && (
                  <SelectValue 
                    placeholder="Sort..." 
                    className="inline-flex"
                  />
                )}
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Favorites Toggle - Adapts based on container width */}
        {showFavorites && onFavoritesToggle && (
          <div 
            className={cn(
              "flex shrink-0 items-center rounded-md border border-border",
              isCompact 
                ? "gap-1 px-1.5 py-1" 
                : isMedium 
                ? "gap-1.5 px-2 py-1.5" 
                : "gap-2 px-3"
            )}
          >
            <Switch
              id="favorites-filter"
              checked={favoritesOnly}
              onCheckedChange={handleFavoritesToggle}
              size="sm"
              className={cn(isCompact && "scale-90")}
            />
            <Label
              htmlFor="favorites-filter"
              className="flex cursor-pointer items-center gap-1"
              title="Favorites only"
            >
              <Heart
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-colors",
                  favoritesOnly ? "fill-red-500 text-red-500" : "text-muted-foreground"
                )}
              />
              {showFullText && (
                <span className="text-xs sm:text-sm">Favorites</span>
              )}
            </Label>
          </div>
        )}

        {/* Refresh Button - Always icon only */}
        {showRefresh && onRefresh && (
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh"
            className={cn(
              "shrink-0",
              isCompact ? "h-8 w-8" : isMedium ? "h-9 w-9" : "h-10 w-10"
            )}
          >
            <RefreshCw
              className={cn(
                isCompact ? "h-3.5 w-3.5" : "h-4 w-4",
                isRefreshing && "animate-spin"
              )}
            />
          </Button>
        )}

        {/* Add Button - Adapts based on container width */}
        {showAdd && onAdd && (
          <Button 
            onClick={onAdd} 
            className={cn(
              "shrink-0",
              isCompact 
                ? "h-8 gap-1 px-1.5" 
                : isMedium 
                ? "h-9 gap-1.5 px-2" 
                : "h-10 gap-2 px-3"
            )}
            title={addLabel}
          >
            <Plus className={cn("h-3.5 w-3.5 shrink-0", !isCompact && "h-4 w-4")} />
            {showFullText && (
              <span className="text-xs sm:text-sm">{addLabel}</span>
            )}
          </Button>
        )}
      </div>
    </div>
  );
});

/**
 * ViewHeader Component
 * 
 * Standard header for all studio views with title and count.
 */
export interface ViewHeaderProps {
  title: string;
  description?: string;
  count?: number;
  countLabel?: string;
  className?: string;
}

export const ViewHeader = memo(function ViewHeader({
  title,
  description,
  count,
  countLabel = "items",
  className,
}: ViewHeaderProps) {
  return (
    <div className={cn("mb-4", className)}>
      <div className="flex items-baseline gap-3">
        <h1 className="text-2xl font-bold">{title}</h1>
        {count !== undefined && (
          <span className="text-sm text-muted-foreground">
            {count} {count === 1 ? countLabel.replace(/s$/, "") : countLabel}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-1 text-muted-foreground">{description}</p>
      )}
    </div>
  );
});

export default ViewControls;
