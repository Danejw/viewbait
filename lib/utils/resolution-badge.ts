/**
 * Resolution Badge Utility
 * 
 * Provides consistent color coding for resolution badges across the application.
 * - 1K = Green
 * - 2K = Blue
 * - 4K = Gold/Amber
 */

/**
 * Returns the appropriate Tailwind CSS background color class for a resolution badge
 * @param resolution - The resolution value (1K, 2K, 4K) or null/undefined
 * @returns Tailwind CSS class string for the background color, or empty string if invalid
 */
export function getResolutionBadgeColor(resolution: string | null | undefined): string {
  if (!resolution) return "";
  
  const normalizedResolution = resolution.toUpperCase();
  
  switch (normalizedResolution) {
    case "1K":
      return "bg-green-600/90";
    case "2K":
      return "bg-blue-600/90";
    case "4K":
      return "bg-amber-500/90";
    default:
      return "bg-black/60";
  }
}
