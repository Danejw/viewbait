/**
 * Account Export API Route
 * 
 * Handles POST /api/account/export - exports all user data in JSON format.
 * Includes signed URLs for storage files (thumbnails, faces, style-references).
 * Complies with GDPR data portability requirements.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import { enforceRateLimit } from '@/lib/server/utils/rate-limit'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/server/utils/logger'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS } from '@/lib/server/utils/url-refresh'

type BucketName = 'thumbnails' | 'faces' | 'style-references'

/**
 * Extract storage path from signed URL or image URL
 */
function extractStoragePath(url: string, bucket: BucketName): string | null {
  // Try signed URL pattern: /storage/v1/object/sign/{bucket}/([^?]+)
  const signedUrlMatch = url.match(new RegExp(`/storage/v1/object/sign/${bucket}/([^?]+)`))
  if (signedUrlMatch) {
    return signedUrlMatch[1]
  }
  
  // Try direct path pattern: {bucket}/([^?]+)
  const pathMatch = url.match(new RegExp(`${bucket}/([^?]+)`))
  if (pathMatch) {
    return pathMatch[1]
  }
  
  return null
}

/**
 * Generate signed URL for a storage path
 */
async function generateSignedUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bucket: BucketName,
  path: string,
  userId: string
): Promise<string | null> {
  // Validate path belongs to user
  const pathSegments = path.split('/')
  if (pathSegments[0] !== userId) {
    return null
  }

  try {
    const { data: urlData, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS)

    if (error || !urlData?.signedUrl) {
      logError(error || new Error('No signed URL data'), {
        route: 'POST /api/account/export',
        userId,
        operation: 'generate-signed-url',
        bucket,
        path,
      })
      return null
    }

    return urlData.signedUrl
  } catch (error) {
    logError(error, {
      route: 'POST /api/account/export',
      userId,
      operation: 'generate-signed-url',
      bucket,
      path,
    })
    return null
  }
}

/**
 * Generate signed URLs for thumbnail storage files
 */
async function generateThumbnailUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  thumbnails: Array<{ id: string; image_url: string }>,
  userId: string
): Promise<Array<{ id: string; download_url: string | null }>> {
  const results = await Promise.all(
    thumbnails.map(async (thumbnail) => {
      const path = extractStoragePath(thumbnail.image_url, 'thumbnails')
      if (!path) {
        return { id: thumbnail.id, download_url: null }
      }

      const signedUrl = await generateSignedUrl(supabase, 'thumbnails', path, userId)
      return { id: thumbnail.id, download_url: signedUrl }
    })
  )

  return results
}

/**
 * Generate signed URLs for face storage files
 */
async function generateFaceUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  faces: Array<{ id: string; image_urls: string[] }>,
  userId: string
): Promise<Array<{ id: string; download_url: string | null }>> {
  const results: Array<{ id: string; download_url: string | null }> = []

  for (const face of faces) {
    // For faces, we'll include the first image URL (or could include all)
    if (face.image_urls && face.image_urls.length > 0) {
      const path = extractStoragePath(face.image_urls[0], 'faces')
      if (path) {
        const signedUrl = await generateSignedUrl(supabase, 'faces', path, userId)
        results.push({ id: face.id, download_url: signedUrl })
      } else {
        results.push({ id: face.id, download_url: null })
      }
    } else {
      results.push({ id: face.id, download_url: null })
    }
  }

  return results
}

/**
 * Generate signed URLs for style reference images
 */
async function generateStyleReferenceUrls(
  supabase: Awaited<ReturnType<typeof createClient>>,
  styles: Array<{ id: string; reference_images: string[] }>,
  userId: string
): Promise<Array<{ id: string; download_url: string | null }>> {
  const results: Array<{ id: string; download_url: string | null }> = []

  for (const style of styles) {
    // For style references, we'll include the first reference image URL
    if (style.reference_images && style.reference_images.length > 0) {
      const path = extractStoragePath(style.reference_images[0], 'style-references')
      if (path) {
        const signedUrl = await generateSignedUrl(supabase, 'style-references', path, userId)
        results.push({ id: style.id, download_url: signedUrl })
      } else {
        results.push({ id: style.id, download_url: null })
      }
    } else {
      results.push({ id: style.id, download_url: null })
    }
  }

  return results
}

/**
 * POST /api/account/export
 * Export all user data in JSON format
 */
export async function POST(request: Request) {
  let userId: string | undefined

  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    userId = user.id

    const rateLimitRes = enforceRateLimit('account-export', request, user.id)
    if (rateLimitRes) return rateLimitRes

    const errors: Array<{ table: string; error: string }> = []

    // Query all user tables in parallel
    const [
      profileResult,
      thumbnailsResult,
      stylesResult,
      palettesResult,
      facesResult,
      favoritesResult,
      subscriptionResult,
      creditTransactionsResult,
      notificationPreferencesResult,
    ] = await Promise.allSettled([
      // Profile
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single(),
      
      // Thumbnails
      supabase
        .from('thumbnails')
        .select('*')
        .eq('user_id', user.id),
      
      // Styles (user's custom styles only)
      supabase
        .from('styles')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', false),
      
      // Palettes (user's custom palettes only)
      supabase
        .from('palettes')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', false),
      
      // Faces
      supabase
        .from('faces')
        .select('*')
        .eq('user_id', user.id),
      
      // Favorites
      supabase
        .from('favorites')
        .select('*')
        .eq('user_id', user.id),
      
      // Subscription
      supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
      
      // Credit transactions
      supabase
        .from('credit_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      
      // Notification preferences
      supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    // Process results and collect errors
    let profile: unknown = null
    if (profileResult.status === 'fulfilled') {
      if (profileResult.value.error) {
        errors.push({ table: 'profiles', error: profileResult.value.error.message })
      } else {
        profile = profileResult.value.data
      }
    } else {
      errors.push({ table: 'profiles', error: profileResult.reason?.message || 'Unknown error' })
    }

    let thumbnails: unknown[] = []
    if (thumbnailsResult.status === 'fulfilled') {
      if (thumbnailsResult.value.error) {
        errors.push({ table: 'thumbnails', error: thumbnailsResult.value.error.message })
      } else {
        thumbnails = thumbnailsResult.value.data || []
      }
    } else {
      errors.push({ table: 'thumbnails', error: thumbnailsResult.reason?.message || 'Unknown error' })
    }

    let styles: unknown[] = []
    if (stylesResult.status === 'fulfilled') {
      if (stylesResult.value.error) {
        errors.push({ table: 'styles', error: stylesResult.value.error.message })
      } else {
        styles = stylesResult.value.data || []
      }
    } else {
      errors.push({ table: 'styles', error: stylesResult.reason?.message || 'Unknown error' })
    }

    let palettes: unknown[] = []
    if (palettesResult.status === 'fulfilled') {
      if (palettesResult.value.error) {
        errors.push({ table: 'palettes', error: palettesResult.value.error.message })
      } else {
        palettes = palettesResult.value.data || []
      }
    } else {
      errors.push({ table: 'palettes', error: palettesResult.reason?.message || 'Unknown error' })
    }

    let faces: unknown[] = []
    if (facesResult.status === 'fulfilled') {
      if (facesResult.value.error) {
        errors.push({ table: 'faces', error: facesResult.value.error.message })
      } else {
        faces = facesResult.value.data || []
      }
    } else {
      errors.push({ table: 'faces', error: facesResult.reason?.message || 'Unknown error' })
    }

    let favorites: unknown[] = []
    if (favoritesResult.status === 'fulfilled') {
      if (favoritesResult.value.error) {
        errors.push({ table: 'favorites', error: favoritesResult.value.error.message })
      } else {
        favorites = favoritesResult.value.data || []
      }
    } else {
      errors.push({ table: 'favorites', error: favoritesResult.reason?.message || 'Unknown error' })
    }

    let subscription: unknown = null
    if (subscriptionResult.status === 'fulfilled') {
      if (subscriptionResult.value.error) {
        errors.push({ table: 'user_subscriptions', error: subscriptionResult.value.error.message })
      } else {
        subscription = subscriptionResult.value.data
      }
    } else {
      errors.push({ table: 'user_subscriptions', error: subscriptionResult.reason?.message || 'Unknown error' })
    }

    let creditTransactions: unknown[] = []
    if (creditTransactionsResult.status === 'fulfilled') {
      if (creditTransactionsResult.value.error) {
        errors.push({ table: 'credit_transactions', error: creditTransactionsResult.value.error.message })
      } else {
        creditTransactions = creditTransactionsResult.value.data || []
      }
    } else {
      errors.push({ table: 'credit_transactions', error: creditTransactionsResult.reason?.message || 'Unknown error' })
    }

    let notificationPreferences: unknown = null
    if (notificationPreferencesResult.status === 'fulfilled') {
      if (notificationPreferencesResult.value.error) {
        errors.push({ table: 'notification_preferences', error: notificationPreferencesResult.value.error.message })
      } else {
        notificationPreferences = notificationPreferencesResult.value.data
      }
    } else {
      errors.push({ table: 'notification_preferences', error: notificationPreferencesResult.reason?.message || 'Unknown error' })
    }

    // Generate signed URLs for storage files
    const thumbnailUrls = await generateThumbnailUrls(
      supabase,
      thumbnails as Array<{ id: string; image_url: string }>,
      user.id
    )

    const faceUrls = await generateFaceUrls(
      supabase,
      faces as Array<{ id: string; image_urls: string[] }>,
      user.id
    )

    const styleReferenceUrls = await generateStyleReferenceUrls(
      supabase,
      styles as Array<{ id: string; reference_images: string[] }>,
      user.id
    )

    // Build export data
    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: user.id,
      profile,
      thumbnails,
      styles,
      palettes,
      faces,
      favorites,
      subscription,
      credit_transactions: creditTransactions,
      notification_preferences: notificationPreferences,
      analytics_events: analyticsEvents,
      storage_files: {
        thumbnails: thumbnailUrls,
        faces: faceUrls,
        style_references: styleReferenceUrls,
      },
      ...(errors.length > 0 && { errors }),
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const filename = `viewbait-export-${timestamp}.json`

    // Return JSON with download headers
    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/account/export', 'export-user-data', undefined, 'Failed to export user data')
  }
}
