"use client";

/**
 * BrowseStyles Component
 * 
 * Tab content for browsing public styles with:
 * - Search and sort controls
 * - Optimized style grid
 * - "Use Style" action to apply to generator
 * - Empty states
 * 
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useState, useCallback } from "react";
import { RefreshCw, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrowseControls } from "./browse-controls";
import { StyleGrid } from "./style-grid";
import { usePublicStyles } from "@/lib/hooks/usePublicContent";
import { useStudio } from "./studio-provider";
import type { PublicSortOption, SortDirection } from "@/lib/hooks/usePublicContent";
import type { PublicStyle } from "@/lib/types/database";

export interface BrowseStylesProps {
  /** Callback when style is clicked */
  onStyleClick?: (style: PublicStyle) => void;
  /** Callback when "Use Style" is clicked */
  onUseStyle?: (styleId: string) => void;
}

/**
 * BrowseStyles - memoized for performance
 */
export const BrowseStyles = memo(function BrowseStyles({
  onStyleClick,
  onUseStyle,
}: BrowseStylesProps) {
  // Local state for sorting and filtering
  const [orderBy, setOrderBy] = useState<PublicSortOption>("like_count");
  const [orderDirection, setOrderDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");

  // Try to get studio context for applying styles (optional)
  let studioActions: { setSelectedStyle?: (id: string | null) => void; setView?: (view: string) => void } | null = null;
  try {
    const studio = useStudio();
    studioActions = studio.actions;
  } catch {
    // Not inside StudioProvider, that's fine
  }

  // Fetch public styles
  const {
    styles,
    totalCount,
    filteredCount,
    isLoading,
    isError,
    error,
    refetch,
  } = usePublicStyles({
    orderBy,
    orderDirection,
    searchQuery,
  });

  // Handle sort change
  const handleSortChange = useCallback(
    (newOrderBy: PublicSortOption, newOrderDirection: SortDirection) => {
      setOrderBy(newOrderBy);
      setOrderDirection(newOrderDirection);
    },
    []
  );

  // Handle search change
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle style click
  const handleStyleClick = useCallback(
    (style: PublicStyle) => {
      onStyleClick?.(style);
    },
    [onStyleClick]
  );

  // Handle use style
  const handleUseStyle = useCallback(
    (styleId: string) => {
      if (onUseStyle) {
        onUseStyle(styleId);
      } else if (studioActions?.setSelectedStyle) {
        // Apply style to generator and switch to generator view
        studioActions.setSelectedStyle(styleId);
        studioActions.setView?.("generator");
      }
    },
    [onUseStyle, studioActions]
  );

  // Handle refresh
  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Error state
  if (isError) {
    return (
      <div className="space-y-4">
        <BrowseControls
          searchQuery={searchQuery}
          onSearchChange={handleSearchChange}
          orderBy={orderBy}
          orderDirection={orderDirection}
          onSortChange={handleSortChange}
          searchPlaceholder="Search styles..."
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Failed to load styles"}
            </p>
            <Button variant="outline" onClick={handleRefresh} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <BrowseControls
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        orderBy={orderBy}
        orderDirection={orderDirection}
        onSortChange={handleSortChange}
        totalCount={totalCount}
        filteredCount={searchQuery ? filteredCount : undefined}
        searchPlaceholder="Search styles..."
      />

      {/* Empty state */}
      {!isLoading && styles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Palette className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchQuery
                ? "No styles match your search"
                : "No public styles available"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <StyleGrid
          styles={styles}
          isLoading={isLoading}
          minSlots={8}
          showEmptySlots={false}
          onUseStyle={handleUseStyle}
          onClick={handleStyleClick}
        />
      )}
    </div>
  );
});

export default BrowseStyles;
