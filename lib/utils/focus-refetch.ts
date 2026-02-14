/**
 * Debounce refetch-on-window-focus so multiple queries don't all refetch in the same tick
 * when the user switches back to the tab. Only one "focus refetch" is allowed per window (e.g. 3s).
 */

const FOCUS_DEBOUNCE_MS = 3000;
let lastFocusRefetchAt = 0;

/**
 * Returns true if enough time has passed since the last focus refetch, so React Query
 * should refetch. When this returns true, the caller (React Query) will refetch;
 * we update the timestamp so the next query's refetchOnWindowFocus check will return false.
 * Use as refetchOnWindowFocus: shouldRefetchOnFocus
 */
export function shouldRefetchOnFocus(): boolean {
  const now = Date.now();
  if (now - lastFocusRefetchAt < FOCUS_DEBOUNCE_MS) {
    return false;
  }
  lastFocusRefetchAt = now;
  return true;
}
