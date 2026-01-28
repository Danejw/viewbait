"use client";

/**
 * BrowsePalettes Component
 * 
 * Tab content for browsing public palettes with:
 * - Search and sort controls
 * - Optimized palette grid
 * - "Use Palette" action to apply to generator
 * - Empty states
 * 
 * @see vercel-react-best-practices for optimization patterns
 */

import React, { memo, useState, useCallback } from "react";
import { RefreshCw, Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrowseControls } from "./browse-controls";
import { PaletteGrid } from "./palette-grid";
import { usePublicPalettes } from "@/lib/hooks/usePublicContent";
import { useStudio } from "./studio-provider";
import type { PublicSortOption, SortDirection } from "@/lib/hooks/usePublicContent";
import type { PublicPalette } from "@/lib/types/database";

export interface BrowsePalettesProps {
  /** Callback when palette is clicked */
  onPaletteClick?: (palette: PublicPalette) => void;
  /** Callback when "Use Palette" is clicked */
  onUsePalette?: (paletteId: string) => void;
}

/**
 * BrowsePalettes - memoized for performance
 */
export const BrowsePalettes = memo(function BrowsePalettes({
  onPaletteClick,
  onUsePalette,
}: BrowsePalettesProps) {
  // Local state for sorting and filtering
  const [orderBy, setOrderBy] = useState<PublicSortOption>("like_count");
  const [orderDirection, setOrderDirection] = useState<SortDirection>("desc");
  const [searchQuery, setSearchQuery] = useState("");

  // Try to get studio context for applying palettes and opening view modal (optional)
  let studioActions: {
    setSelectedPalette?: (id: string | null) => void;
    setView?: (view: string) => void;
    onViewPalette?: (palette: PublicPalette) => void;
  } | null = null;
  try {
    const studio = useStudio();
    studioActions = studio.actions;
  } catch {
    // Not inside StudioProvider, that's fine
  }

  // Fetch public palettes
  const {
    palettes,
    totalCount,
    filteredCount,
    isLoading,
    isError,
    error,
    refetch,
  } = usePublicPalettes({
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

  // Handle palette click – open view modal (studio) and optional custom callback
  const handlePaletteClick = useCallback(
    (palette: PublicPalette) => {
      studioActions?.onViewPalette?.(palette);
      onPaletteClick?.(palette);
    },
    [onPaletteClick, studioActions]
  );

  // Handle use palette
  const handleUsePalette = useCallback(
    (paletteId: string) => {
      if (onUsePalette) {
        onUsePalette(paletteId);
      } else if (studioActions?.setSelectedPalette) {
        // Apply palette to generator and switch to generator view
        studioActions.setSelectedPalette(paletteId);
        studioActions.setView?.("generator");
      }
    },
    [onUsePalette, studioActions]
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
          searchPlaceholder="Search palettes..."
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Failed to load palettes"}
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
        searchPlaceholder="Search palettes..."
      />

      {/* Empty state */}
      {!isLoading && palettes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Droplets className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {searchQuery
                ? "No palettes match your search"
                : "No public palettes available"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <PaletteGrid
          palettes={palettes}
          isLoading={isLoading}
          minSlots={8}
          showEmptySlots={false}
          onUsePalette={handleUsePalette}
          onClick={handlePaletteClick}
        />
      )}
    </div>
  );
});

export default BrowsePalettes;
