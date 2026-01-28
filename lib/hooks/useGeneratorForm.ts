"use client";

/**
 * Generator Form Hook
 * 
 * Manages form state for thumbnail text and custom instructions.
 * Provides validation and form utilities.
 * Persists form values to localStorage to maintain state across tab switches.
 */

import { useCallback, useEffect, useRef } from "react";
import { useLocalStorage } from "./useLocalStorage";

const FORM_SETTINGS_STORAGE_KEY = "thumbnail-generator-form-settings";

interface FormSettings {
  thumbnailText: string;
  customInstructions: string;
}

const defaultFormSettings: FormSettings = {
  thumbnailText: "",
  customInstructions: "",
};

export interface UseGeneratorFormReturn {
  thumbnailText: string;
  setThumbnailText: (text: string) => void;
  customInstructions: string;
  setCustomInstructions: (instructions: string) => void;
  isValid: boolean;
  validate: () => boolean;
  reset: () => void;
}

export interface UseGeneratorFormOptions {
  initialThumbnailText?: string;
  initialCustomInstructions?: string;
}

export function useGeneratorForm(
  options: UseGeneratorFormOptions = {}
): UseGeneratorFormReturn {
  const {
    initialThumbnailText,
    initialCustomInstructions,
  } = options;

  // Use localStorage to persist form settings with 500ms debouncing
  const { value: formSettings, setValue: setFormSettings, isLoading: isLoadingSettings } = useLocalStorage<FormSettings>({
    key: FORM_SETTINGS_STORAGE_KEY,
    defaultValue: defaultFormSettings,
    debounceMs: 500,
  });

  // Track if we've applied initial values to avoid overwriting localStorage
  const hasAppliedInitialValuesRef = useRef(false);

  // Apply initial values from options if provided (overrides localStorage)
  // Wait for localStorage to finish loading before applying initial values
  useEffect(() => {
    if (!isLoadingSettings && !hasAppliedInitialValuesRef.current && (initialThumbnailText !== undefined || initialCustomInstructions !== undefined)) {
      setFormSettings((prev) => ({
        thumbnailText: initialThumbnailText ?? prev.thumbnailText,
        customInstructions: initialCustomInstructions ?? prev.customInstructions,
      }));
      hasAppliedInitialValuesRef.current = true;
    }
  }, [isLoadingSettings, initialThumbnailText, initialCustomInstructions, setFormSettings]);

  // Extract values from formSettings
  const thumbnailText = formSettings.thumbnailText;
  const customInstructions = formSettings.customInstructions;

  // Wrapper setters that update the localStorage-backed state
  const setThumbnailText = useCallback((text: string) => {
    setFormSettings((prev) => ({ ...prev, thumbnailText: text }));
  }, [setFormSettings]);

  const setCustomInstructions = useCallback((instructions: string) => {
    setFormSettings((prev) => ({ ...prev, customInstructions: instructions }));
  }, [setFormSettings]);

  const validate = useCallback((): boolean => {
    return thumbnailText.trim().length > 0;
  }, [thumbnailText]);

  const isValid = validate();

  const reset = useCallback(() => {
    // Reset to defaults (empty strings) - this will be persisted to localStorage
    setFormSettings(defaultFormSettings);
  }, [setFormSettings]);

  return {
    thumbnailText,
    setThumbnailText,
    customInstructions,
    setCustomInstructions,
    isValid,
    validate,
    reset,
  };
}
