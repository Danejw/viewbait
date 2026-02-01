"use client";

/**
 * Thumbnail Generation Hook
 * 
 * Optimized hook for generating thumbnails via the API.
 * Handles loading states, skeleton items, and parallel generation.
 * 
 * Follows Vercel React Best Practices:
 * - async-parallel: Generate all variations in parallel
 * - rerender-functional-setstate: Use functional setState for stable callbacks
 * - rerender-memo: Memoize callbacks to prevent unnecessary re-renders
 */

import { useCallback, useRef, useState, useTransition } from "react";
import { generateThumbnail as generateThumbnailService } from "@/lib/services/thumbnails";
import type { GenerateThumbnailOptions } from "@/lib/services/thumbnails";
import type { Thumbnail } from "@/lib/types/database";

/**
 * Generation request options mapped from form state
 */
export interface GenerationRequest {
  thumbnailText: string;
  customInstructions?: string;
  selectedStyle?: string | null;
  selectedPalette?: string | null;
  selectedAspectRatio: string;
  selectedResolution: string;
  variations: number;
  styleReferences?: string[];
  faceCharacters?: Array<{ images: string[] }>;
  expression?: string | null;
  pose?: string | null;
  /** Optional project id; new thumbnails will be associated with this project */
  project_id?: string | null;
}

/**
 * Generation result with skeleton items for optimistic UI
 */
export interface GenerationResult {
  success: boolean;
  thumbnailId?: string;
  imageUrl?: string;
  error?: string;
}

/**
 * Hook state
 */
export interface ThumbnailGenerationState {
  isGenerating: boolean;
  isButtonDisabled: boolean;
  error: string | null;
  /** Map of temp ID -> skeleton/generated thumbnail for optimistic UI */
  generatingItems: Map<string, Thumbnail>;
}

/**
 * Hook return type
 */
export interface UseThumbnailGenerationReturn {
  state: ThumbnailGenerationState;
  generate: (request: GenerationRequest) => Promise<GenerationResult[]>;
  clearGeneratingItems: () => void;
  removeGeneratingItem: (id: string) => void;
  /** Remove all generating items whose id (key or item.id) is in the given set. Used to clear placeholders only when thumbnails appear in the list. */
  removeGeneratingItemsByIds: (ids: Set<string> | string[]) => void;
  clearError: () => void;
  isPending: boolean;
}

/**
 * Hook options: cooldown duration for the generate button (tier-based).
 */
export interface UseThumbnailGenerationOptions {
  /** Cooldown in ms before the generate button is re-enabled after a submission. Default 12000. */
  cooldownMs?: number;
}

/**
 * Create a skeleton thumbnail for optimistic UI
 */
function createSkeletonThumbnail(
  tempId: string,
  text: string,
  resolution: string
): Thumbnail {
  return {
    id: tempId,
    name: text,
    imageUrl: "",
    thumbnail400wUrl: null,
    thumbnail800wUrl: null,
    prompt: text,
    isFavorite: false,
    isPublic: false,
    createdAt: new Date(),
    generating: true,
    resolution,
  };
}

/**
 * Map form state to API request options
 */
function mapRequestToApiOptions(request: GenerationRequest): GenerateThumbnailOptions {
  return {
    title: request.thumbnailText.trim(),
    customStyle: request.customInstructions?.trim() || undefined,
    style: request.selectedStyle || undefined,
    palette: request.selectedPalette || undefined,
    aspectRatio: request.selectedAspectRatio,
    resolution: request.selectedResolution as '1K' | '2K' | '4K',
    variations: 1, // We handle variations ourselves for better skeleton UX
    referenceImages: request.styleReferences?.length ? request.styleReferences : undefined,
    faceCharacters: request.faceCharacters?.length ? request.faceCharacters : undefined,
    emotion: request.expression || undefined,
    pose: request.pose && request.pose !== "none" && request.pose !== "None" ? request.pose : undefined,
    thumbnailText: request.thumbnailText.trim(),
    project_id: request.project_id ?? undefined,
  };
}

const DEFAULT_COOLDOWN_MS = 12000;

/**
 * Thumbnail generation hook with optimistic UI support
 */
export function useThumbnailGeneration(
  options?: UseThumbnailGenerationOptions
): UseThumbnailGenerationReturn {
  const cooldownMs = options?.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const cooldownMsRef = useRef(cooldownMs);
  cooldownMsRef.current = cooldownMs;

  const [state, setState] = useState<ThumbnailGenerationState>({
    isGenerating: false,
    isButtonDisabled: false,
    error: null,
    generatingItems: new Map(),
  });
  
  const [isPending, startTransition] = useTransition();
  const buttonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef(state);
  
  // Keep ref in sync for callbacks
  stateRef.current = state;

  /**
   * Generate thumbnails with optimistic UI
   * Uses useTransition for non-blocking UI updates
   */
  const generate = useCallback(async (request: GenerationRequest): Promise<GenerationResult[]> => {
    const { thumbnailText, variations, selectedResolution } = request;
    
    if (!thumbnailText.trim()) {
      setState(prev => ({ ...prev, error: "Please enter thumbnail text" }));
      return [];
    }

    // Clear any existing timeout
    if (buttonTimeoutRef.current) {
      clearTimeout(buttonTimeoutRef.current);
    }

    // Create skeleton items for all variations
    const baseTimestamp = Date.now();
    const skeletonItems: Array<{ tempId: string; skeleton: Thumbnail }> = [];
    
    for (let i = 0; i < variations; i++) {
      const tempId = `generating-${baseTimestamp}-${i}`;
      const skeleton = createSkeletonThumbnail(tempId, thumbnailText.trim(), selectedResolution);
      skeletonItems.push({ tempId, skeleton });
    }

    // Update state with skeletons synchronously so CRT placeholders appear immediately
    // (e.g. on mobile when switching to Preview tab after tapping Generate)
    setState(prev => {
      const newItems = new Map(prev.generatingItems);
      skeletonItems.forEach(({ tempId, skeleton }) => {
        newItems.set(tempId, skeleton);
      });
      return {
        ...prev,
        isGenerating: true,
        isButtonDisabled: true,
        error: null,
        generatingItems: newItems,
      };
    });

    // Re-enable button after tier-based cooldown
    buttonTimeoutRef.current = setTimeout(() => {
      setState(prev => ({ ...prev, isButtonDisabled: false }));
      buttonTimeoutRef.current = null;
    }, cooldownMsRef.current);

    // Map request to API options
    const apiOptions = mapRequestToApiOptions(request);

    // Generate all variations in parallel (async-parallel best practice)
    const generationPromises = skeletonItems.map(async ({ tempId }) => {
      try {
        const { result, error } = await generateThumbnailService(apiOptions);
        
        if (error) {
          // Don't setState here; batch with final update after Promise.allSettled to avoid update storm and re-render loop.
          return { success: false, tempId, error: error.message };
        }

        if (result?.imageUrl && result?.thumbnailId) {
          const imageUrl = result.imageUrl.includes('?')
            ? `${result.imageUrl}&_t=${Date.now()}`
            : `${result.imageUrl}?_t=${Date.now()}`;
          return {
            success: true,
            tempId,
            thumbnailId: result.thumbnailId,
            imageUrl,
          };
        }

        return { success: false, tempId, error: "No result returned" };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to generate";
        // Don't setState here; batch with final update after Promise.allSettled to avoid update storm and re-render loop.
        return { success: false, tempId, error: errorMessage };
      }
    });

    // Wait for all to complete
    const results = await Promise.allSettled(generationPromises);
    
    // Process results
    const processedResults: GenerationResult[] = results.map(r => {
      if (r.status === "fulfilled") {
        return r.value;
      }
      return {
        success: false,
        error: r.reason instanceof Error ? r.reason.message : "Failed",
      };
    });

    // All promises have settled: apply failed-item state and stop generating in a single setState to avoid update storm and re-render loop.
    const failedCount = processedResults.filter(r => !r.success).length;
    let errorMessage: string | null = null;
    if (failedCount === variations) {
      errorMessage = processedResults.find(r => r.error)?.error ?? "All generations failed";
    } else if (failedCount > 0) {
      const successCount = variations - failedCount;
      errorMessage = `${successCount} of ${variations} generated successfully`;
    }
    const failedByTempId = processedResults.filter(
      (r): r is { success: false; tempId: string; error: string } =>
        !r.success && "tempId" in r && r.tempId != null && "error" in r && typeof r.error === "string"
    );
    const successByTempId = processedResults.filter(
      (r): r is { success: true; tempId: string; thumbnailId: string; imageUrl: string } =>
        r.success && "tempId" in r && "thumbnailId" in r && "imageUrl" in r
    );
    // #region agent log
    fetch("http://127.0.0.1:7250/ingest/503c3a58-0894-4f46-a41c-96a198c9eec9", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "useThumbnailGeneration.ts:after-allSettled",
        message: "setState after Promise.allSettled (isGenerating: false)",
        data: { failedCount, errorMessage: errorMessage ?? null },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "H5",
      }),
    }).catch(() => {});
    // #endregion
    setState(prev => {
      const newItems = new Map(prev.generatingItems);
      for (const { tempId, error: errMsg } of failedByTempId) {
        const existing = newItems.get(tempId);
        if (existing) {
          newItems.set(tempId, { ...existing, generating: false, error: errMsg });
        }
      }
      for (const { tempId, thumbnailId, imageUrl } of successByTempId) {
        const existing = newItems.get(tempId);
        if (existing) {
          newItems.delete(tempId);
          newItems.set(thumbnailId, {
            ...existing,
            id: thumbnailId,
            imageUrl,
            generating: false,
          });
        }
      }
      return {
        ...prev,
        generatingItems: newItems,
        isGenerating: false,
        ...(errorMessage !== null && { error: errorMessage }),
      };
    });

    return processedResults;
  }, []);

  /**
   * Clear all generating items (call after thumbnails are fetched from DB)
   */
  const clearGeneratingItems = useCallback(() => {
    startTransition(() => {
      setState(prev => ({
        ...prev,
        generatingItems: new Map(),
        isGenerating: false,
      }));
    });
  }, []);

  /**
   * Remove a specific generating item by ID
   */
  const removeGeneratingItem = useCallback((id: string) => {
    startTransition(() => {
      setState(prev => {
        const newItems = new Map(prev.generatingItems);
        // Try to find and remove by id (could be tempId or thumbnailId)
        newItems.delete(id);
        // Also check if any item has this ID as its id property
        for (const [key, item] of newItems.entries()) {
          if (item.id === id) {
            newItems.delete(key);
            break;
          }
        }
        return {
          ...prev,
          generatingItems: newItems,
          isGenerating: newItems.size > 0,
        };
      });
    });
  }, []);

  /**
   * Remove all generating items whose id (key or item.id) is in the given set.
   * Used to clear placeholders only when those thumbnails appear in the fetched list (data-driven clear).
   */
  const removeGeneratingItemsByIds = useCallback((ids: Set<string> | string[]) => {
    const idSet = ids instanceof Set ? ids : new Set(ids);
    if (idSet.size === 0) return;
    // #region agent log
    fetch("http://127.0.0.1:7250/ingest/503c3a58-0894-4f46-a41c-96a198c9eec9", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "useThumbnailGeneration.ts:removeGeneratingItemsByIds",
        message: "removeGeneratingItemsByIds called",
        data: { idsLen: idSet.size },
        timestamp: Date.now(),
        sessionId: "debug-session",
        hypothesisId: "H3",
      }),
    }).catch(() => {});
    // #endregion
    startTransition(() => {
      setState(prev => {
        const newItems = new Map(prev.generatingItems);
        for (const [key, item] of prev.generatingItems.entries()) {
          if (idSet.has(key) || idSet.has(item.id)) {
            newItems.delete(key);
          }
        }
        return {
          ...prev,
          generatingItems: newItems,
          isGenerating: newItems.size > 0,
        };
      });
    });
  }, []);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    state,
    generate,
    clearGeneratingItems,
    removeGeneratingItem,
    removeGeneratingItemsByIds,
    clearError,
    isPending,
  };
}
