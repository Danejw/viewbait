/**
 * Anchor utilities for TourKit.
 */

/** Returns CSS selector for a data-tour anchor */
export function anchorSelector(anchor: string): string {
  return `[data-tour="${anchor}"]`;
}

/** Returns a Playwright locator string for a data-tour anchor */
export function anchorLocator(anchor: string): string {
  return `[data-tour="${anchor}"]`;
}
