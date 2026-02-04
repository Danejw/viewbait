"use client";

/**
 * Safe localStorage helpers with size caps and graceful handling of quota/NO_SPACE errors.
 * Use for large or unbounded payloads (e.g. chat history) so the app never throws on full storage.
 */

export interface SetItemWithCapOptions {
  /** Max serialized size in characters (UTF-16). If exceeded, trim is applied before write. */
  maxBytes?: number;
  /**
   * When payload exceeds maxBytes or when a storage error occurs, called to produce a smaller payload.
   * Should return a string that is strictly smaller (e.g. drop oldest entries).
   */
  trim?: (payload: string) => string;
  /** Storage backend; defaults to localStorage. Use sessionStorage for session-scoped cache. */
  storage?: Storage;
}

/**
 * Returns the item or null on any error (storage unavailable, quota, parse, etc.).
 * Does not throw.
 */
export function getItemSafe(
  key: string,
  options?: { storage?: Storage }
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const storage = options?.storage ?? localStorage;
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Sets an item with optional size cap and trim. On QuotaExceededError or other storage errors,
 * optionally retries once with a trimmed payload; never throws.
 */
export function setItemWithCap(
  key: string,
  payload: string,
  options: SetItemWithCapOptions = {}
): void {
  if (typeof window === "undefined") return;

  const { maxBytes, trim, storage: storageOption } = options;
  const storage = storageOption ?? localStorage;
  let toWrite = payload;

  if (maxBytes != null && trim && toWrite.length > maxBytes) {
    toWrite = trim(toWrite);
    while (toWrite.length > maxBytes && toWrite.length > 0) {
      const next = trim(toWrite);
      if (next.length >= toWrite.length) break;
      toWrite = next;
    }
  }

  const tryWrite = (value: string): boolean => {
    try {
      storage.setItem(key, value);
      return true;
    } catch (e) {
      if (e instanceof DOMException && e.name === "QuotaExceededError") {
        console.warn(`localStorage quota exceeded for key "${key}"`);
      } else {
        console.warn(`localStorage write failed for key "${key}":`, e);
      }
      return false;
    }
  };

  if (tryWrite(toWrite)) return;

  if (trim && toWrite.length > 0) {
    const trimmed = trim(toWrite);
    if (trimmed.length < toWrite.length) {
      tryWrite(trimmed);
    }
  }
}
