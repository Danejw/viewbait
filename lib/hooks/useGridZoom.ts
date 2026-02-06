"use client";

import { useState, useCallback, useEffect } from "react";
import { DEFAULT_ZOOM_LEVEL, clampZoom, MAX_ZOOM, MIN_ZOOM } from "@/lib/utils/grid-zoom";

/**
 * Persisted grid zoom level (0–8) with optional localStorage.
 * Restores from storage in useEffect to avoid hydration mismatch.
 *
 * @param storageKey - localStorage key; use null for no persistence.
 * @returns [zoomLevel, setZoomLevel, handleZoomChange] where handleZoomChange accepts Slider's number[].
 */
export function useGridZoom(storageKey: string | null): [
  number,
  React.Dispatch<React.SetStateAction<number>>,
  (value: number[]) => void,
] {
  const [zoomLevel, setZoomLevel] = useState(DEFAULT_ZOOM_LEVEL);

  useEffect(() => {
    if (storageKey === null) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed)) setZoomLevel(clampZoom(parsed));
      }
    } catch {
      // ignore
    }
  }, [storageKey]);

  const handleZoomChange = useCallback(
    (value: number[]) => {
      const level = clampZoom(value[0] ?? DEFAULT_ZOOM_LEVEL);
      setZoomLevel(level);
      if (storageKey !== null) {
        try {
          localStorage.setItem(storageKey, String(level));
        } catch {
          // ignore
        }
      }
    },
    [storageKey]
  );

  return [zoomLevel, setZoomLevel, handleZoomChange];
}

export { MIN_ZOOM, MAX_ZOOM, DEFAULT_ZOOM_LEVEL };
