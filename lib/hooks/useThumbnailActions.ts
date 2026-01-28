"use client";

/**
 * Thumbnail Actions Hook
 * 
 * Manages all thumbnail action handlers and selection state for modals.
 * Extracted from GeneratorTab to improve separation of concerns.
 */

import { useState, useCallback } from "react";
import * as thumbnailsService from "@/lib/services/thumbnails";
import { logClientError } from "@/lib/utils/client-logger";
import type { Thumbnail } from "@/app/components/ThumbnailCard";
import type { DbThumbnail } from "@/lib/types/database";
import type { UseModalManagerReturn } from "./useModalManager";

export interface UseThumbnailActionsParams {
  dbThumbnails: DbThumbnail[];
  galleryItems: Thumbnail[];
  generatingItems: Map<string, Thumbnail>;
  setGeneratingItems: React.Dispatch<React.SetStateAction<Map<string, Thumbnail>>>;
  refreshThumbnails: () => Promise<void>;
  updateThumbnailInHook: (id: string, data: { title?: string; liked?: boolean }) => Promise<DbThumbnail | null>;
  toggleFavoriteInHook: (id: string) => Promise<boolean>;
  togglePublicInHook: (id: string) => Promise<boolean>;
  deleteThumbnailInHook: (id: string) => Promise<boolean>;
  modals: UseModalManagerReturn;
  setError: (error: string | null) => void;
}

export interface UseThumbnailActionsReturn {
  // State
  selectedThumbnail: Thumbnail | null;
  viewingThumbnail: Thumbnail | null;
  thumbnailToDelete: Thumbnail | null;
  
  // Setters
  setSelectedThumbnail: (thumbnail: Thumbnail | null) => void;
  setViewingThumbnail: (thumbnail: Thumbnail | null) => void;
  setThumbnailToDelete: (thumbnail: Thumbnail | null) => void;
  
  // Action Handlers
  handleThumbnailFavorite: (id: string) => Promise<void>;
  handleThumbnailView: (thumbnail: Thumbnail) => void;
  handleThumbnailEdit: (id: string) => void;
  handleThumbnailSave: (updatedThumbnail: Thumbnail) => Promise<void>;
  handleThumbnailRegenerate: (prompt: string, referenceImages?: string[]) => Promise<void>;
  handleThumbnailTogglePublic: (id: string) => Promise<void>;
  handleThumbnailDelete: (id: string) => void;
  confirmDeleteThumbnail: () => Promise<void>;
}

/**
 * Hook to manage thumbnail action handlers and selection state
 */
export function useThumbnailActions({
  dbThumbnails,
  galleryItems,
  generatingItems,
  setGeneratingItems,
  refreshThumbnails,
  updateThumbnailInHook,
  toggleFavoriteInHook,
  togglePublicInHook,
  deleteThumbnailInHook,
  modals,
  setError,
}: UseThumbnailActionsParams): UseThumbnailActionsReturn {
  // Thumbnail selection state (for modals)
  const [selectedThumbnail, setSelectedThumbnail] = useState<Thumbnail | null>(null);
  const [viewingThumbnail, setViewingThumbnail] = useState<Thumbnail | null>(null);
  const [thumbnailToDelete, setThumbnailToDelete] = useState<Thumbnail | null>(null);

  // Handlers for thumbnail actions
  const handleThumbnailFavorite = useCallback(async (id: string) => {
    const dbThumbnail = dbThumbnails.find((t) => t.id === id);
    if (dbThumbnail) {
      await toggleFavoriteInHook(id);
      await refreshThumbnails();
    } else {
      setGeneratingItems((prev) => {
        const updated = new Map(prev);
        const item = updated.get(id);
        if (item) {
          updated.set(id, { ...item, isFavorite: !item.isFavorite });
        }
        return updated;
      });
    }
  }, [dbThumbnails, refreshThumbnails, toggleFavoriteInHook, setGeneratingItems]);

  const handleThumbnailView = useCallback((thumbnail: Thumbnail) => {
    setViewingThumbnail(thumbnail);
    modals.openViewerModal();
  }, [modals]);

  const handleThumbnailEdit = useCallback((id: string) => {
    const thumbnail = galleryItems.find((item) => item.id === id);
    if (thumbnail) {
      setSelectedThumbnail(thumbnail);
      modals.openEditModal();
    }
  }, [galleryItems, modals]);

  const handleThumbnailSave = useCallback(async (updatedThumbnail: Thumbnail) => {
    await updateThumbnailInHook(updatedThumbnail.id, {
      title: updatedThumbnail.name,
      liked: updatedThumbnail.isFavorite,
    });
    await refreshThumbnails();
    modals.closeEditModal();
    setSelectedThumbnail(null);
  }, [refreshThumbnails, updateThumbnailInHook, modals]);

  const handleThumbnailRegenerate = useCallback(async (prompt: string, referenceImages?: string[]) => {
    if (!selectedThumbnail) return;
    
    const tempId = `generating-${Date.now()}`;
    const skeletonItem: Thumbnail = {
      id: tempId,
      name: selectedThumbnail.name,
      imageUrl: "",
      thumbnail400wUrl: null,
      thumbnail800wUrl: null,
      prompt: prompt.trim(),
      generating: true,
      isFavorite: false,
      isPublic: false,
      createdAt: new Date(),
      resolution: selectedThumbnail.resolution,
    };
    
    setGeneratingItems((prev) => {
      const updated = new Map(prev);
      updated.set(tempId, skeletonItem);
      return updated;
    });

    try {
      const { result, error: editError } = await thumbnailsService.editThumbnail(
        selectedThumbnail.id,
        prompt,
        referenceImages
      );

      if (editError) {
        throw editError;
      }

      if (result) {
        setGeneratingItems((prev) => {
          const updated = new Map(prev);
          const item = updated.get(tempId);
          if (item) {
            const imageUrl = result.imageUrl 
              ? (result.imageUrl.includes('?') 
                  ? `${result.imageUrl}&_t=${Date.now()}` 
                  : `${result.imageUrl}?_t=${Date.now()}`)
              : result.imageUrl;
            
            updated.set(result.thumbnailId || tempId, {
              ...item,
              id: result.thumbnailId || tempId,
              imageUrl: imageUrl,
              generating: false,
            });
            if (result.thumbnailId && result.thumbnailId !== tempId) {
              updated.delete(tempId);
            }
          }
          return updated;
        });
        
        // Wait 1 second for the generated image to render in the skeleton before refreshing
        // This ensures the image is visible before we refresh and remove from generatingItems
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await refreshThumbnails();
        
        // Wait a bit for React Query cache to propagate to dbThumbnails
        // This prevents race condition where we remove items before they appear in dbThumbnails
        await new Promise(resolve => setTimeout(resolve, 200));
        
        setGeneratingItems((prev) => {
          const updated = new Map(prev);
          updated.delete(result.thumbnailId || tempId);
          return updated;
        });
      }
    } catch (error) {
      logClientError(error, {
        operation: "regenerate-thumbnail",
        component: "useThumbnailActions",
      });
      
      let errorMessage = error instanceof Error ? error.message : 'Failed to edit thumbnail';
      
      // Check for refund failure warning in error
      if (error instanceof Error && (error as any).refundFailureWarning) {
        const warning = (error as any).refundFailureWarning;
        errorMessage = `${errorMessage}\n\nWarning: ${warning.amount} credit(s) could not be refunded. Please contact support with request ID: ${warning.requestId}`;
      }
      
      setError(errorMessage);
      
      setGeneratingItems((prev) => {
        const updated = new Map(prev);
        updated.delete(tempId);
        return updated;
      });
    }
  }, [selectedThumbnail, setGeneratingItems, refreshThumbnails]);

  const handleThumbnailTogglePublic = useCallback(async (id: string) => {
    const dbThumbnail = dbThumbnails.find((t) => t.id === id);
    if (dbThumbnail) {
      await togglePublicInHook(id);
    } else {
      setGeneratingItems((prev) => {
        const updated = new Map(prev);
        const item = updated.get(id);
        if (item) {
          updated.set(id, { ...item, isPublic: !item.isPublic });
        }
        return updated;
      });
    }
  }, [dbThumbnails, togglePublicInHook, setGeneratingItems]);

  const handleThumbnailDelete = useCallback((id: string) => {
    const thumbnail = galleryItems.find((item) => item.id === id);
    if (thumbnail) {
      setThumbnailToDelete(thumbnail);
      modals.openDeleteModal();
    }
  }, [galleryItems, modals]);

  const confirmDeleteThumbnail = useCallback(async () => {
    if (!thumbnailToDelete) return;

    const id = thumbnailToDelete.id;
    const dbThumbnail = dbThumbnails.find((t) => t.id === id);
    
    if (dbThumbnail) {
      const success = await deleteThumbnailInHook(id);
      if (success) {
        await refreshThumbnails();
      } else {
        setError("Failed to delete thumbnail");
      }
    } else {
      setGeneratingItems((prev) => {
        const updated = new Map(prev);
        updated.delete(id);
        return updated;
      });
    }

    modals.closeDeleteModal();
    setThumbnailToDelete(null);
  }, [thumbnailToDelete, dbThumbnails, deleteThumbnailInHook, refreshThumbnails, modals, setGeneratingItems, setError]);

  return {
    selectedThumbnail,
    viewingThumbnail,
    thumbnailToDelete,
    setSelectedThumbnail,
    setViewingThumbnail,
    setThumbnailToDelete,
    handleThumbnailFavorite,
    handleThumbnailView,
    handleThumbnailEdit,
    handleThumbnailSave,
    handleThumbnailRegenerate,
    handleThumbnailTogglePublic,
    handleThumbnailDelete,
    confirmDeleteThumbnail,
  };
}
