/**
 * Faces Service
 * 
 * Handles all face reference CRUD operations.
 * Includes integration with storage for face images.
 * All database operations go through API routes for security.
 */

import type { 
  DbFace, 
  FaceInsert, 
  FaceUpdate 
} from '@/lib/types/database'
import { 
  uploadFaceImage, 
  deleteFile, 
  deleteUserFolder,
  getSignedUrl 
} from './storage'
import { apiGet, apiPost, apiPatch, apiDelete } from './api-client'
import { logError } from '@/lib/server/utils/logger'

/**
 * Get all faces for a user
 */
export async function getFaces(userId: string): Promise<{
  faces: DbFace[]
  error: Error | null
}> {
  try {
    const response = await fetch('/api/faces')
    
    if (!response.ok) {
      const errorData = await response.json()
      return {
        faces: [],
        error: new Error(errorData.error || 'Failed to fetch faces'),
      }
    }

    const data = await response.json()
    return {
      faces: data.faces || [],
      error: null,
    }
  } catch (error) {
    return {
      faces: [],
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Get a single face by ID
 */
export async function getFace(id: string): Promise<{
  face: DbFace | null
  error: Error | null
}> {
  const { data, error } = await apiGet<DbFace>(`/api/faces/${id}`)
  
  if (error) {
    return {
      face: null,
      error: new Error(error.message),
    }
  }

  return {
    face: data || null,
    error: null,
  }
}

/**
 * Create a new face record
 */
export async function createFace(
  data: FaceInsert
): Promise<{
  face: DbFace | null
  error: Error | null
}> {
  try {
    const response = await fetch('/api/faces', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        face: null,
        error: new Error(errorData.error || 'Failed to create face'),
      }
    }

    const result = await response.json()
    return {
      face: result.face,
      error: null,
    }
  } catch (error) {
    return {
      face: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Create a face with initial images
 */
export async function createFaceWithImages(
  userId: string,
  name: string,
  images: File[]
): Promise<{
  face: DbFace | null
  error: Error | null
}> {
  // Create the face record first
  const { face, error: createError } = await createFace({
    user_id: userId,
    name,
    image_urls: [],
  })

  if (createError || !face) {
    return { face: null, error: createError }
  }

  // Upload images
  const imageUrls: string[] = []
  for (let i = 0; i < images.length; i++) {
    const { url, error: uploadError } = await uploadFaceImage(
      userId,
      face.id,
      images[i],
      i
    )

    if (uploadError) {
      logError(uploadError, {
        operation: 'upload-face-image',
        route: 'faces-service',
        faceId: face.id,
      })
      continue
    }

    if (url) {
      imageUrls.push(url)
    }
  }

  // Update face with image URLs
  if (imageUrls.length > 0) {
    const { face: updatedFace, error: updateError } = await updateFace(
      face.id,
      { image_urls: imageUrls }
    )

    if (updateError) {
      return { face, error: updateError }
    }

    return { face: updatedFace, error: null }
  }

  return { face, error: null }
}

/**
 * Update a face
 */
export async function updateFace(
  id: string,
  updates: FaceUpdate
): Promise<{
  face: DbFace | null
  error: Error | null
}> {
  const { data: result, error } = await apiPatch<{ face: DbFace }>(
    `/api/faces/${id}`,
    updates
  )
  
  if (error) {
    return {
      face: null,
      error: new Error(error.message),
    }
  }

  return {
    face: result?.face || null,
    error: null,
  }
}

/**
 * Delete a face and its associated storage files
 */
export async function deleteFace(
  id: string,
  userId: string
): Promise<{
  error: Error | null
}> {
  try {
    const response = await fetch(`/api/faces/${id}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        error: new Error(errorData.error || 'Failed to delete face'),
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
 * Add an image to a face
 */
export async function addFaceImage(
  faceId: string,
  userId: string,
  file: File
): Promise<{
  imageUrl: string | null
  error: Error | null
}> {
  // Get current face to determine next index
  const { face } = await getFace(faceId)
  if (!face) {
    return { imageUrl: null, error: new Error('Face not found') }
  }

  const nextIndex = face.image_urls.length

  // Upload image
  const { url, error: uploadError } = await uploadFaceImage(
    userId,
    faceId,
    file,
    nextIndex
  )

  if (uploadError || !url) {
    return { imageUrl: null, error: uploadError }
  }

  // Update face with new image URL
  const newImageUrls = [...face.image_urls, url]
  const { error: updateError } = await updateFace(faceId, {
    image_urls: newImageUrls,
  })

  if (updateError) {
    return { imageUrl: null, error: updateError }
  }

  return { imageUrl: url, error: null }
}

/**
 * Remove an image from a face
 */
export async function removeFaceImage(
  faceId: string,
  imageUrl: string
): Promise<{
  error: Error | null
}> {
  const { face } = await getFace(faceId)
  if (!face) {
    return { error: new Error('Face not found') }
  }

  // Remove URL from array
  const newImageUrls = face.image_urls.filter((url) => url !== imageUrl)

  // Update face
  const { error } = await updateFace(faceId, {
    image_urls: newImageUrls,
  })

  // Note: We don't delete from storage here as the URL might be a signed URL
  // and we'd need to extract the path. Storage cleanup can be done separately.

  return { error }
}

/**
 * Update face name
 */
export async function updateFaceName(
  id: string,
  name: string
): Promise<{
  face: DbFace | null
  error: Error | null
}> {
  return updateFace(id, { name })
}

