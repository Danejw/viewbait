"use client";

/**
 * LocalStorage Hook
 * 
 * Reusable hook for managing localStorage persistence with React state.
 * Handles SSR safety, error handling, and automatic synchronization.
 */

import { useState, useEffect, useCallback, useRef } from "react";

export interface UseLocalStorageOptions<T> {
  /**
   * The localStorage key to use
   */
  key: string;
  /**
   * Default value to use if no value exists in localStorage
   */
  defaultValue: T;
  /**
   * Optional serializer (defaults to JSON.stringify)
   */
  serialize?: (value: T) => string;
  /**
   * Optional deserializer (defaults to JSON.parse)
   */
  deserialize?: (value: string) => T;
  /**
   * Whether to sync changes across tabs/windows (default: false)
   */
  syncAcrossTabs?: boolean;
  /**
   * Debounce delay in milliseconds for writes (default: 0, no debouncing)
   */
  debounceMs?: number;
}

export interface UseLocalStorageReturn<T> {
  /**
   * Current value from localStorage
   */
  value: T;
  /**
   * Setter function to update the value
   */
  setValue: (value: T | ((prev: T) => T)) => void;
  /**
   * Remove the value from localStorage
   */
  remove: () => void;
  /**
   * Whether the value is being loaded from localStorage (SSR)
   */
  isLoading: boolean;
}

/**
 * Hook for managing localStorage with React state
 * 
 * @example
 * const { value, setValue, remove } = useLocalStorage({
 *   key: 'my-key',
 *   defaultValue: { count: 0 }
 * });
 */
export function useLocalStorage<T>({
  key,
  defaultValue,
  serialize = JSON.stringify,
  deserialize = JSON.parse,
  syncAcrossTabs = false,
  debounceMs = 0,
}: UseLocalStorageOptions<T>): UseLocalStorageReturn<T> {
  const [value, setValueState] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const isFirstRenderRef = useRef(true);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingValueRef = useRef<T | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      setIsLoading(false);
      return;
    }

    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        const parsed = deserialize(stored);
        setValueState(parsed);
      }
    } catch (error) {
      console.warn(`Failed to load from localStorage for key "${key}" (storage may be full or unavailable):`, error);
    } finally {
      setIsLoading(false);
    }
  }, [key, deserialize]);

  // Save to localStorage when value changes (skip first render, with optional debouncing)
  useEffect(() => {
    if (isLoading || isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    if (typeof window === "undefined") return;

    // Store the current value for debounced write
    pendingValueRef.current = value;

    // Clear any existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // If debouncing is enabled, schedule the write
    if (debounceMs > 0) {
      debounceTimeoutRef.current = setTimeout(() => {
        const valueToSave = pendingValueRef.current;
        if (valueToSave !== null) {
          try {
            const serialized = serialize(valueToSave);
            localStorage.setItem(key, serialized);
            pendingValueRef.current = null;
          } catch (error) {
            console.warn(`localStorage write failed for key "${key}" (quota or storage error):`, error);
          }
        }
      }, debounceMs);
    } else {
      // No debouncing, write immediately
      try {
        const serialized = serialize(value);
        localStorage.setItem(key, serialized);
      } catch (error) {
        console.warn(`localStorage write failed for key "${key}" (quota or storage error):`, error);
      }
    }

    // Cleanup timeout on unmount or value change
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [key, value, serialize, isLoading, debounceMs]);

  // Sync across tabs if enabled
  useEffect(() => {
    if (!syncAcrossTabs || typeof window === "undefined") return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const parsed = deserialize(e.newValue);
          setValueState(parsed);
        } catch (error) {
          console.error(`Failed to deserialize value from storage event for key "${key}":`, error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [key, deserialize, syncAcrossTabs]);

  const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValueState((prev) => {
      if (typeof newValue === "function") {
        return (newValue as (prev: T) => T)(prev);
      }
      return newValue;
    });
  }, []);

  const remove = useCallback(() => {
    if (typeof window === "undefined") return;
    
    // Clear any pending debounced writes
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    pendingValueRef.current = null;
    
    try {
      localStorage.removeItem(key);
      setValueState(defaultValue);
    } catch (error) {
      console.warn(`Failed to remove from localStorage for key "${key}":`, error);
    }
  }, [key, defaultValue]);

  return {
    value,
    setValue,
    remove,
    isLoading,
  };
}
