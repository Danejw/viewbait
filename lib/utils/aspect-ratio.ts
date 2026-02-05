/**
 * Normalize thumbnail aspect_ratio (e.g. "16:9", "1:1", "9:16") to a CSS aspect-ratio value.
 * Used by ThumbnailCard and SharedGalleryCard so masonry items have correct intrinsic height.
 * Returns "16/9" for null, missing, or invalid values (default legacy behavior).
 */
export function normalizeAspectRatio(ratio: string | null | undefined): string {
  if (!ratio || typeof ratio !== "string") return "16/9";
  const trimmed = ratio.trim();
  if (!trimmed) return "16/9";
  // "16:9" -> "16/9", "1:1" -> "1", "9:16" -> "9/16"
  const parts = trimmed.split(":");
  if (parts.length !== 2) return "16/9";
  const w = parts[0]?.trim();
  const h = parts[1]?.trim();
  if (!w || !h) return "16/9";
  const numW = Number(w);
  const numH = Number(h);
  if (!Number.isFinite(numW) || !Number.isFinite(numH) || numH <= 0) return "16/9";
  if (numW === numH) return "1";
  return `${numW}/${numH}`;
}
