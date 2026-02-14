"use client";

/**
 * Palettes Hook (React Query)
 * 
 * Provides palette data and CRUD operations using React Query for caching and deduplication.
 * Accepts initial data from SSR to avoid duplicate requests.
 * Includes AI-powered color palette analysis.
 */

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import * as palettesService from "@/lib/services/palettes";
import * as favoritesService from "@/lib/services/favorites";
import type { DbPalette, PublicPalette } from "@/lib/types/database";

export interface UsePalettesOptions {
  includePublic?: boolean;
  includeDefaults?: boolean;
  userOnly?: boolean;
  autoFetch?: boolean;
  enabled?: boolean; // Override enabled state for conditional fetching
  initialData?: DbPalette[]; // Initial data from SSR
}

/**
 * Result of palette analysis
 */
export interface AnalyzePaletteResult {
  name: string;
  colors: string[];
  description?: string;
}

export interface UsePalettesReturn {
  palettes: DbPalette[];
  publicPalettes: PublicPalette[];
  defaultPalettes: DbPalette[];
  isLoading: boolean;
  isAnalyzing: boolean;
  error: Error | null;
  favoriteIds: Set<string>;
  
  // CRUD Actions
  fetchPalettes: () => Promise<void>;
  fetchPublicPalettes: () => Promise<void>;
  createPalette: (data: Parameters<typeof palettesService.createPalette>[0]) => Promise<DbPalette | null>;
  updatePalette: (id: string, data: Parameters<typeof palettesService.updatePalette>[1]) => Promise<DbPalette | null>;
  deletePalette: (id: string) => Promise<boolean>;
  togglePublic: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<boolean>;
  updateColors: (id: string, colors: string[]) => Promise<boolean>;
  updateName: (id: string, name: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  
  // AI Actions
  analyzePalette: (file: File) => Promise<AnalyzePaletteResult | null>;
}

export function usePalettes(options: UsePalettesOptions = {}): UsePalettesReturn {
  const { 
    includePublic = true, 
    includeDefaults = true, 
    userOnly = false,
    autoFetch = true,
    enabled,
    initialData
  } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // AI operation states (not using React Query since they're one-off operations)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);

  // Query keys for React Query cache
  const palettesQueryKey = ['palettes', user?.id, userOnly];
  const publicPalettesQueryKey = ['palettes', 'public'];
  const favoritesQueryKey = ['favorites', user?.id, 'palette'];

  /**
   * Main query for user's palettes
   */
  const {
    data: palettesData,
    isLoading: palettesLoading,
    error: palettesError,
    refetch: refetchPalettes,
  } = useQuery({
    queryKey: palettesQueryKey,
    queryFn: async () => {
      if (!user) {
        return [];
      }
      const fetchFn = userOnly 
        ? palettesService.getUserPalettes 
        : palettesService.getPalettes;
      
      const { palettes: data, error } = await fetchFn(user.id);
      if (error) {
        throw error;
      }
      return data;
    },
    enabled: enabled !== undefined ? enabled : (autoFetch && !!user),
    initialData: initialData,
    staleTime: 10 * 60 * 1000, // 10 minutes - user palettes don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes cache time
    refetchOnWindowFocus: false,
  });

  /**
   * Query for public palettes
   */
  const {
    data: publicPalettesData,
    refetch: refetchPublicPalettes,
  } = useQuery({
    queryKey: publicPalettesQueryKey,
    queryFn: async () => {
      const { palettes: data, error } = await palettesService.getPublicPalettes();
      if (error) {
        throw error;
      }
      return data;
    },
    enabled: autoFetch && includePublic,
    staleTime: 30 * 60 * 1000, // 30 minutes - public palettes are static
    gcTime: 60 * 60 * 1000, // 60 minutes cache time
    refetchOnWindowFocus: false,
  });

  /**
   * Query for favorite IDs
   */
  const {
    data: favoriteIdsData,
  } = useQuery({
    queryKey: favoritesQueryKey,
    queryFn: async () => {
      if (!user) {
        return new Set<string>();
      }
      const { ids } = await favoritesService.getFavoriteIds('palette');
      return ids;
    },
    enabled: (enabled !== undefined ? enabled : (autoFetch && !!user)) && !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes - favorites don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes cache time
    refetchOnWindowFocus: false,
  });

  // Derive data from queries
  const palettes = palettesData || [];
  const publicPalettes = publicPalettesData || [];
  const defaultPalettes = includeDefaults ? palettes.filter(p => p.is_default) : [];
  const favoriteIds = favoriteIdsData || new Set<string>();

  /**
   * Mutation for creating a palette.
   * Invalidation: list only; public/favorites unchanged.
   */
  const createMutation = useMutation({
    mutationFn: palettesService.createPalette,
    onSuccess: (result) => {
      if (result.palette) {
        queryClient.invalidateQueries({ queryKey: palettesQueryKey });
      }
    },
  });

  /**
   * Mutation for updating a palette.
   * Invalidation: list only; public/favorites only if payload changes them.
   */
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof palettesService.updatePalette>[1] }) =>
      palettesService.updatePalette(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: palettesQueryKey });
    },
  });

  /**
   * Mutation for deleting a palette.
   * Invalidation: list only; item removed from list.
   */
  const deleteMutation = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      palettesService.deletePalette(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: palettesQueryKey });
    },
  });

  /**
   * Mutation for toggling public status.
   * Invalidation: list + public list (visibility changed); favorites unchanged.
   */
  const togglePublicMutation = useMutation({
    mutationFn: palettesService.togglePalettePublic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: palettesQueryKey });
      queryClient.invalidateQueries({ queryKey: publicPalettesQueryKey });
    },
  });

  /**
   * Mutation for toggling favorite.
   * Invalidation: favorites only; list and public list unchanged.
   */
  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      favoritesService.toggleFavorite(id, 'palette'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoritesQueryKey });
    },
  });

  /**
   * Mutation for updating colors
   */
  const updateColorsMutation = useMutation({
    mutationFn: ({ id, colors }: { id: string; colors: string[] }) =>
      palettesService.updatePaletteColors(id, colors),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: palettesQueryKey });
    },
  });

  /**
   * Mutation for updating name
   */
  const updateNameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      palettesService.updatePaletteName(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: palettesQueryKey });
    },
  });

  // Action wrappers to maintain backward compatibility

  const fetchPalettes = async () => {
    if (!user) return;
    // Use fetchQuery to ensure it works even when query is disabled
    const fetchFn = userOnly 
      ? palettesService.getUserPalettes 
      : palettesService.getPalettes;
    await queryClient.fetchQuery({
      queryKey: palettesQueryKey,
      queryFn: async () => {
        const { palettes: data, error } = await fetchFn(user.id);
        if (error) {
          throw error;
        }
        return data;
      },
    });
  };

  const fetchPublicPalettes = async () => {
    await refetchPublicPalettes();
  };

  const createPalette = async (
    data: Parameters<typeof palettesService.createPalette>[0]
  ): Promise<DbPalette | null> => {
    try {
      const result = await createMutation.mutateAsync(data);
      return result.palette || null;
    } catch {
      return null;
    }
  };

  const updatePalette = async (
    id: string,
    data: Parameters<typeof palettesService.updatePalette>[1]
  ): Promise<DbPalette | null> => {
    try {
      const result = await updateMutation.mutateAsync({ id, data });
      return result.palette || null;
    } catch {
      return null;
    }
  };

  const deletePalette = async (id: string): Promise<boolean> => {
    if (!user) return false;
    try {
      await deleteMutation.mutateAsync({ id, userId: user.id });
      return true;
    } catch {
      return false;
    }
  };

  const togglePublic = async (id: string): Promise<boolean> => {
    try {
      const result = await togglePublicMutation.mutateAsync(id);
      return result.isPublic;
    } catch {
      return false;
    }
  };

  const toggleFavorite = async (id: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const result = await toggleFavoriteMutation.mutateAsync({ id });
      return result.favorited;
    } catch {
      return false;
    }
  };

  const updateColors = async (id: string, colors: string[]): Promise<boolean> => {
    try {
      await updateColorsMutation.mutateAsync({ id, colors });
      return true;
    } catch {
      return false;
    }
  };

  const updateName = async (id: string, name: string): Promise<boolean> => {
    try {
      await updateNameMutation.mutateAsync({ id, name });
      return true;
    } catch {
      return false;
    }
  };

  const refresh = async () => {
    // Invalidate all related queries to clear stale cache
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: palettesQueryKey }),
      queryClient.invalidateQueries({ queryKey: publicPalettesQueryKey }),
      queryClient.invalidateQueries({ queryKey: favoritesQueryKey }),
    ]);
    // Refetch all queries with fresh data
    await Promise.all([refetchPalettes(), refetchPublicPalettes()]);
  };

  /**
   * Analyze an image to extract a color palette using AI
   * Returns the extracted palette name, colors, and description
   */
  const analyzePalette = async (file: File): Promise<AnalyzePaletteResult | null> => {
    if (!file) return null;
    
    setIsAnalyzing(true);
    try {
      const { result, error } = await palettesService.analyzePalette(file);
      
      if (error || !result) {
        console.error("Palette analysis failed:", error);
        return null;
      }
      
      return {
        name: result.name || "",
        colors: result.colors || [],
        description: result.description,
      };
    } catch (err) {
      console.error("Palette analysis error:", err);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Combine loading and error states
  const isLoading = palettesLoading || 
    createMutation.isPending || 
    updateMutation.isPending || 
    deleteMutation.isPending || 
    togglePublicMutation.isPending ||
    toggleFavoriteMutation.isPending ||
    updateColorsMutation.isPending ||
    updateNameMutation.isPending;

  const error = (palettesError as Error | null) || 
    (createMutation.error as Error | null) || 
    (updateMutation.error as Error | null) || 
    (deleteMutation.error as Error | null) ||
    (togglePublicMutation.error as Error | null) ||
    (toggleFavoriteMutation.error as Error | null) ||
    (updateColorsMutation.error as Error | null) ||
    (updateNameMutation.error as Error | null);

  return {
    palettes,
    publicPalettes,
    defaultPalettes,
    isLoading,
    isAnalyzing,
    error,
    favoriteIds,
    
    // CRUD Actions
    fetchPalettes,
    fetchPublicPalettes,
    createPalette,
    updatePalette,
    deletePalette,
    togglePublic,
    toggleFavorite,
    updateColors,
    updateName,
    refresh,
    
    // AI Actions
    analyzePalette,
  };
}
