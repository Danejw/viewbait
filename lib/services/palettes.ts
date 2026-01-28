/**
 * Palettes Service
 * 
 * Handles all color palette CRUD operations via secure API routes.
 * Supports default palettes, public palettes, and user-created palettes.
 */

import type { 
  DbPalette, 
  PaletteInsert, 
  PaletteUpdate,
  PublicPalette 
} from '@/lib/types/database'

/**
 * Get all palettes accessible to a user (own + defaults + public)
 */
export async function getPalettes(userId: string): Promise<{
  palettes: DbPalette[]
  error: Error | null
}> {
  try {
    const response = await fetch('/api/palettes')
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        palettes: [],
        error: new Error(errorData.error || 'Failed to fetch palettes'),
      }
    }

    const data = await response.json()
    return {
      palettes: data.palettes || [],
      error: null,
    }
  } catch (error) {
    return {
      palettes: [],
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Get only the user's own palettes
 */
export async function getUserPalettes(userId: string): Promise<{
  palettes: DbPalette[]
  error: Error | null
}> {
  try {
    const response = await fetch('/api/palettes?userOnly=true')
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        palettes: [],
        error: new Error(errorData.error || 'Failed to fetch palettes'),
      }
    }

    const data = await response.json()
    return {
      palettes: data.palettes || [],
      error: null,
    }
  } catch (error) {
    return {
      palettes: [],
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Get public palettes from the view
 */
export async function getPublicPalettes(): Promise<{
  palettes: PublicPalette[]
  error: Error | null
}> {
  try {
    const response = await fetch('/api/palettes?publicOnly=true')
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        palettes: [],
        error: new Error(errorData.error || 'Failed to fetch palettes'),
      }
    }

    const data = await response.json()
    return {
      palettes: data.palettes || [],
      error: null,
    }
  } catch (error) {
    return {
      palettes: [],
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Get default system palettes
 */
export async function getDefaultPalettes(): Promise<{
  palettes: DbPalette[]
  error: Error | null
}> {
  try {
    const response = await fetch('/api/palettes?defaultsOnly=true')
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        palettes: [],
        error: new Error(errorData.error || 'Failed to fetch palettes'),
      }
    }

    const data = await response.json()
    return {
      palettes: data.palettes || [],
      error: null,
    }
  } catch (error) {
    return {
      palettes: [],
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Get a single palette by ID
 */
export async function getPalette(id: string): Promise<{
  palette: DbPalette | null
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/palettes/${id}`)
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        palette: null,
        error: new Error(errorData.error || 'Failed to fetch palette'),
      }
    }

    const data = await response.json()
    return {
      palette: data.palette,
      error: null,
    }
  } catch (error) {
    return {
      palette: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Create a new palette
 */
export async function createPalette(
  data: PaletteInsert
): Promise<{
  palette: DbPalette | null
  error: Error | null
}> {
  try {
    const response = await fetch('/api/palettes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        palette: null,
        error: new Error(errorData.error || 'Failed to create palette'),
      }
    }

    const result = await response.json()
    return {
      palette: result.palette,
      error: null,
    }
  } catch (error) {
    return {
      palette: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Update a palette
 */
export async function updatePalette(
  id: string,
  updates: PaletteUpdate
): Promise<{
  palette: DbPalette | null
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/palettes/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        palette: null,
        error: new Error(errorData.error || 'Failed to update palette'),
      }
    }

    const result = await response.json()
    return {
      palette: result.palette,
      error: null,
    }
  } catch (error) {
    return {
      palette: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Delete a palette
 */
export async function deletePalette(
  id: string,
  userId: string
): Promise<{
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/palettes/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        error: new Error(errorData.error || 'Failed to delete palette'),
      }
    }

    return { error: null }
  } catch (error) {
    return {
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Toggle public status for a palette
 */
export async function togglePalettePublic(id: string): Promise<{
  isPublic: boolean
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/palettes/${id}/public`, {
      method: 'POST',
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        isPublic: false,
        error: new Error(errorData.error || 'Failed to toggle public status'),
      }
    }

    const data = await response.json()
    return {
      isPublic: data.isPublic,
      error: null,
    }
  } catch (error) {
    return {
      isPublic: false,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Update palette colors
 */
export async function updatePaletteColors(
  id: string,
  colors: string[]
): Promise<{
  palette: DbPalette | null
  error: Error | null
}> {
  return updatePalette(id, { colors })
}

/**
 * Update palette name
 */
export async function updatePaletteName(
  id: string,
  name: string
): Promise<{
  palette: DbPalette | null
  error: Error | null
}> {
  return updatePalette(id, { name })
}

/**
 * Analyze an image to extract color palette
 */
export interface AnalyzePaletteResult {
  colors: string[]
  name?: string
  description?: string
}

export async function analyzePalette(
  imageFile: File
): Promise<{
  result: AnalyzePaletteResult | null
  error: Error | null
}> {
  try {
    const formData = new FormData()
    formData.append('image', imageFile)

    const response = await fetch('/api/analyze-palette', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        result: null,
        error: new Error(errorData.error || 'Failed to analyze palette'),
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

