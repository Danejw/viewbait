"use client";

/**
 * Generator Settings Hook
 * 
 * Manages settings state (face, style, palette, aspect ratio, resolution, variations)
 * and handles localStorage persistence.
 */

import { useState, useEffect, useRef, useCallback } from "react";

const MANUAL_SETTINGS_STORAGE_KEY = "thumbnail-generator-manual-settings";

export interface ManualSettings {
  thumbnailText: string;
  includeFace: boolean;
  selectedFaces: string[];
  expression: string | null;
  pose: string | null;
  styleReferences: string[];
  selectedStyle: string | null;
  selectedColor: string | null;
  selectedAspectRatio: string;
  selectedResolution: string;
  customInstructions: string;
  variations: number;
}

const getDefaultSettings = (): Omit<ManualSettings, "thumbnailText" | "customInstructions"> => {
  return {
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
  };
};

const loadManualSettings = (): ManualSettings | null => {
  if (typeof window === "undefined") return null;
  
  try {
    const stored = localStorage.getItem(MANUAL_SETTINGS_STORAGE_KEY);
    if (!stored) return null;
    
    return JSON.parse(stored) as ManualSettings;
  } catch (error) {
    console.error("Failed to load manual settings from localStorage:", error);
    return null;
  }
};

const saveManualSettings = (settings: Omit<ManualSettings, "thumbnailText" | "customInstructions">): void => {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(MANUAL_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save manual settings to localStorage:", error);
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      console.warn("localStorage quota exceeded, unable to save manual settings");
    }
  }
};

export interface UseGeneratorSettingsReturn {
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
  reset: () => void;
}

export interface UseGeneratorSettingsOptions {
  preselectedStyleId?: string | null;
  preselectedPaletteId?: string | null;
  onStyleApplied?: () => void;
  onPaletteApplied?: () => void;
}

export function useGeneratorSettings(
  options: UseGeneratorSettingsOptions = {}
): UseGeneratorSettingsReturn {
  const {
    preselectedStyleId,
    preselectedPaletteId,
    onStyleApplied,
    onPaletteApplied,
  } = options;

  const defaults = getDefaultSettings();
  
  const [includeFace, setIncludeFace] = useState(defaults.includeFace);
  const [selectedFaces, setSelectedFaces] = useState<string[]>(defaults.selectedFaces);
  const [expression, setExpression] = useState<string | null>(defaults.expression);
  const [pose, setPose] = useState<string | null>(defaults.pose);
  const [styleReferences, setStyleReferences] = useState<string[]>(defaults.styleReferences);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(defaults.selectedStyle);
  const [selectedColor, setSelectedColor] = useState<string | null>(defaults.selectedColor);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState(defaults.selectedAspectRatio);
  const [selectedResolution, setSelectedResolution] = useState(defaults.selectedResolution);
  const [variations, setVariations] = useState(defaults.variations);

  const isFirstSettingsSaveRef = useRef(true);

  // Handle preselected style
  useEffect(() => {
    if (preselectedStyleId) {
      setSelectedStyle(preselectedStyleId);
      onStyleApplied?.();
    }
  }, [preselectedStyleId, onStyleApplied]);

  // Handle preselected palette
  useEffect(() => {
    if (preselectedPaletteId) {
      setSelectedColor(preselectedPaletteId);
      onPaletteApplied?.();
    }
  }, [preselectedPaletteId, onPaletteApplied]);

  // Load settings from localStorage on mount
  useEffect(() => {
    const loadedSettings = loadManualSettings();
    if (loadedSettings) {
      // Only load settings if no preselected values are provided
      if (!preselectedStyleId) {
        setSelectedStyle(loadedSettings.selectedStyle);
      }
      if (!preselectedPaletteId) {
        setSelectedColor(loadedSettings.selectedColor);
      }
      // Load other settings regardless of preselected values
      setIncludeFace(loadedSettings.includeFace);
      setSelectedFaces(loadedSettings.selectedFaces);
      setExpression(loadedSettings.expression);
      setPose(loadedSettings.pose);
      setStyleReferences(loadedSettings.styleReferences);
      setSelectedAspectRatio(loadedSettings.selectedAspectRatio);
      setSelectedResolution(loadedSettings.selectedResolution);
      setVariations(loadedSettings.variations);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    // Skip saving on initial mount
    if (isFirstSettingsSaveRef.current) {
      isFirstSettingsSaveRef.current = false;
      return;
    }

    const settings: Omit<ManualSettings, "thumbnailText" | "customInstructions"> = {
      thumbnailText: "", // Not persisted here (handled by form hook)
      customInstructions: "", // Not persisted here (handled by form hook)
      includeFace,
      selectedFaces,
      expression,
      pose,
      styleReferences,
      selectedStyle,
      selectedColor,
      selectedAspectRatio,
      selectedResolution,
      variations,
    };
    
    saveManualSettings(settings);
  }, [
    includeFace,
    selectedFaces,
    expression,
    pose,
    styleReferences,
    selectedStyle,
    selectedColor,
    selectedAspectRatio,
    selectedResolution,
    variations,
  ]);

  const reset = useCallback(() => {
    const newDefaults = getDefaultSettings();
    setIncludeFace(newDefaults.includeFace);
    setSelectedFaces(newDefaults.selectedFaces);
    setExpression(newDefaults.expression);
    setPose(newDefaults.pose);
    setStyleReferences(newDefaults.styleReferences);
    setSelectedStyle(newDefaults.selectedStyle);
    setSelectedColor(newDefaults.selectedColor);
    setSelectedAspectRatio(newDefaults.selectedAspectRatio);
    setSelectedResolution(newDefaults.selectedResolution);
    setVariations(newDefaults.variations);
    
    // Clear localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(MANUAL_SETTINGS_STORAGE_KEY);
      } catch (error) {
        console.error("Failed to clear manual settings from localStorage:", error);
      }
    }
    
    // Reset the first save flag
    isFirstSettingsSaveRef.current = true;
  }, []);

  return {
    includeFace,
    setIncludeFace,
    selectedFaces,
    setSelectedFaces,
    expression,
    setExpression,
    pose,
    setPose,
    styleReferences,
    setStyleReferences,
    selectedStyle,
    setSelectedStyle,
    selectedColor,
    setSelectedColor,
    selectedAspectRatio,
    setSelectedAspectRatio,
    selectedResolution,
    setSelectedResolution,
    variations,
    setVariations,
    reset,
  };
}
