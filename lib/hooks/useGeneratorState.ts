"use client";

/**
 * Generator State Hook
 * 
 * Consolidated state management for the thumbnail generator.
 * Combines form state, settings state, and generation state into a single hook
 * using useReducer for better state management and synchronization.
 */

import { useReducer, useEffect, useRef, useCallback } from "react";
import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";
import * as thumbnailsService from "@/lib/services/thumbnails";
import { logClientError } from "@/lib/utils/client-logger";
import type { Thumbnail } from "@/app/components/ThumbnailCard";
import type { DbStyle, DbPalette } from "@/lib/types/database";
import { useLocalStorage } from "./useLocalStorage";

const MANUAL_SETTINGS_STORAGE_KEY = "thumbnail-generator-manual-settings";

/**
 * Complete generator state
 */
export interface GeneratorState {
  // Form state
  thumbnailText: string;
  customInstructions: string;
  
  // Settings state
  includeFace: boolean;
  selectedFaces: string[];
  expression: string | null;
  pose: string | null;
  styleReferences: string[];
  selectedStyle: string | null;
  selectedColor: string | null;
  selectedAspectRatio: string;
  selectedResolution: string;
  variations: number;
  
  // Generation state
  isGenerating: boolean;
  isButtonDisabled: boolean;
  generationError: string | null;
  generatingItems: Map<string, Thumbnail>;
}

/**
 * Action types for the reducer
 */
type GeneratorAction =
  | { type: "SET_THUMBNAIL_TEXT"; payload: string }
  | { type: "SET_CUSTOM_INSTRUCTIONS"; payload: string }
  | { type: "SET_INCLUDE_FACE"; payload: boolean }
  | { type: "SET_SELECTED_FACES"; payload: string[] }
  | { type: "SET_EXPRESSION"; payload: string | null }
  | { type: "SET_POSE"; payload: string | null }
  | { type: "SET_STYLE_REFERENCES"; payload: string[] }
  | { type: "SET_SELECTED_STYLE"; payload: string | null }
  | { type: "SET_SELECTED_COLOR"; payload: string | null }
  | { type: "SET_SELECTED_ASPECT_RATIO"; payload: string }
  | { type: "SET_SELECTED_RESOLUTION"; payload: string }
  | { type: "SET_VARIATIONS"; payload: number }
  | { type: "SET_IS_GENERATING"; payload: boolean }
  | { type: "SET_IS_BUTTON_DISABLED"; payload: boolean }
  | { type: "SET_GENERATION_ERROR"; payload: string | null }
  | { type: "SET_GENERATING_ITEMS"; payload: Map<string, Thumbnail> }
  | { type: "ADD_GENERATING_ITEM"; payload: { id: string; item: Thumbnail } }
  | { type: "UPDATE_GENERATING_ITEM"; payload: { id: string; item: Partial<Thumbnail> } }
  | { type: "REMOVE_GENERATING_ITEM"; payload: string }
  | { type: "RESET_FORM" }
  | { type: "RESET_SETTINGS" }
  | { type: "RESET_GENERATION" }
  | { type: "RESET_ALL" }
  | { type: "LOAD_SETTINGS"; payload: Partial<GeneratorState> };

/**
 * Default state values
 */
const getDefaultState = (): GeneratorState => ({
  // Form state
  thumbnailText: "",
  customInstructions: "",
  
  // Settings state
  includeFace: false,
  selectedFaces: [],
  expression: null,
  pose: null,
  styleReferences: [],
  selectedStyle: "none",
  selectedColor: "none",
  selectedAspectRatio: "16:9",
  selectedResolution: "1K",
  variations: 1,
  
  // Generation state
  isGenerating: false,
  isButtonDisabled: false,
  generationError: null,
  generatingItems: new Map(),
});

/**
 * Settings that should be persisted to localStorage
 */
type PersistedSettings = Omit<
  GeneratorState,
  "thumbnailText" | "customInstructions" | "isGenerating" | "isButtonDisabled" | "generationError" | "generatingItems"
>;

/**
 * Reducer function
 */
function generatorReducer(state: GeneratorState, action: GeneratorAction): GeneratorState {
  switch (action.type) {
    case "SET_THUMBNAIL_TEXT":
      return { ...state, thumbnailText: action.payload };
    
    case "SET_CUSTOM_INSTRUCTIONS":
      return { ...state, customInstructions: action.payload };
    
    case "SET_INCLUDE_FACE":
      return { ...state, includeFace: action.payload };
    
    case "SET_SELECTED_FACES":
      return { ...state, selectedFaces: action.payload };
    
    case "SET_EXPRESSION":
      return { ...state, expression: action.payload };
    
    case "SET_POSE":
      return { ...state, pose: action.payload };
    
    case "SET_STYLE_REFERENCES":
      return { ...state, styleReferences: action.payload };
    
    case "SET_SELECTED_STYLE":
      return { ...state, selectedStyle: action.payload };
    
    case "SET_SELECTED_COLOR":
      return { ...state, selectedColor: action.payload };
    
    case "SET_SELECTED_ASPECT_RATIO":
      return { ...state, selectedAspectRatio: action.payload };
    
    case "SET_SELECTED_RESOLUTION":
      return { ...state, selectedResolution: action.payload };
    
    case "SET_VARIATIONS":
      return { ...state, variations: action.payload };
    
    case "SET_IS_GENERATING":
      return { ...state, isGenerating: action.payload };
    
    case "SET_IS_BUTTON_DISABLED":
      return { ...state, isButtonDisabled: action.payload };
    
    case "SET_GENERATION_ERROR":
      return { ...state, generationError: action.payload };
    
    case "SET_GENERATING_ITEMS":
      return { ...state, generatingItems: action.payload };
    
    case "ADD_GENERATING_ITEM":
      return {
        ...state,
        generatingItems: new Map(state.generatingItems).set(action.payload.id, action.payload.item),
      };
    
    case "UPDATE_GENERATING_ITEM": {
      const updated = new Map(state.generatingItems);
      const existing = updated.get(action.payload.id);
      if (existing) {
        updated.set(action.payload.id, { ...existing, ...action.payload.item });
      }
      return { ...state, generatingItems: updated };
    }
    
    case "REMOVE_GENERATING_ITEM": {
      const updated = new Map(state.generatingItems);
      updated.delete(action.payload);
      return { ...state, generatingItems: updated };
    }
    
    case "RESET_FORM":
      return {
        ...state,
        thumbnailText: "",
        customInstructions: "",
      };
    
    case "RESET_SETTINGS": {
      const defaults = getDefaultState();
      return {
        ...state,
        includeFace: defaults.includeFace,
        selectedFaces: defaults.selectedFaces,
        expression: defaults.expression,
        pose: defaults.pose,
        styleReferences: defaults.styleReferences,
        selectedStyle: defaults.selectedStyle,
        selectedColor: defaults.selectedColor,
        selectedAspectRatio: defaults.selectedAspectRatio,
        selectedResolution: defaults.selectedResolution,
        variations: defaults.variations,
      };
    }
    
    case "RESET_GENERATION":
      return {
        ...state,
        isGenerating: false,
        isButtonDisabled: false,
        generationError: null,
        generatingItems: new Map(),
      };
    
    case "RESET_ALL":
      return getDefaultState();
    
    case "LOAD_SETTINGS":
      return { ...state, ...action.payload };
    
    default:
      return state;
  }
}

/**
 * Options for the hook
 */
export interface UseGeneratorStateOptions {
  preselectedStyleId?: string | null;
  preselectedPaletteId?: string | null;
  onStyleApplied?: () => void;
  onPaletteApplied?: () => void;
  initialThumbnailText?: string;
  initialCustomInstructions?: string;
}

/**
 * Return type for the hook
 */
export interface UseGeneratorStateReturn {
  // Form state
  thumbnailText: string;
  setThumbnailText: (text: string) => void;
  customInstructions: string;
  setCustomInstructions: (instructions: string) => void;
  isValid: boolean;
  validate: () => boolean;
  
  // Settings state
  includeFace: boolean;
  setIncludeFace: (value: boolean) => void;
  selectedFaces: string[];
  setSelectedFaces: (faces: string[]) => void;
  expression: string | null;
  setExpression: (expr: string | null) => void;
  pose: string | null;
  setPose: (pose: string | null) => void;
  styleReferences: string[];
  setStyleReferences: (refs: string[]) => void;
  selectedStyle: string | null;
  setSelectedStyle: (style: string | null) => void;
  selectedColor: string | null;
  setSelectedColor: (color: string | null) => void;
  selectedAspectRatio: string;
  setSelectedAspectRatio: (ratio: string) => void;
  selectedResolution: string;
  setSelectedResolution: (resolution: string) => void;
  variations: number;
  setVariations: (variations: number) => void;
  
  // Generation state
  isGenerating: boolean;
  isButtonDisabled: boolean;
  error: string | null;
  generatingItems: Map<string, Thumbnail>;
  setGeneratingItems: React.Dispatch<React.SetStateAction<Map<string, Thumbnail>>>;
  generate: (options: GenerateOptions) => Promise<void>;
  resetError: () => void;
  
  // Reset functions
  resetForm: () => void;
  resetSettings: () => void;
  resetGeneration: () => void;
  reset: () => void;
}

/**
 * Options for the generate function
 */
export interface GenerateOptions {
  thumbnailText: string;
  expression?: string | null;
  pose?: string | null;
  currentStyle?: DbStyle | null;
  currentPalette?: DbPalette | null;
  resolution: string;
  aspectRatio: string;
  faceCharacters?: Array<{ images: string[] }>;
  styleReferences?: string[];
  customInstructions?: string;
  variations: number;
  onRefresh?: () => Promise<void>;
}

/**
 * Get default persisted settings
 */
const getDefaultPersistedSettings = (): PersistedSettings => {
  const defaults = getDefaultState();
  return {
    includeFace: defaults.includeFace,
    selectedFaces: defaults.selectedFaces,
    expression: defaults.expression,
    pose: defaults.pose,
    styleReferences: defaults.styleReferences,
    selectedStyle: defaults.selectedStyle,
    selectedColor: defaults.selectedColor,
    selectedAspectRatio: defaults.selectedAspectRatio,
    selectedResolution: defaults.selectedResolution,
    variations: defaults.variations,
  };
};

/**
 * Consolidated generator state hook
 */
export function useGeneratorState(
  options: UseGeneratorStateOptions = {}
): UseGeneratorStateReturn {
  const {
    preselectedStyleId,
    preselectedPaletteId,
    onStyleApplied,
    onPaletteApplied,
    initialThumbnailText = "",
    initialCustomInstructions = "",
  } = options;

  const { user, isAuthenticated } = useAuth();
  const {
    hasCredits,
    getResolutionCost,
    canUseResolution,
  } = useSubscription();

  const defaults = getDefaultState();
  const [state, dispatch] = useReducer(generatorReducer, {
    ...defaults,
    thumbnailText: initialThumbnailText,
    customInstructions: initialCustomInstructions,
  });

  const buttonTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef(state);
  const isInitialLoadRef = useRef(true);
  
  // Keep state ref in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Use localStorage hook with debouncing (500ms)
  const defaultPersistedSettings = getDefaultPersistedSettings();
  const { value: persistedSettings, setValue: setPersistedSettings, isLoading: isLoadingSettings } = useLocalStorage<PersistedSettings>({
    key: MANUAL_SETTINGS_STORAGE_KEY,
    defaultValue: defaultPersistedSettings,
    debounceMs: 500,
  });

  // Load settings from localStorage on mount (after loading completes)
  useEffect(() => {
    if (isLoadingSettings) return;

    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      
      // Only load settings if no preselected values are provided
      const settingsToLoad: Partial<GeneratorState> = {
        includeFace: persistedSettings.includeFace,
        selectedFaces: persistedSettings.selectedFaces,
        expression: persistedSettings.expression,
        pose: persistedSettings.pose,
        styleReferences: persistedSettings.styleReferences,
        selectedAspectRatio: persistedSettings.selectedAspectRatio,
        selectedResolution: persistedSettings.selectedResolution,
        variations: persistedSettings.variations,
      };
      
      if (!preselectedStyleId) {
        settingsToLoad.selectedStyle = persistedSettings.selectedStyle;
      }
      if (!preselectedPaletteId) {
        settingsToLoad.selectedColor = persistedSettings.selectedColor;
      }
      
      dispatch({ type: "LOAD_SETTINGS", payload: settingsToLoad });
    }
  }, [isLoadingSettings, persistedSettings, preselectedStyleId, preselectedPaletteId]);

  // Handle preselected style
  useEffect(() => {
    if (preselectedStyleId) {
      dispatch({ type: "SET_SELECTED_STYLE", payload: preselectedStyleId });
      onStyleApplied?.();
    }
  }, [preselectedStyleId, onStyleApplied]);

  // Handle preselected palette
  useEffect(() => {
    if (preselectedPaletteId) {
      dispatch({ type: "SET_SELECTED_COLOR", payload: preselectedPaletteId });
      onPaletteApplied?.();
    }
  }, [preselectedPaletteId, onPaletteApplied]);

  // Save settings to localStorage whenever they change (debounced via useLocalStorage)
  useEffect(() => {
    // Skip saving during initial load
    if (isInitialLoadRef.current || isLoadingSettings) return;

    const settings: PersistedSettings = {
      includeFace: state.includeFace,
      selectedFaces: state.selectedFaces,
      expression: state.expression,
      pose: state.pose,
      styleReferences: state.styleReferences,
      selectedStyle: state.selectedStyle,
      selectedColor: state.selectedColor,
      selectedAspectRatio: state.selectedAspectRatio,
      selectedResolution: state.selectedResolution,
      variations: state.variations,
    };
    
    setPersistedSettings(settings);
  }, [
    state.includeFace,
    state.selectedFaces,
    state.expression,
    state.pose,
    state.styleReferences,
    state.selectedStyle,
    state.selectedColor,
    state.selectedAspectRatio,
    state.selectedResolution,
    state.variations,
    isLoadingSettings,
    setPersistedSettings,
  ]);

  // Track when all generations are complete
  useEffect(() => {
    if (state.generatingItems.size === 0 && state.isGenerating) {
      dispatch({ type: "SET_IS_GENERATING", payload: false });
    } else if (state.generatingItems.size > 0 && !state.isGenerating) {
      dispatch({ type: "SET_IS_GENERATING", payload: true });
    }
  }, [state.generatingItems.size, state.isGenerating]);

  // Form validation
  const validate = useCallback((): boolean => {
    return state.thumbnailText.trim().length > 0;
  }, [state.thumbnailText]);

  const isValid = validate();

  // Generation function
  const generate = useCallback(async (options: GenerateOptions) => {
    if (!isAuthenticated || !user) {
      dispatch({ type: "SET_GENERATION_ERROR", payload: "Please sign in to generate thumbnails" });
      return;
    }

    if (!options.thumbnailText.trim()) {
      dispatch({ type: "SET_GENERATION_ERROR", payload: "Please enter thumbnail text" });
      return;
    }

    // Validate resolution access
    const resolution = options.resolution as '1K' | '2K' | '4K';
    if (!canUseResolution(resolution)) {
      dispatch({ type: "SET_GENERATION_ERROR", payload: `Resolution ${resolution} is not available for your subscription tier` });
      return;
    }

    // Check credits for all variations
    const creditCost = getResolutionCost(resolution);
    const totalCreditCost = creditCost * options.variations;
    if (!hasCredits(totalCreditCost)) {
      dispatch({ type: "SET_GENERATION_ERROR", payload: `Insufficient credits. You need ${totalCreditCost} credits to generate ${options.variations} ${resolution} thumbnail(s).` });
      return;
    }

    dispatch({ type: "SET_IS_GENERATING", payload: true });
    dispatch({ type: "SET_IS_BUTTON_DISABLED", payload: true });
    dispatch({ type: "SET_GENERATION_ERROR", payload: null });

    // Clear any existing timeout
    if (buttonTimeoutRef.current) {
      clearTimeout(buttonTimeoutRef.current);
    }

    // Re-enable button after 12 seconds to allow queuing multiple generations
    buttonTimeoutRef.current = setTimeout(() => {
      dispatch({ type: "SET_IS_BUTTON_DISABLED", payload: false });
      buttonTimeoutRef.current = null;
    }, 12000);

    // Create skeleton items for all variations
    const baseTimestamp = Date.now();
    const skeletonItems: Array<{ tempId: string; skeleton: Thumbnail }> = [];
    
    for (let i = 0; i < options.variations; i++) {
      const tempId = `generating-${baseTimestamp}-${i}`;
      const skeletonItem: Thumbnail = {
        id: tempId,
        name: options.thumbnailText.trim(),
        imageUrl: "",
        prompt: options.thumbnailText.trim(),
        generating: true,
        isFavorite: false,
        isPublic: false,
        createdAt: new Date(),
        resolution: options.resolution,
      };
      skeletonItems.push({ tempId, skeleton: skeletonItem });
    }
    
    // Add all skeletons to generating items
    const updatedItems = new Map(state.generatingItems);
    skeletonItems.forEach(({ tempId, skeleton }) => {
      updatedItems.set(tempId, skeleton);
    });
    dispatch({ type: "SET_GENERATING_ITEMS", payload: updatedItems });

    try {
      // Prepare generation options
      const generateOptions: Parameters<typeof thumbnailsService.generateThumbnail>[0] = {
        title: options.thumbnailText.trim(),
        emotion: options.expression || undefined,
        pose: options.pose && options.pose !== "none" ? options.pose : undefined,
        style: options.currentStyle?.name || undefined,
        palette: options.currentPalette?.name || undefined,
        resolution,
        aspectRatio: options.aspectRatio,
        faceCharacters: options.faceCharacters,
        referenceImages: options.styleReferences && options.styleReferences.length > 0 ? options.styleReferences : undefined,
        customStyle: options.customInstructions?.trim() || undefined,
        thumbnailText: options.thumbnailText.trim(),
      };

      // Generate all variations in parallel
      const generationPromises = skeletonItems.map(({ tempId }) => 
        thumbnailsService.generateThumbnail(generateOptions)
          .then(({ result, error }) => {
            if (error) {
              const currentItems = new Map(stateRef.current.generatingItems);
              currentItems.delete(tempId);
              dispatch({ type: "SET_GENERATING_ITEMS", payload: currentItems });
              if (currentItems.size === 0) {
                dispatch({ type: "SET_IS_GENERATING", payload: false });
              }
              return { success: false, tempId, error: error.message };
            }

            if (result) {
              const currentItems = new Map(stateRef.current.generatingItems);
              const item = currentItems.get(tempId);
              if (item) {
                // Add cache-busting parameter to newly generated image URLs
                const imageUrl = result.imageUrl 
                  ? (result.imageUrl.includes('?') 
                      ? `${result.imageUrl}&_t=${Date.now()}` 
                      : `${result.imageUrl}?_t=${Date.now()}`)
                  : result.imageUrl;
                
                currentItems.set(result.thumbnailId || tempId, {
                  ...item,
                  id: result.thumbnailId || tempId,
                  imageUrl: imageUrl,
                  generating: false,
                });
                if (result.thumbnailId && result.thumbnailId !== tempId) {
                  currentItems.delete(tempId);
                }
              }
              dispatch({ type: "SET_GENERATING_ITEMS", payload: currentItems });
              
              return { success: true, tempId, result, thumbnailId: result.thumbnailId || tempId };
            }
            
            return { success: false, tempId, error: 'No result returned' };
          })
          .catch((err) => {
            const currentItems = new Map(stateRef.current.generatingItems);
            currentItems.delete(tempId);
            dispatch({ type: "SET_GENERATING_ITEMS", payload: currentItems });
            if (currentItems.size === 0) {
              dispatch({ type: "SET_IS_GENERATING", payload: false });
            }
            return { 
              success: false, 
              tempId, 
              error: err instanceof Error ? err.message : 'Failed to generate thumbnail' 
            };
          })
      );

      // Wait for all variations to complete
      const results = await Promise.allSettled(generationPromises);
      
      // Collect successful thumbnail IDs to remove after refresh
      const successfulThumbnailIds: string[] = [];
      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value.success && r.value.thumbnailId) {
          successfulThumbnailIds.push(r.value.thumbnailId);
        }
      });
      
      // Wait 1 second for the generated image to render in the skeleton before refreshing
      // This ensures the image is visible before we refresh and remove from generatingItems
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Refresh thumbnails list from backend
      if (options.onRefresh) {
        await options.onRefresh();
        
        // Wait longer for React Query cache to propagate to dbThumbnails
        // Increased from 200ms to 500ms to ensure database items are fully available
        // This prevents race condition where we remove items before they appear in dbThumbnails
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Now that refreshThumbnails has completed and cache has propagated, remove successful items from generatingItems
        // They should now be in dbThumbnails
        // We need to remove items by checking both the key (which might be tempId or thumbnailId) 
        // and the item's id property (which should be thumbnailId after re-keying)
        const currentItems = new Map(stateRef.current.generatingItems);
        const successfulThumbnailIdsSet = new Set(successfulThumbnailIds);
        
        // Remove items whose id matches any successful thumbnailId
        // This handles both cases: items keyed by tempId (where id was updated to thumbnailId)
        // and items keyed by thumbnailId (where key and id both match)
        for (const [key, item] of currentItems.entries()) {
          if (successfulThumbnailIdsSet.has(item.id)) {
            currentItems.delete(key);
          }
        }
        
        // Also try deleting by key directly (in case key matches thumbnailId)
        successfulThumbnailIds.forEach((thumbnailId) => {
          currentItems.delete(thumbnailId);
        });
        
        dispatch({ type: "SET_GENERATING_ITEMS", payload: currentItems });
        if (currentItems.size === 0) {
          dispatch({ type: "SET_IS_GENERATING", payload: false });
        }
      }
      
      // Check results and show error if all variations failed
      const failedResults = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      );
      
      if (failedResults.length === options.variations) {
        const errorMessages = failedResults
          .map((r) => {
            if (r.status === 'rejected') {
              return r.reason?.message || 'Unknown error';
            }
            return r.value.error || 'Unknown error';
          })
          .filter(Boolean);
        
        dispatch({ 
          type: "SET_GENERATION_ERROR", 
          payload: errorMessages.length > 0 
            ? `All variations failed: ${errorMessages[0]}` 
            : 'All variations failed to generate'
        });
      } else if (failedResults.length > 0) {
        const successCount = options.variations - failedResults.length;
        dispatch({ 
          type: "SET_GENERATION_ERROR", 
          payload: `${successCount} of ${options.variations} variation(s) generated successfully. Some variations failed.`
        });
      }
    } catch (err) {
      dispatch({ type: "SET_GENERATION_ERROR", payload: err instanceof Error ? err.message : "Failed to generate thumbnails" });
      const currentItems = new Map(stateRef.current.generatingItems);
      skeletonItems.forEach(({ tempId }) => {
        currentItems.delete(tempId);
      });
      dispatch({ type: "SET_GENERATING_ITEMS", payload: currentItems });
      if (currentItems.size === 0) {
        dispatch({ type: "SET_IS_GENERATING", payload: false });
      }
    }
  }, [isAuthenticated, user, canUseResolution, getResolutionCost, hasCredits]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (buttonTimeoutRef.current) {
        clearTimeout(buttonTimeoutRef.current);
      }
    };
  }, []);

  // Action creators
  const setThumbnailText = useCallback((text: string) => {
    dispatch({ type: "SET_THUMBNAIL_TEXT", payload: text });
  }, []);

  const setCustomInstructions = useCallback((instructions: string) => {
    dispatch({ type: "SET_CUSTOM_INSTRUCTIONS", payload: instructions });
  }, []);

  const setIncludeFace = useCallback((value: boolean) => {
    dispatch({ type: "SET_INCLUDE_FACE", payload: value });
  }, []);

  const setSelectedFaces = useCallback((faces: string[]) => {
    dispatch({ type: "SET_SELECTED_FACES", payload: faces });
  }, []);

  const setExpression = useCallback((expr: string | null) => {
    dispatch({ type: "SET_EXPRESSION", payload: expr });
  }, []);

  const setPose = useCallback((pose: string | null) => {
    dispatch({ type: "SET_POSE", payload: pose });
  }, []);

  const setStyleReferences = useCallback((refs: string[]) => {
    dispatch({ type: "SET_STYLE_REFERENCES", payload: refs });
  }, []);

  const setSelectedStyle = useCallback((style: string | null) => {
    dispatch({ type: "SET_SELECTED_STYLE", payload: style });
  }, []);

  const setSelectedColor = useCallback((color: string | null) => {
    dispatch({ type: "SET_SELECTED_COLOR", payload: color });
  }, []);

  const setSelectedAspectRatio = useCallback((ratio: string) => {
    dispatch({ type: "SET_SELECTED_ASPECT_RATIO", payload: ratio });
  }, []);

  const setSelectedResolution = useCallback((resolution: string) => {
    dispatch({ type: "SET_SELECTED_RESOLUTION", payload: resolution });
  }, []);

  const setVariations = useCallback((variations: number) => {
    dispatch({ type: "SET_VARIATIONS", payload: variations });
  }, []);

  const setGeneratingItems = useCallback((action: React.SetStateAction<Map<string, Thumbnail>>) => {
    if (typeof action === "function") {
      const newItems = action(stateRef.current.generatingItems);
      dispatch({ type: "SET_GENERATING_ITEMS", payload: newItems });
    } else {
      dispatch({ type: "SET_GENERATING_ITEMS", payload: action });
    }
  }, []);

  const resetError = useCallback(() => {
    dispatch({ type: "SET_GENERATION_ERROR", payload: null });
  }, []);

  const resetForm = useCallback(() => {
    dispatch({ type: "RESET_FORM" });
  }, []);

  const resetSettings = useCallback(() => {
    dispatch({ type: "RESET_SETTINGS" });
    setPersistedSettings(getDefaultPersistedSettings());
  }, [setPersistedSettings]);

  const resetGeneration = useCallback(() => {
    dispatch({ type: "RESET_GENERATION" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET_ALL" });
    setPersistedSettings(getDefaultPersistedSettings());
  }, [setPersistedSettings]);

  return {
    // Form state
    thumbnailText: state.thumbnailText,
    setThumbnailText,
    customInstructions: state.customInstructions,
    setCustomInstructions,
    isValid,
    validate,
    
    // Settings state
    includeFace: state.includeFace,
    setIncludeFace,
    selectedFaces: state.selectedFaces,
    setSelectedFaces,
    expression: state.expression,
    setExpression,
    pose: state.pose,
    setPose,
    styleReferences: state.styleReferences,
    setStyleReferences,
    selectedStyle: state.selectedStyle,
    setSelectedStyle,
    selectedColor: state.selectedColor,
    setSelectedColor,
    selectedAspectRatio: state.selectedAspectRatio,
    setSelectedAspectRatio,
    selectedResolution: state.selectedResolution,
    setSelectedResolution,
    variations: state.variations,
    setVariations,
    
    // Generation state
    isGenerating: state.isGenerating,
    isButtonDisabled: state.isButtonDisabled,
    error: state.generationError,
    generatingItems: state.generatingItems,
    setGeneratingItems,
    generate,
    resetError,
    
    // Reset functions
    resetForm,
    resetSettings,
    resetGeneration,
    reset,
  };
}
