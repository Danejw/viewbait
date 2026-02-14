"use client";

/**
 * Styles Hook (React Query)
 * 
 * Provides style data and CRUD operations using React Query for caching and deduplication.
 * Accepts initial data from SSR to avoid duplicate requests.
 * Includes AI-powered style analysis and preview generation.
 */

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import * as stylesService from "@/lib/services/styles";
import * as favoritesService from "@/lib/services/favorites";
import type { DbStyle, PublicStyle } from "@/lib/types/database";

export interface UseStylesOptions {
  includePublic?: boolean;
  includeDefaults?: boolean;
  userOnly?: boolean;
  autoFetch?: boolean;
  enabled?: boolean; // Override enabled state for conditional fetching
  initialData?: DbStyle[]; // Initial data from SSR
}

/**
 * Result of style analysis
 */
export interface AnalyzeStyleResult {
  name: string;
  description: string;
  prompt: string;
}

/**
 * Result of preview generation
 */
export interface GeneratePreviewResult {
  imageUrl: string;
}

/**
 * Result of extracting style from YouTube thumbnails
 */
export interface ExtractStyleFromYouTubeResult {
  name: string;
  description: string;
  prompt: string;
  reference_images: string[];
}

export interface UseStylesReturn {
  styles: DbStyle[];
  publicStyles: PublicStyle[];
  defaultStyles: DbStyle[];
  isLoading: boolean;
  isAnalyzing: boolean;
  isGeneratingPreview: boolean;
  isExtractingFromYouTube: boolean;
  error: Error | null;
  favoriteIds: Set<string>;
  
  // CRUD Actions
  fetchStyles: () => Promise<void>;
  fetchPublicStyles: () => Promise<void>;
  createStyle: (data: Parameters<typeof stylesService.createStyle>[0]) => Promise<DbStyle | null>;
  updateStyle: (id: string, data: Parameters<typeof stylesService.updateStyle>[1]) => Promise<DbStyle | null>;
  deleteStyle: (id: string) => Promise<boolean>;
  togglePublic: (id: string) => Promise<boolean>;
  toggleFavorite: (id: string) => Promise<boolean>;
  addReferenceImages: (id: string, urls: string[]) => Promise<boolean>;
  removeReferenceImage: (id: string, url: string) => Promise<boolean>;
  updatePreview: (id: string, url: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  
  // AI Actions
  analyzeStyle: (files: File[]) => Promise<AnalyzeStyleResult | null>;
  extractStyleFromYouTube: (imageUrls: string[]) => Promise<ExtractStyleFromYouTubeResult | null>;
  generatePreview: (prompt: string, referenceImageUrl?: string) => Promise<GeneratePreviewResult | null>;
}

export function useStyles(options: UseStylesOptions = {}): UseStylesReturn {
  const { 
    includePublic = true, 
    includeDefaults = true, 
    autoFetch = true,
    enabled,
    initialData
  } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // AI operation states (not using React Query since they're one-off operations)
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = React.useState(false);
  const [isExtractingFromYouTube, setIsExtractingFromYouTube] = React.useState(false);

  // Query keys for React Query cache
  const stylesQueryKey = ['styles', user?.id];
  const publicStylesQueryKey = ['styles', 'public'];
  const favoritesQueryKey = ['favorites', user?.id, 'style'];

  /**
   * Main query for user's styles
   */
  const {
    data: stylesData,
    isLoading: stylesLoading,
    error: stylesError,
    refetch: refetchStyles,
  } = useQuery({
    queryKey: stylesQueryKey,
    queryFn: async () => {
      if (!user) {
        return [];
      }
      const { styles: data, error } = await stylesService.getStyles(user.id);
      if (error) {
        throw error;
      }
      return data;
    },
    enabled: enabled !== undefined ? enabled : (autoFetch && !!user),
    initialData: initialData,
    staleTime: 10 * 60 * 1000, // 10 minutes - user styles don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes cache time
    refetchOnWindowFocus: false,
  });

  /**
   * Query for public styles
   */
  const {
    data: publicStylesData,
    refetch: refetchPublicStyles,
  } = useQuery({
    queryKey: publicStylesQueryKey,
    queryFn: async () => {
      const { styles: data, error } = await stylesService.getPublicStyles();
      if (error) {
        throw error;
      }
      return data;
    },
    enabled: autoFetch && includePublic,
    staleTime: 30 * 60 * 1000, // 30 minutes - public styles are static
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
      const { ids } = await favoritesService.getFavoriteIds('style');
      return ids;
    },
    enabled: (enabled !== undefined ? enabled : (autoFetch && !!user)) && !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes - favorites don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes cache time
    refetchOnWindowFocus: false,
  });

  // Derive data from queries
  const styles = stylesData || [];
  const publicStyles = publicStylesData || [];
  const defaultStyles = includeDefaults ? styles.filter(s => s.is_default) : [];
  const favoriteIds = favoriteIdsData || new Set<string>();

  /**
   * Mutation for creating a style.
   * Invalidation: list only (new item); public/favorites unchanged.
   */
  const createMutation = useMutation({
    mutationFn: stylesService.createStyle,
    onSuccess: (result) => {
      if (result.style) {
        queryClient.invalidateQueries({ queryKey: stylesQueryKey });
      }
    },
  });

  /**
   * Mutation for updating a style.
   * Invalidation: list only; public/favorites only if payload changes them.
   */
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof stylesService.updateStyle>[1] }) =>
      stylesService.updateStyle(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stylesQueryKey });
    },
  });

  /**
   * Mutation for deleting a style.
   * Invalidation: list only; item removed from list.
   */
  const deleteMutation = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      stylesService.deleteStyle(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stylesQueryKey });
    },
  });

  /**
   * Mutation for toggling public status.
   * Invalidation: list + public list (visibility changed); favorites unchanged.
   */
  const togglePublicMutation = useMutation({
    mutationFn: stylesService.toggleStylePublic,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stylesQueryKey });
      queryClient.invalidateQueries({ queryKey: publicStylesQueryKey });
    },
  });

  /**
   * Mutation for toggling favorite.
   * Invalidation: favorites only; list and public list unchanged.
   */
  const toggleFavoriteMutation = useMutation({
    mutationFn: ({ id }: { id: string }) =>
      favoritesService.toggleFavorite(id, 'style'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: favoritesQueryKey });
    },
  });

  /**
   * Mutation for adding reference images
   */
  const addReferenceImagesMutation = useMutation({
    mutationFn: ({ id, urls }: { id: string; urls: string[] }) =>
      stylesService.addStyleReferenceImages(id, urls),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stylesQueryKey });
    },
  });

  /**
   * Mutation for removing a reference image
   */
  const removeReferenceImageMutation = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) =>
      stylesService.removeStyleReferenceImage(id, url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stylesQueryKey });
    },
  });

  /**
   * Mutation for updating preview
   */
  const updatePreviewMutation = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) =>
      stylesService.updateStylePreview(id, url),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: stylesQueryKey });
    },
  });

  // Action wrappers to maintain backward compatibility

  const fetchStyles = async () => {
    if (!user) return;
    // Use fetchQuery to ensure it works even when query is disabled
    await queryClient.fetchQuery({
      queryKey: stylesQueryKey,
      queryFn: async () => {
        const { styles: data, error } = await stylesService.getStyles(user.id);
        if (error) {
          throw error;
        }
        return data;
      },
    });
  };

  const fetchPublicStyles = async () => {
    await refetchPublicStyles();
  };

  const createStyle = async (
    data: Parameters<typeof stylesService.createStyle>[0]
  ): Promise<DbStyle | null> => {
    try {
      const result = await createMutation.mutateAsync(data);
      return result.style || null;
    } catch {
      return null;
    }
  };

  const updateStyle = async (
    id: string,
    data: Parameters<typeof stylesService.updateStyle>[1]
  ): Promise<DbStyle | null> => {
    try {
      const result = await updateMutation.mutateAsync({ id, data });
      return result.style || null;
    } catch {
      return null;
    }
  };

  const deleteStyle = async (id: string): Promise<boolean> => {
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

  const addReferenceImages = async (id: string, urls: string[]): Promise<boolean> => {
    try {
      await addReferenceImagesMutation.mutateAsync({ id, urls });
      return true;
    } catch {
      return false;
    }
  };

  const removeReferenceImage = async (id: string, url: string): Promise<boolean> => {
    try {
      await removeReferenceImageMutation.mutateAsync({ id, url });
      return true;
    } catch {
      return false;
    }
  };

  const updatePreview = async (id: string, url: string): Promise<boolean> => {
    try {
      await updatePreviewMutation.mutateAsync({ id, url });
      return true;
    } catch {
      return false;
    }
  };

  const refresh = async () => {
    // Invalidate all related queries to clear stale cache
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: stylesQueryKey }),
      queryClient.invalidateQueries({ queryKey: publicStylesQueryKey }),
      queryClient.invalidateQueries({ queryKey: favoritesQueryKey }),
    ]);
    // Refetch all queries with fresh data
    await Promise.all([refetchStyles(), refetchPublicStyles()]);
  };

  /**
   * Analyze images with AI to extract style characteristics
   * Returns name, description, and generation prompt
   */
  const analyzeStyle = async (files: File[]): Promise<AnalyzeStyleResult | null> => {
    if (files.length === 0) return null;
    
    setIsAnalyzing(true);
    try {
      const { result, error } = await stylesService.analyzeStyle(files);
      
      if (error || !result) {
        console.error("Style analysis failed:", error);
        return null;
      }
      
      return {
        name: result.name || "",
        description: result.description || "",
        prompt: result.prompt || "",
      };
    } catch (err) {
      console.error("Style analysis error:", err);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Extract a common style from multiple YouTube thumbnail URLs
   * Returns name, description, prompt, and reference_images for creating a style
   */
  const extractStyleFromYouTube = async (
    imageUrls: string[]
  ): Promise<ExtractStyleFromYouTubeResult | null> => {
    if (imageUrls.length < 2) return null;

    setIsExtractingFromYouTube(true);
    try {
      const { result, error } = await stylesService.extractStyleFromYouTube(imageUrls);

      if (error || !result) {
        console.error("Extract style from YouTube failed:", error);
        return null;
      }

      return result;
    } catch (err) {
      console.error("Extract style from YouTube error:", err);
      return null;
    } finally {
      setIsExtractingFromYouTube(false);
    }
  };

  /**
   * Generate a preview thumbnail for a style using AI
   * Returns the URL of the generated preview image
   */
  const generatePreview = async (
    prompt: string,
    referenceImageUrl?: string
  ): Promise<GeneratePreviewResult | null> => {
    if (!prompt.trim()) return null;
    
    setIsGeneratingPreview(true);
    try {
      const { imageUrl, error } = await stylesService.generateStylePreview({
        prompt: prompt.trim(),
        referenceImageUrl,
      });
      
      if (error || !imageUrl) {
        console.error("Preview generation failed:", error);
        return null;
      }
      
      return { imageUrl };
    } catch (err) {
      console.error("Preview generation error:", err);
      return null;
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  // Combine loading and error states
  const isLoading = stylesLoading || 
    createMutation.isPending || 
    updateMutation.isPending || 
    deleteMutation.isPending || 
    togglePublicMutation.isPending ||
    toggleFavoriteMutation.isPending ||
    addReferenceImagesMutation.isPending ||
    removeReferenceImageMutation.isPending ||
    updatePreviewMutation.isPending;

  const error = (stylesError as Error | null) || 
    (createMutation.error as Error | null) || 
    (updateMutation.error as Error | null) || 
    (deleteMutation.error as Error | null) ||
    (togglePublicMutation.error as Error | null) ||
    (toggleFavoriteMutation.error as Error | null) ||
    (addReferenceImagesMutation.error as Error | null) ||
    (removeReferenceImageMutation.error as Error | null) ||
    (updatePreviewMutation.error as Error | null);

  return {
    styles,
    publicStyles,
    defaultStyles,
    isLoading,
    isAnalyzing,
    isGeneratingPreview,
    isExtractingFromYouTube,
    error,
    favoriteIds,
    fetchStyles,
    fetchPublicStyles,
    createStyle,
    updateStyle,
    deleteStyle,
    togglePublic,
    toggleFavorite,
    addReferenceImages,
    removeReferenceImage,
    updatePreview,
    refresh,
    analyzeStyle,
    extractStyleFromYouTube,
    generatePreview,
  };
}
