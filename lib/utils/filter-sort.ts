/**
 * Filter and Sort Utilities
 * 
 * Generic utilities for filtering and sorting resources (thumbnails, styles, palettes).
 * Provides consistent filtering and sorting behavior across all resource types.
 */

export type SortOption = "recent" | "favorites";

/**
 * Base interface for resources that can be filtered and sorted
 */
export interface FilterableResource {
  id: string;
  name: string;
  createdAt: Date;
}

/**
 * Options for filtering and sorting resources
 */
export interface FilterAndSortOptions {
  /**
   * Search query to filter by name
   */
  searchQuery?: string;
  /**
   * Sort option: recent or favorites
   */
  sortOption?: SortOption;
  /**
   * Set of favorite IDs (for resources that use Set-based favorite lookup)
   */
  favoriteIds?: Set<string>;
  /**
   * Function to check if an item is favorite (for resources with boolean isFavorite property)
   */
  getIsFavorite?: <T extends FilterableResource>(item: T) => boolean;
}

/**
 * Filter and sort resources based on search query, favorites, and sort option
 * 
 * @param items - Array of resources to filter and sort
 * @param options - Filter and sort options
 * @returns Filtered and sorted array of resources
 * 
 * @example
 * // For thumbnails with isFavorite property
 * const filtered = filterAndSortResources(thumbnails, {
 *   searchQuery: 'test',
 *   sortOption: 'recent',
 *   getIsFavorite: (item) => item.isFavorite
 * });
 * 
 * @example
 * // For styles/palettes with favoriteIds Set
 * const filtered = filterAndSortResources(styles, {
 *   searchQuery: 'test',
 *   sortOption: 'favorites',
 *   favoriteIds: styleFavoriteIds
 * });
 */
export function filterAndSortResources<T extends FilterableResource>(
  items: T[],
  options: FilterAndSortOptions = {}
): T[] {
  const {
    searchQuery = "",
    sortOption = "recent",
    favoriteIds,
    getIsFavorite,
  } = options;

  let filtered = [...items];

  // Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter((item) =>
      item.name.toLowerCase().includes(query)
    );
  }

    // Filter by favorites if sort option is favorites
    if (sortOption === "favorites") {
      if (favoriteIds) {
        // Use Set-based favorite lookup (styles, palettes)
        filtered = filtered.filter((item) => favoriteIds.has(item.id));
      } else if (getIsFavorite) {
        // Use function-based favorite lookup (thumbnails with isFavorite property)
        filtered = filtered.filter((item) => getIsFavorite<T>(item));
      }
      // If neither favoriteIds nor getIsFavorite is provided, don't filter
    }

  // Sort resources
  filtered.sort((a, b) => {
    switch (sortOption) {
      case "recent":
        return b.createdAt.getTime() - a.createdAt.getTime();
      case "favorites":
        // For favorites, also sort by recent (most recent favorites first)
        return b.createdAt.getTime() - a.createdAt.getTime();
      default:
        return 0;
    }
  });

  return filtered;
}
