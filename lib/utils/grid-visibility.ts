/**
 * Shared constants and helper for grid content-visibility optimization.
 * Used by ThumbnailGrid, StyleGrid, and PaletteGrid so above-the-fold
 * item count is consistent and the pattern lives in one place.
 */

/** Number of items to render with content-visibility: visible (above the fold) for thumbnail/style grids. */
export const GRID_ABOVE_FOLD_DEFAULT = 6;

/** Number of items to render with content-visibility: visible for palette grid (smaller cards, more per row). */
export const GRID_ABOVE_FOLD_PALETTE = 8;

/**
 * Returns the Tailwind class for above-the-fold items (content-visibility: visible).
 * Items with index >= aboveFold use content-visibility: auto (from parent style).
 */
export function gridItemAboveFoldClass(index: number, aboveFold: number): string {
  return index < aboveFold ? "![content-visibility:visible]" : "";
}
