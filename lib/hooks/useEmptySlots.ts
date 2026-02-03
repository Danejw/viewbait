"use client";

import { useMemo } from "react";

/**
 * Computes how many empty grid slots to show so the grid has at least minSlots cells.
 * Used by ThumbnailGrid, StyleGrid, and PaletteGrid for consistent empty-slot behavior.
 *
 * @param itemCount - Current number of items in the grid
 * @param minSlots - Minimum total slots (items + empty placeholders)
 * @param showEmptySlots - When false, returns 0
 * @returns Number of empty slots to render (0 or minSlots - itemCount)
 */
export function useEmptySlots(
  itemCount: number,
  minSlots: number,
  showEmptySlots: boolean
): number {
  return useMemo(() => {
    if (!showEmptySlots) return 0;
    return Math.max(0, minSlots - itemCount);
  }, [showEmptySlots, minSlots, itemCount]);
}
