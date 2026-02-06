/**
 * Grid zoom utilities
 *
 * Shared constants and breakpoint mapping for grid zoom slider (0–8).
 * Used by shared project gallery, Studio Gallery/Create/Browse thumbnail grids,
 * and optionally StyleGrid/PaletteGrid.
 *
 * Zoom semantics: 0 = most zoomed in (fewer, larger columns), 8 = most zoomed out (more columns).
 */

export const MIN_ZOOM = 0;
export const MAX_ZOOM = 8;
export const DEFAULT_ZOOM_LEVEL = 4;

/**
 * Clamp zoom level to valid range and round to integer.
 */
export function clampZoom(level: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(level)));
}

/**
 * Breakpoint shape for masonry grids (react-masonry-css).
 * Keys are max-width in px; values are column count.
 * Index signature allows assignment to MasonryGridBreakpoints.
 */
export interface GridZoomBreakpoints {
  default: number;
  768: number;
  [key: number]: number;
}

/**
 * Grid zoom: index 0 = most zoomed in, 8 = most zoomed out.
 * Maps to masonry column counts: mobile (≤768px) 1–4 cols, desktop 2–10 cols.
 */
export function getMasonryBreakpointCols(zoomLevel: number): GridZoomBreakpoints {
  const desktop = Math.min(10, 2 + zoomLevel);
  const mobile = [1, 1, 2, 2, 3, 3, 3, 4, 4][Math.min(8, Math.max(0, Math.round(zoomLevel)))] ?? 3;
  return { default: desktop, 768: mobile };
}

/**
 * Column counts for CSS Grid (e.g. StyleGrid, PaletteGrid).
 * Same 0–8 scale: default 2–6 cols, mobile 1–4 cols.
 */
export function getGridColsFromZoom(zoomLevel: number): GridZoomBreakpoints {
  const desktop = Math.min(6, 2 + Math.round(zoomLevel));
  const mobile = [1, 1, 2, 2, 3, 3, 3, 4, 4][Math.min(8, Math.max(0, Math.round(zoomLevel)))] ?? 3;
  return { default: desktop, 768: mobile };
}
