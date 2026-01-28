import { useMemo, useEffect, useRef, useCallback } from "react";
import { mapDbThumbnailToThumbnail } from "@/lib/types/database";
import type { Thumbnail } from "@/app/components/ThumbnailCard";
import type { DbThumbnail, DbStyle, DbPalette, DbFace } from "@/lib/types/database";
import type { UseGeneratorSettingsReturn } from "@/lib/hooks/useGeneratorSettings";

export interface UseGeneratorWorkflowProps {
  dbThumbnails: DbThumbnail[];
  generatingItems: Map<string, Thumbnail>;
  effectiveStyles: DbStyle[];
  effectivePalettes: DbPalette[];
  effectiveFaces: DbFace[];
  settings: UseGeneratorSettingsReturn;
}

export interface UseGeneratorWorkflowReturn {
  galleryItems: Thumbnail[];
  faceCharacters: Array<{ images: string[] }>;
  currentStyle: DbStyle | null;
  currentPalette: DbPalette | null;
  handleRemoveStyleReference: (imageUrl: string) => void;
}

/**
 * Custom hook that manages generator workflow logic:
 * - Gallery items computation
 * - Style reference management
 * - Face characters computation
 * - Current style/palette computation
 */
export function useGeneratorWorkflow({
  dbThumbnails,
  generatingItems,
  effectiveStyles,
  effectivePalettes,
  effectiveFaces,
  settings,
}: UseGeneratorWorkflowProps): UseGeneratorWorkflowReturn {
  // Extract stable setter function to avoid infinite loops
  const { setStyleReferences } = settings;
  
  // Track which images came from the currently selected style
  const currentStyleImagesRef = useRef<string[]>([]);

  // Build character groups with their reference images - memoized
  const faceCharacters = useMemo(() => {
    const characters = settings.selectedFaces
      .map((faceId) => {
        const face = effectiveFaces.find((f) => f.id === faceId);
        if (!face || !face.image_urls.length) return null;
        return { images: face.image_urls };
      })
      .filter((char): char is { images: string[] } => char !== null);
    
    // If more than 3 characters, randomly select one reference image per character
    if (characters.length > 3) {
      return characters.map((char) => {
        const randomIndex = Math.floor(Math.random() * char.images.length);
        return { images: [char.images[randomIndex]] };
      });
    }
    
    return characters;
  }, [settings.selectedFaces, effectiveFaces]);

  // Get style data - memoized
  const currentStyle = useMemo(() => {
    return settings.selectedStyle && settings.selectedStyle !== "none"
      ? effectiveStyles.find((s) => s.id === settings.selectedStyle)
      : null;
  }, [settings.selectedStyle, effectiveStyles]);

  // Get palette data - memoized
  const currentPalette = useMemo(() => {
    return settings.selectedColor && settings.selectedColor !== "default"
      ? effectivePalettes.find((p) => p.id === settings.selectedColor)
      : null;
  }, [settings.selectedColor, effectivePalettes]);

  // Automatically add style reference images and preview when a style is selected
  useEffect(() => {
    if (currentStyle) {
      const styleImages: string[] = [];
      
      if (currentStyle.reference_images && currentStyle.reference_images.length > 0) {
        styleImages.push(...currentStyle.reference_images);
      }
      
      if (currentStyle.preview_thumbnail_url) {
        styleImages.push(currentStyle.preview_thumbnail_url);
      }

      setStyleReferences((prev) => {
        const withoutPreviousStyle = prev.filter(
          (img) => !currentStyleImagesRef.current.includes(img)
        );
        
        const newImages = styleImages.filter(
          (img) => !withoutPreviousStyle.includes(img)
        );
        
        return [...withoutPreviousStyle, ...newImages];
      });

      currentStyleImagesRef.current = styleImages;
    } else {
      setStyleReferences((prev) => {
        return prev.filter((img) => !currentStyleImagesRef.current.includes(img));
      });
      currentStyleImagesRef.current = [];
    }
  }, [currentStyle, setStyleReferences]);

  // Convert DB thumbnails to frontend format and merge with generating items
  // Deduplicate by id to prevent race conditions when items transition from
  // generatingItems to dbThumbnails. Prefer generatingItems over dbItems
  // since they have the most recent state (including cache-busting URLs).
  const galleryItems: Thumbnail[] = useMemo(() => {
    const dbItems = dbThumbnails.map((db) => mapDbThumbnailToThumbnail(db));
    const generatingArray = Array.from(generatingItems.values());
    
    // Create a Map to deduplicate by id, preferring dbItems over generatingItems
    // This ensures that once a thumbnail is in the database, we use the stable database version
    // and generatingItems can be safely removed without causing the item to disappear
    const itemsMap = new Map<string, Thumbnail>();
    
    // First add generatingItems (these show loading state and cache-busting URLs during generation)
    generatingArray.forEach(item => {
      itemsMap.set(item.id, item);
    });
    
    // Then add/override with dbItems (these are stable, persisted items from database)
    // This ensures that once a thumbnail exists in the database, we use that version
    // and the generatingItem can be safely removed
    dbItems.forEach(item => {
      itemsMap.set(item.id, item);
    });
    
    // Sort by creation date (newest first) and limit to 28 items
    const allItems = Array.from(itemsMap.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
    const result = allItems.slice(0, 28);
    return result;
  }, [dbThumbnails, generatingItems]);

  // Handler to remove a style reference
  const handleRemoveStyleReference = useCallback((imageUrl: string) => {
    if (currentStyleImagesRef.current.includes(imageUrl)) {
      currentStyleImagesRef.current = currentStyleImagesRef.current.filter(
        (img) => img !== imageUrl
      );
    }
  }, []);

  return {
    galleryItems,
    faceCharacters,
    currentStyle,
    currentPalette,
    handleRemoveStyleReference,
  };
}
