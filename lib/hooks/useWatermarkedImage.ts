"use client";

import { useEffect, useState } from "react";
import { applyQrWatermark } from "@/lib/utils/watermarkUtils";
import type { WatermarkOptions } from "@/lib/utils/watermarkUtils";

const MAX_CACHED_WATERMARKS = 50;
const urlCache = new Map<string, string>();

function setCachedUrl(key: string, objectUrl: string): void {
  if (urlCache.size >= MAX_CACHED_WATERMARKS) {
    const oldestKey = urlCache.keys().next().value;
    if (oldestKey !== undefined) {
      const revokeUrl = urlCache.get(oldestKey);
      urlCache.delete(oldestKey);
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    }
  }
  urlCache.set(key, objectUrl);
}

export interface UseWatermarkedImageOptions {
  /** When false, returns original imageUrl without fetching/watermarking. */
  enabled: boolean;
  /** Optional palette hex colors for QR styling. */
  paletteColors?: string[];
  /** Additional watermark options (size, padding, roundedRect, etc.). */
  watermarkOptions?: Partial<WatermarkOptions>;
}

export interface UseWatermarkedImageReturn {
  /** Display URL: watermarked object URL when enabled, else original imageUrl. */
  url: string | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Returns a watermarked image URL for preview when enabled (free tier). Fetches the image,
 * applies the QR watermark, and caches the result by imageUrl (and palette) so the same
 * image is not re-fetched/re-watermarked. Revokes object URLs on cleanup.
 */
export function useWatermarkedImage(
  imageUrl: string | null,
  options: UseWatermarkedImageOptions
): UseWatermarkedImageReturn {
  const { enabled, paletteColors, watermarkOptions = {} } = options;
  const [url, setUrl] = useState<string | null>(imageUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cacheKey =
    imageUrl && enabled
      ? `${imageUrl}|${paletteColors?.join(",") ?? ""}|${JSON.stringify(watermarkOptions)}`
      : null;

  useEffect(() => {
    if (!enabled || !imageUrl) {
      setUrl(imageUrl);
      setIsLoading(false);
      setError(null);
      return;
    }

    const cached = urlCache.get(cacheKey!);
    if (cached) {
      setUrl(cached);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await fetch(imageUrl, { mode: "cors" });
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        const watermarked = await applyQrWatermark(blob, {
          ...watermarkOptions,
          paletteColors,
        });
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(watermarked);
        setCachedUrl(cacheKey!, objectUrl);
        setUrl(objectUrl);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error(String(e)));
          setUrl(imageUrl);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, imageUrl, cacheKey, paletteColors, watermarkOptions]);

  return { url: url ?? imageUrl, isLoading, error };
}
