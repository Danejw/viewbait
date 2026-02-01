/**
 * Styles Service
 * 
 * Handles all style preset CRUD operations.
 * Supports default styles, public styles, and user-created styles.
 * All database operations go through API routes for security.
 */

import type { 
  DbStyle, 
  StyleInsert, 
  StyleUpdate,
  PublicStyle 
} from '@/lib/types/database'
import { apiGet, apiPost, apiPatch, apiDelete } from './api-client'

/**
 * Get all styles accessible to a user (own + defaults + public)
 */
export async function getStyles(userId: string): Promise<{
  styles: DbStyle[]
  error: Error | null
}> {
  const { data, error } = await apiGet<{ styles: DbStyle[] }>('/api/styles')
  
  if (error) {
    return {
      styles: [],
      error: new Error(error.message),
    }
  }

  return {
    styles: data?.styles || [],
    error: null,
  }
}

/**
 * Get only the user's own styles
 */
export async function getUserStyles(userId: string): Promise<{
  styles: DbStyle[]
  error: Error | null
}> {
  const { data, error } = await apiGet<{ styles: DbStyle[] }>('/api/styles?userOnly=true')
  
  if (error) {
    return {
      styles: [],
      error: new Error(error.message),
    }
  }

  return {
    styles: data?.styles || [],
    error: null,
  }
}

/**
 * Get public styles from the view
 */
export async function getPublicStyles(): Promise<{
  styles: PublicStyle[]
  error: Error | null
}> {
  try {
    const response = await fetch('/api/styles?publicOnly=true')
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        styles: [],
        error: new Error(errorData.error || 'Failed to fetch styles'),
      }
    }

    const data = await response.json()
    return {
      styles: data.styles || [],
      error: null,
    }
  } catch (error) {
    return {
      styles: [],
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Get default system styles
 */
export async function getDefaultStyles(): Promise<{
  styles: DbStyle[]
  error: Error | null
}> {
  const { data, error } = await apiGet<{ styles: DbStyle[] }>('/api/styles?defaultsOnly=true')
  
  if (error) {
    return {
      styles: [],
      error: new Error(error.message),
    }
  }

  return {
    styles: data?.styles || [],
    error: null,
  }
}

/**
 * Get a single style by ID
 */
export async function getStyle(id: string): Promise<{
  style: DbStyle | null
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/styles/${id}`)
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        style: null,
        error: new Error(errorData.error || 'Failed to fetch style'),
      }
    }

    const data = await response.json()
    return {
      style: data,
      error: null,
    }
  } catch (error) {
    return {
      style: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Create a new style
 */
export async function createStyle(
  data: StyleInsert
): Promise<{
  style: DbStyle | null
  error: Error | null
}> {
  const { data: result, error } = await apiPost<{ style: DbStyle }>('/api/styles', data)
  
  if (error) {
    return {
      style: null,
      error: new Error(error.message),
    }
  }

  return {
    style: result?.style || null,
    error: null,
  }
}

/**
 * Update a style
 */
export async function updateStyle(
  id: string,
  updates: StyleUpdate
): Promise<{
  style: DbStyle | null
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/styles/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        style: null,
        error: new Error(errorData.error || 'Failed to update style'),
      }
    }

    const result = await response.json()
    return {
      style: result.style,
      error: null,
    }
  } catch (error) {
    return {
      style: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Delete a style and its associated storage files
 */
export async function deleteStyle(
  id: string,
  userId: string
): Promise<{
  error: Error | null
}> {
  const { error } = await apiDelete(`/api/styles/${id}`)
  
  if (error) {
    return {
      error: new Error(error.message),
    }
  }

  return { error: null }
}

/**
 * Toggle public status for a style
 */
export async function toggleStylePublic(id: string): Promise<{
  isPublic: boolean
  error: Error | null
}> {
  const { data, error } = await apiPost<{ isPublic: boolean }>(`/api/styles/${id}/public`)
  
  if (error) {
    return {
      isPublic: false,
      error: new Error(error.message),
    }
  }

  return {
    isPublic: data?.isPublic || false,
    error: null,
  }
}

/**
 * Add reference images to a style
 */
export async function addStyleReferenceImages(
  id: string,
  imageUrls: string[]
): Promise<{
  style: DbStyle | null
  error: Error | null
}> {
  const { data, error } = await apiPost<{ style: DbStyle }>(
    `/api/styles/${id}/reference-images`,
    { imageUrls }
  )

  if (error) {
    return {
      style: null,
      error: new Error(error.message),
    }
  }

  return {
    style: data?.style || null,
    error: null,
  }
}

/**
 * Remove a reference image from a style
 */
export async function removeStyleReferenceImage(
  id: string,
  imageUrl: string
): Promise<{
  style: DbStyle | null
  error: Error | null
}> {
  const { data, error } = await apiDelete<{ style: DbStyle }>(
    `/api/styles/${id}/reference-images?url=${encodeURIComponent(imageUrl)}`
  )

  if (error) {
    return {
      style: null,
      error: new Error(error.message),
    }
  }

  return {
    style: data?.style || null,
    error: null,
  }
}

/**
 * Update style preview image URL
 */
export async function updateStylePreview(
  id: string,
  previewUrl: string
): Promise<{
  style: DbStyle | null
  error: Error | null
}> {
  return updateStyle(id, { preview_thumbnail_url: previewUrl })
}

/**
 * Analyze an image to extract style characteristics
 */
export interface AnalyzeStyleResult {
  prompt: string
  description: string
  name?: string
}

export async function analyzeStyle(
  imageFiles: File[]
): Promise<{
  result: AnalyzeStyleResult | null
  error: Error | null
}> {
  try {
    const formData = new FormData()
    imageFiles.forEach((file) => {
      formData.append('images', file)
    })

    const response = await fetch('/api/analyze-style', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        result: null,
        error: new Error(errorData.error || 'Failed to analyze style'),
      }
    }

    const data = await response.json()
    return {
      result: data,
      error: null,
    }
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}


/**
 * Extract a common style from multiple YouTube thumbnail URLs
 */
export interface ExtractStyleFromYouTubeResult {
  name: string
  description: string
  prompt: string
  reference_images: string[]
}

export async function extractStyleFromYouTube(
  imageUrls: string[]
): Promise<{
  result: ExtractStyleFromYouTubeResult | null
  error: Error | null
}> {
  try {
    const response = await fetch('/api/styles/extract-from-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrls }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        result: null,
        error: new Error(errorData.error || 'Failed to extract style'),
      }
    }

    const data = await response.json()
    return {
      result: {
        name: data.name ?? '',
        description: data.description ?? '',
        prompt: data.prompt ?? '',
        reference_images: Array.isArray(data.reference_images) ? data.reference_images : [],
      },
      error: null,
    }
  } catch (error) {
    return {
      result: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Generate a style preview image
 */
export interface GenerateStylePreviewOptions {
  prompt: string
  referenceImageUrl?: string
}

export async function generateStylePreview(
  options: GenerateStylePreviewOptions
): Promise<{
  imageUrl: string | null
  error: Error | null
}> {
  const { data, error } = await apiPost<{ imageUrl: string }>(
    '/api/generate-style-preview',
    options
  )
  
  if (error) {
    return {
      imageUrl: null,
      error: new Error(error.message),
    }
  }

  return {
    imageUrl: data?.imageUrl || null,
    error: null,
  }
}
