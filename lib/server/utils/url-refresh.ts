/**
 * URL Refresh Utility
 * 
 * Centralized logic for refreshing signed URLs from Supabase Storage.
 * Eliminates duplication across API routes.
 * 
 * Optimized to only refresh URLs that are expired or within 7 days of expiry.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type BucketName = 'thumbnails' | 'faces' | 'style-previews' | 'style-references'

/** 1 year in seconds; use for signed URL expiry and cache-control where applicable. */
export const SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

const DEFAULT_EXPIRY = SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS
const REFRESH_THRESHOLD_DAYS = 7 // Refresh if within 7 days of expiry
const REFRESH_THRESHOLD_SECONDS = 60 * 60 * 24 * REFRESH_THRESHOLD_DAYS

// In-memory cache for request duration (prevents duplicate refreshes in same request)
const urlCache = new Map<string, { url: string; expiresAt: number }>()

/**
 * Check if a signed URL is expired or within the refresh threshold
 * @param url The signed URL to check
 * @returns true if URL should be refreshed, false if still valid
 */
function shouldRefreshUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const expiresParam = urlObj.searchParams.get('expires')
    
    // If no expires parameter, assume it needs refresh
    if (!expiresParam) {
      return true
    }
    
    const expiresTimestamp = parseInt(expiresParam, 10)
    
    // If invalid timestamp, refresh
    if (isNaN(expiresTimestamp)) {
      return true
    }
    
    // Convert to milliseconds and check if expired or within threshold
    const expiresAt = expiresTimestamp * 1000
    const now = Date.now()
    const thresholdTime = now + (REFRESH_THRESHOLD_SECONDS * 1000)
    
    // Refresh if expired or within threshold
    return expiresAt <= thresholdTime
  } catch {
    // Invalid URL format, refresh it
    return true
  }
}

/**
 * Extract storage path from a signed URL
 */
export function extractStoragePath(url: string, bucket: BucketName): string | null {
  const pattern = new RegExp(`/storage/v1/object/sign/${bucket}/([^?]+)`)
  const match = url.match(pattern)
  return match ? match[1] : null
}

/**
 * Refresh a single signed URL
 * Only refreshes if URL is expired or within 7 days of expiry
 * Uses in-memory cache to avoid duplicate refreshes in the same request
 */
async function refreshSingleUrl(
  supabase: SupabaseClient,
  bucket: BucketName,
  url: string,
  fallbackPath?: string
): Promise<string> {
  // Check cache first (for request duration)
  const cacheKey = `${bucket}:${url}`
  const cached = urlCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.url
  }

  // Check if URL needs refresh (not expired and not within threshold)
  if (!shouldRefreshUrl(url)) {
    // URL is still valid, cache it and return
    const urlObj = new URL(url)
    const expiresParam = urlObj.searchParams.get('expires')
    const expiresAt = expiresParam ? parseInt(expiresParam, 10) * 1000 : Date.now() + (DEFAULT_EXPIRY * 1000)
    urlCache.set(cacheKey, { url, expiresAt })
    return url
  }

  // URL needs refresh - extract path and refresh
  let storagePath = extractStoragePath(url, bucket)

  // If extraction failed and fallback provided, use it
  if (!storagePath && fallbackPath) {
    storagePath = fallbackPath
  }

  // If we have a path, refresh it
  if (storagePath) {
    const { data: urlData } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storagePath, DEFAULT_EXPIRY)
    
    if (urlData?.signedUrl) {
      // Cache the refreshed URL
      const refreshedUrlObj = new URL(urlData.signedUrl)
      const expiresParam = refreshedUrlObj.searchParams.get('expires')
      const expiresAt = expiresParam ? parseInt(expiresParam, 10) * 1000 : Date.now() + (DEFAULT_EXPIRY * 1000)
      urlCache.set(cacheKey, { url: urlData.signedUrl, expiresAt })
      return urlData.signedUrl
    }
  }

  // Fallback: try common extensions if we have a base path pattern
  if (fallbackPath) {
    const extensions = ['png', 'jpg', 'jpeg', 'webp']
    for (const ext of extensions) {
      // Replace extension in fallback path
      const pathWithExt = fallbackPath.replace(/\.(png|jpg|jpeg|webp)$/i, `.${ext}`)
      const { data: urlData } = await supabase.storage
        .from(bucket)
        .createSignedUrl(pathWithExt, DEFAULT_EXPIRY)
      if (urlData?.signedUrl) {
        // Cache the refreshed URL
        const refreshedUrlObj = new URL(urlData.signedUrl)
        const expiresParam = refreshedUrlObj.searchParams.get('expires')
        const expiresAt = expiresParam ? parseInt(expiresParam, 10) * 1000 : Date.now() + (DEFAULT_EXPIRY * 1000)
        urlCache.set(cacheKey, { url: urlData.signedUrl, expiresAt })
        return urlData.signedUrl
      }
    }
  }

  // Last resort: return original URL
  return url
}

/**
 * Clear the URL cache (useful for testing or manual cache invalidation)
 */
export function clearUrlCache(): void {
  urlCache.clear()
}

/**
 * Refresh thumbnail image URLs
 */
export async function refreshThumbnailUrls<T extends { id: string; image_url: string | null }>(
  supabase: SupabaseClient,
  thumbnails: T[],
  userId: string
): Promise<T[]> {
  return Promise.all(
    thumbnails.map(async (thumb) => {
      // If image_url is null or empty, try to generate it from fallback path
      if (!thumb.image_url || thumb.image_url.trim() === '') {
        const fallbackPath = `${userId}/${thumb.id}/thumbnail.png`
        // Try to create signed URL from fallback path
        const { data: urlData } = await supabase.storage
          .from('thumbnails')
          .createSignedUrl(fallbackPath, DEFAULT_EXPIRY)
        
        if (urlData?.signedUrl) {
          return {
            ...thumb,
            image_url: urlData.signedUrl,
          } as T
        }
        
        // If fallback fails, try common extensions
        const extensions = ['png', 'jpg', 'jpeg', 'webp']
        for (const ext of extensions) {
          const pathWithExt = fallbackPath.replace(/\.(png|jpg|jpeg|webp)$/i, `.${ext}`)
          const { data: extUrlData } = await supabase.storage
            .from('thumbnails')
            .createSignedUrl(pathWithExt, DEFAULT_EXPIRY)
          if (extUrlData?.signedUrl) {
            return {
              ...thumb,
              image_url: extUrlData.signedUrl,
            } as T
          }
        }
        
        // If all attempts fail, return original (null/empty)
        return thumb
      }
      
      // If image_url exists, refresh it normally
      const fallbackPath = `${userId}/${thumb.id}/thumbnail.png`
      const refreshedUrl = await refreshSingleUrl(
        supabase,
        'thumbnails',
        thumb.image_url,
        fallbackPath
      )

      return {
        ...thumb,
        image_url: refreshedUrl,
      } as T
    })
  )
}

/**
 * Refresh face image URLs (array of URLs)
 */
export async function refreshFaceUrls<T extends { id: string; image_urls: string[] }>(
  supabase: SupabaseClient,
  faces: T[],
  userId: string
): Promise<T[]> {
  return Promise.all(
    faces.map(async (face) => {
      const refreshedUrls = await Promise.all(
        face.image_urls.map(async (url: string, index: number) => {
          const fallbackPath = `${userId}/${face.id}/${index}.png`
          return refreshSingleUrl(supabase, 'faces', url, fallbackPath)
        })
      )

      return {
        ...face,
        image_urls: refreshedUrls.filter((url): url is string => url !== null && url !== undefined),
      } as T
    })
  )
}

/**
 * Refresh style reference image URLs (array of URLs)
 */
export async function refreshStyleUrls<T extends { id: string; reference_images?: string[] }>(
  supabase: SupabaseClient,
  styles: T[],
  userId: string
): Promise<T[]> {
  return Promise.all(
    styles.map(async (style) => {
      if (!style.reference_images || style.reference_images.length === 0) {
        return style
      }

      const refreshedUrls = await Promise.all(
        style.reference_images.map(async (url: string) => {
          return refreshSingleUrl(supabase, 'style-references', url)
        })
      )

      return {
        ...style,
        reference_images: refreshedUrls.filter((url): url is string => url !== null && url !== undefined),
      } as T
    })
  )
}

/**
 * Generic signed URL refresh for any item with a single URL
 */
export async function refreshSignedUrl(
  supabase: SupabaseClient,
  bucket: BucketName,
  url: string,
  fallbackPath?: string
): Promise<string> {
  return refreshSingleUrl(supabase, bucket, url, fallbackPath)
}
