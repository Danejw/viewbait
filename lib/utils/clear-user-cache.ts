"use client";

/**
 * Clear all user-related cache on logout.
 * Removes React Query in-memory cache and known localStorage/sessionStorage keys
 * so that signing in as a different user on the same device does not expose
 * the previous user's data.
 */

import type { QueryClient } from "@tanstack/react-query";

/** localStorage keys that hold user-specific or session-specific data. */
const LOCAL_STORAGE_KEYS = [
  "studio-active-project-id",
  "thumbnail-assistant-chat-history",
  "thumbnail-generator-manual-settings",
  "thumbnail-generator-form-settings",
  "shared-gallery-zoom",
] as const;

/** sessionStorage keys that hold user-specific or session-specific data. */
const SESSION_STORAGE_KEYS = [
  "studio-assistant-chat",
  "viewbait:channel-import:lastQuery",
] as const;

/**
 * Clears React Query cache and all known user-related storage keys.
 * SSR-safe: no-op when window is undefined.
 * Catches and logs storage errors (e.g. private browsing) so one failure doesn't block the rest.
 */
export function clearUserCache(queryClient: QueryClient): void {
  queryClient.clear();

  if (typeof window === "undefined") return;

  for (const key of LOCAL_STORAGE_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[clearUserCache] Failed to remove localStorage key "${key}":`, e);
    }
  }

  for (const key of SESSION_STORAGE_KEYS) {
    try {
      sessionStorage.removeItem(key);
    } catch (e) {
      console.warn(`[clearUserCache] Failed to remove sessionStorage key "${key}":`, e);
    }
  }
}
