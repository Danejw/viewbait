/**
 * Number formatting utilities.
 * Shared formatting for display (compact K/M, etc.).
 */

/**
 * Format large numbers for display (e.g. 1200 -> 1.2K, 1500000 -> 1.5M).
 */
export function formatCompactNumber(n: number, decimals = 1): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(decimals)}K`;
  return String(n);
}
