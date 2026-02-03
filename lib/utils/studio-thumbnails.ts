import type { Thumbnail } from "@/lib/types/database";

/**
 * Builds a single combined list of thumbnails for display: generating items
 * (newest first) then DB thumbnails, with no duplicates.
 *
 * - Generating items are reversed so newest appears first (Map insertion order is oldest-first).
 * - DB thumbnails that match a generating item by id are excluded to avoid duplicates
 *   when a generating item gets its real id.
 *
 * Used by ThumbnailGrid and RecentThumbnailsStrip so ordering and dedup stay in sync.
 */
export function getCombinedThumbnailsList(
  thumbnails: Thumbnail[],
  generatingItems: Map<string, Thumbnail>
): Thumbnail[] {
  const generatingArray = Array.from(generatingItems.values());
  const generatingNewestFirst = [...generatingArray].reverse();
  const generatingIds = new Set(generatingArray.map((item) => item.id));
  const filteredThumbnails = thumbnails.filter((t) => !generatingIds.has(t.id));
  return [...generatingNewestFirst, ...filteredThumbnails];
}
