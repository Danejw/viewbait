/**
 * Storage Service
 * 
 * Handles all file upload/download operations with Supabase Storage.
 * Supports thumbnails, faces, style previews, and style references.
 * Private bucket operations go through API routes for server-side validation.
 */

import { createClient } from '@/lib/supabase/client'
import { apiGet, apiPostFormData, apiDelete } from './api-client'

export type BucketName = 'thumbnails' | 'faces' | 'style-previews' | 'style-references'

const PRIVATE_BUCKETS: BucketName[] = ['thumbnails', 'faces', 'style-references']
const PUBLIC_BUCKETS: BucketName[] = ['style-previews']

export interface UploadResult {
  path: string | null
  url: string | null
  error: Error | null
}

/**
 * Upload a file to a storage bucket
 * Path format: {userId}/{...rest}
 * Private buckets use API route, public buckets use client-side upload
 */
export async function uploadFile(
  bucket: BucketName,
  path: string,
  file: File | Blob
): Promise<UploadResult> {
  // Private buckets go through API route
  if (PRIVATE_BUCKETS.includes(bucket)) {
    try {
      // Convert Blob to File if needed
      const fileToUpload = file instanceof File 
        ? file 
        : new File([file], path.split('/').pop() || 'file', { type: 'image/png' })

      const formData = new FormData()
      formData.append('file', fileToUpload)
      formData.append('bucket', bucket)
      formData.append('path', path)

      const { data, error } = await apiPostFormData<{ path: string; url: string | null }>(
        '/api/storage/upload',
        formData
      )

      if (error || !data) {
        return {
          path: null,
          url: null,
          error: error ? new Error(error.message) : new Error('Upload failed'),
        }
      }

      return {
        path: data.path,
        url: data.url,
        error: null,
      }
    } catch (error) {
      return {
        path: null,
        url: null,
        error: error instanceof Error ? error : new Error('Network error'),
      }
    }
  }

  // Public buckets use client-side upload
  const supabase = createClient()

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    return { path: null, url: null, error }
  }

  // Get public URL for public buckets
  const url = getPublicUrl(bucket, data.path)

  return { path: data.path, url, error: null }
}

/**
 * Upload a thumbnail image
 * Path: {userId}/{thumbnailId}.png
 */
export async function uploadThumbnail(
  userId: string,
  thumbnailId: string,
  file: File | Blob
): Promise<UploadResult> {
  const path = `${userId}/${thumbnailId}.png`
  return uploadFile('thumbnails', path, file)
}

/**
 * Upload a face image
 * Path: {userId}/{faceId}/{index}.png
 * Uses server-side API route for proper authentication
 */
export async function uploadFaceImage(
  userId: string,
  faceId: string,
  file: File | Blob,
  index: number = 0
): Promise<UploadResult> {
  try {
    // Convert Blob to File if needed
    const fileToUpload = file instanceof File 
      ? file 
      : new File([file], `face-${faceId}-${index}.png`, { type: 'image/png' })

    // Upload via server-side API route
    const formData = new FormData()
    formData.append('file', fileToUpload)
    formData.append('userId', userId)
    formData.append('faceId', faceId)
    formData.append('index', index.toString())

    const response = await fetch('/api/faces/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        path: null,
        url: null,
        error: new Error(errorData.error || 'Failed to upload face image'),
      }
    }

    const data = await response.json()

    return {
      path: data.path,
      url: data.url || null,
      error: null,
    }
  } catch (error) {
    return {
      path: null,
      url: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Upload a style reference image
 * Path: {userId}/{styleId}/{uuid}.{ext}
 */
export async function uploadStyleReference(
  userId: string,
  styleId: string,
  file: File | Blob
): Promise<UploadResult> {
  const uuid = crypto.randomUUID()
  const ext = file instanceof File ? file.name.split('.').pop() || 'png' : 'png'
  const path = `${userId}/${styleId}/${uuid}.${ext}`
  return uploadFile('style-references', path, file)
}

/**
 * Upload a style preview image (public bucket)
 * Path: {userId}/{styleId}/preview.png
 */
export async function uploadStylePreview(
  userId: string,
  styleId: string,
  file: File | Blob
): Promise<UploadResult> {
  const path = `${userId}/${styleId}/preview.png`
  return uploadFile('style-previews', path, file)
}

/**
 * Get a signed URL for a private file (1 year expiry)
 * Uses API route for private buckets
 */
export async function getSignedUrl(
  bucket: BucketName,
  path: string,
  expiresIn: number = 31536000 // 1 year in seconds
): Promise<string | null> {
  // Only private buckets need signed URLs
  if (!PRIVATE_BUCKETS.includes(bucket)) {
    // For public buckets, return public URL instead
    return getPublicUrl(bucket, path)
  }

  try {
    const params = new URLSearchParams({
      bucket,
      path,
      expiresIn: expiresIn.toString(),
    })

    const { data, error } = await apiGet<{ url: string }>(
      `/api/storage/signed-url?${params.toString()}`
    )

    if (error || !data) {
      return null
    }

    return data.url
  } catch (error) {
    return null
  }
}

/**
 * Get a public URL (for style-previews bucket)
 */
export function getPublicUrl(bucket: BucketName, path: string): string {
  const supabase = createClient()
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/**
 * Delete a file from storage
 * Uses API route for private buckets
 */
export async function deleteFile(
  bucket: BucketName,
  path: string
): Promise<{ error: Error | null }> {
  // Private buckets go through API route
  if (PRIVATE_BUCKETS.includes(bucket)) {
    try {
      const { error } = await apiDelete<{ success: boolean }>(
        '/api/storage',
        { bucket, path }
      )

      if (error) {
        return { error: new Error(error.message) }
      }

      return { error: null }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Network error'),
      }
    }
  }

  // Public buckets use client-side deletion
  const supabase = createClient()

  const { error } = await supabase.storage.from(bucket).remove([path])

  return { error }
}

/**
 * Delete multiple files from storage
 * Uses API route for private buckets
 */
export async function deleteFiles(
  bucket: BucketName,
  paths: string[]
): Promise<{ error: Error | null }> {
  // Private buckets go through API route
  if (PRIVATE_BUCKETS.includes(bucket)) {
    try {
      const { error } = await apiDelete<{ success: boolean }>(
        '/api/storage',
        { bucket, paths: paths.join(',') }
      )

      if (error) {
        return { error: new Error(error.message) }
      }

      return { error: null }
    } catch (error) {
      return {
        error: error instanceof Error ? error : new Error('Network error'),
      }
    }
  }

  // Public buckets use client-side deletion
  const supabase = createClient()

  const { error } = await supabase.storage.from(bucket).remove(paths)

  return { error }
}

/**
 * List files in a folder
 * Uses API route for private buckets
 */
export async function listFiles(
  bucket: BucketName,
  folderPath: string
): Promise<{ files: string[]; error: Error | null }> {
  // Private buckets go through API route
  if (PRIVATE_BUCKETS.includes(bucket)) {
    try {
      const params = new URLSearchParams({
        bucket,
        folderPath,
      })

      const { data, error } = await apiGet<{ files: string[] }>(
        `/api/storage/list?${params.toString()}`
      )

      if (error || !data) {
        return {
          files: [],
          error: error ? new Error(error.message) : new Error('Failed to list files'),
        }
      }

      return { files: data.files, error: null }
    } catch (error) {
      return {
        files: [],
        error: error instanceof Error ? error : new Error('Network error'),
      }
    }
  }

  // Public buckets use client-side listing
  const supabase = createClient()

  const { data, error } = await supabase.storage.from(bucket).list(folderPath)

  if (error) {
    return { files: [], error }
  }

  const files = (data || [])
    .filter((item: { name: string }) => item.name !== '.emptyFolderPlaceholder')
    .map((item: { name: string }) => `${folderPath}/${item.name}`)

  return { files, error: null }
}

/**
 * Delete all files in a user's folder for a specific bucket
 */
export async function deleteUserFolder(
  bucket: BucketName,
  userId: string,
  subfolder?: string
): Promise<{ error: Error | null }> {
  const folderPath = subfolder ? `${userId}/${subfolder}` : userId
  const { files, error: listError } = await listFiles(bucket, folderPath)

  if (listError) {
    return { error: listError }
  }

  if (files.length === 0) {
    return { error: null }
  }

  return deleteFiles(bucket, files)
}

/**
 * Delete all user storage files from all buckets using service role client
 * This function is intended for server-side use during account deletion.
 * It bypasses RLS and deletes files from all buckets: thumbnails, faces, style-references, style-previews
 * 
 * @param userId - The user ID whose storage files should be deleted
 * @returns Summary of deletion operation with count of deleted files and any errors
 */
export async function deleteAllUserStorage(
  userId: string
): Promise<{ deleted: number; errors: Array<{ bucket: string; error: Error }> }> {
  // Import service client dynamically to avoid circular dependencies
  const { createServiceClient } = await import('@/lib/supabase/service')
  const supabaseService = createServiceClient()
  
  const buckets: BucketName[] = ['thumbnails', 'faces', 'style-references', 'style-previews']
  let totalDeleted = 0
  const errors: Array<{ bucket: string; error: Error }> = []

  /**
   * Recursively list all files in a folder
   */
  async function listAllFilesRecursive(
    bucket: BucketName,
    folderPath: string
  ): Promise<string[]> {
    const allPaths: string[] = []
    
    async function listFolder(path: string): Promise<void> {
      const { data: files, error } = await supabaseService.storage
        .from(bucket)
        .list(path, {
          limit: 1000,
          offset: 0,
        })

      if (error || !files) {
        return
      }

      for (const file of files) {
        if (file.name === '.emptyFolderPlaceholder') {
          continue
        }

        const filePath = path ? `${path}/${file.name}` : file.name
        
        // If file.id is null, it's a folder - recurse into it
        if (file.id === null) {
          await listFolder(filePath)
        } else {
          // It's a file, add to paths
          allPaths.push(filePath)
        }
      }
    }

    await listFolder(folderPath)
    return allPaths
  }

  for (const bucket of buckets) {
    try {
      // Recursively list all files under userId folder
      const allPaths = await listAllFilesRecursive(bucket, userId)

      if (allPaths.length === 0) {
        // No files to delete, continue to next bucket
        continue
      }

      // Delete all files in batches (Supabase has limits on batch size)
      const batchSize = 100
      for (let i = 0; i < allPaths.length; i += batchSize) {
        const batch = allPaths.slice(i, i + batchSize)
        const { error: deleteError } = await supabaseService.storage
          .from(bucket)
          .remove(batch)

        if (deleteError) {
          errors.push({
            bucket,
            error: new Error(`Failed to delete files in ${bucket}: ${deleteError.message}`),
          })
          break // Stop trying to delete more batches for this bucket
        }

        totalDeleted += batch.length
      }
    } catch (error) {
      errors.push({
        bucket,
        error: error instanceof Error ? error : new Error(`Unexpected error deleting from ${bucket}`),
      })
    }
  }

  return { deleted: totalDeleted, errors }
}

/**
 * Convert a File to base64 string
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = (error) => reject(error)
  })
}

/**
 * Convert a base64 string to Blob
 */
export function base64ToBlob(base64: string, mimeType: string = 'image/png'): Blob {
  const byteCharacters = atob(base64.split(',')[1] || base64)
  const byteNumbers = new Array(byteCharacters.length)
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}
