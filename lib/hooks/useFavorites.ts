"use client";

/**
 * Favorites Hook
 * 
 * Provides favorites data and operations for components.
 * Integrates with the favorites service.
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import * as favoritesService from "@/lib/services/favorites";
import type { Favorite } from "@/lib/types/database";

export type FavoriteItemType = 'style' | 'palette' | 'thumbnail';

export interface UseFavoritesOptions {
  itemType?: FavoriteItemType;
  autoFetch?: boolean;
}

export interface UseFavoritesReturn {
  favorites: Favorite[];
  favoriteIds: Set<string>;
  isLoading: boolean;
  error: Error | null;
  
  // Actions
  fetchFavorites: () => Promise<void>;
  addFavorite: (itemId: string, itemType: FavoriteItemType) => Promise<boolean>;
  removeFavorite: (itemId: string, itemType: FavoriteItemType) => Promise<boolean>;
  toggleFavorite: (itemId: string, itemType: FavoriteItemType) => Promise<boolean>;
  isFavorited: (itemId: string) => boolean;
  refresh: () => Promise<void>;
}

export function useFavorites(options: UseFavoritesOptions = {}): UseFavoritesReturn {
  const { itemType, autoFetch = true } = options;
  const { user } = useAuth();

  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch favorites
   */
  const fetchFavorites = useCallback(async () => {
    if (!user) {
      setFavorites([]);
      setFavoriteIds(new Set());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { favorites: data, error: fetchError } = await favoritesService.getFavorites(
      itemType
    );

    if (fetchError) {
      setError(fetchError);
    } else {
      setFavorites(data);
      setFavoriteIds(new Set(data.map((f) => f.item_id)));
    }

    setIsLoading(false);
  }, [user, itemType]);

  /**
   * Add an item to favorites
   */
  const addFavorite = useCallback(
    async (itemId: string, type: FavoriteItemType): Promise<boolean> => {
      if (!user) return false;

      const { favorite, error: addError } = await favoritesService.addFavorite(
        itemId,
        type
      );

      if (addError) {
        setError(addError);
        return false;
      }

      if (favorite) {
        setFavorites((prev) => [favorite, ...prev]);
        setFavoriteIds((prev) => new Set([...prev, itemId]));
      }

      return true;
    },
    [user]
  );

  /**
   * Remove an item from favorites
   */
  const removeFavorite = useCallback(
    async (itemId: string, type: FavoriteItemType): Promise<boolean> => {
      if (!user) return false;

      const { error: removeError } = await favoritesService.removeFavorite(
        itemId,
        type
      );

      if (removeError) {
        setError(removeError);
        return false;
      }

      setFavorites((prev) => prev.filter((f) => f.item_id !== itemId));
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });

      return true;
    },
    [user]
  );

  /**
   * Toggle favorite status
   */
  const toggleFavorite = useCallback(
    async (itemId: string, type: FavoriteItemType): Promise<boolean> => {
      if (!user) return false;

      const isCurrentlyFavorited = favoriteIds.has(itemId);

      if (isCurrentlyFavorited) {
        return removeFavorite(itemId, type);
      } else {
        return addFavorite(itemId, type);
      }
    },
    [user, favoriteIds, addFavorite, removeFavorite]
  );

  /**
   * Check if an item is favorited
   */
  const isFavorited = useCallback(
    (itemId: string): boolean => {
      return favoriteIds.has(itemId);
    },
    [favoriteIds]
  );

  /**
   * Refresh data
   */
  const refresh = useCallback(async () => {
    await fetchFavorites();
  }, [fetchFavorites]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch && user) {
      // Use void to explicitly mark this as a fire-and-forget async call
      void fetchFavorites();
    }
    // Note: fetchFavorites is intentionally excluded from deps to avoid infinite loops
    // It's already memoized with useCallback and includes all necessary dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFetch, user]);

  return {
    favorites,
    favoriteIds,
    isLoading,
    error,
    fetchFavorites,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    isFavorited,
    refresh,
  };
}

/**
 * Hook for favorite styles
 */
export function useFavoriteStyles() {
  return useFavorites({ itemType: 'style' });
}

/**
 * Hook for favorite palettes
 */
export function useFavoritePalettes() {
  return useFavorites({ itemType: 'palette' });
}

/**
 * Hook for favorite thumbnails
 */
export function useFavoriteThumbnails() {
  return useFavorites({ itemType: 'thumbnail' });
}
