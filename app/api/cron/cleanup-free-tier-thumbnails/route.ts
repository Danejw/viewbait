/**
 * Cleanup Free Tier Thumbnails Cron Job
 * 
 * Automated daily job to delete free tier thumbnails older than 30 days.
 * This ensures compliance with the privacy policy (legal/privacy.md line 290).
 * 
 * Authentication: Requires x-cron-secret header matching CRON_SECRET env var
 * Schedule: Daily at 2 AM UTC (configured in vercel.json)
 */

import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { logInfo, logError, logWarn } from '@/lib/server/utils/logger'

/**
 * Extract storage path from image URL
 * Handles signed URLs and direct paths
 */
function extractStoragePath(imageUrl: string, userId: string, thumbnailId: string): string | null {
  // Try to extract from signed URL pattern: /storage/v1/object/sign/thumbnails/([^?]+)
  const signedUrlMatch = imageUrl.match(/\/storage\/v1\/object\/sign\/thumbnails\/([^?]+)/)
  if (signedUrlMatch) {
    return signedUrlMatch[1]
  }
  
  // Fallback: try to extract from any URL pattern containing the path
  const pathMatch = imageUrl.match(/thumbnails\/([^?]+)/)
  if (pathMatch) {
    return pathMatch[1]
  }
  
  // If we can't extract, return null (will try common extensions)
  return null
}

/**
 * Delete thumbnail from storage
 * Tries multiple extensions if path extraction fails
 */
async function deleteThumbnailFromStorage(
  supabase: ReturnType<typeof createServiceClient>,
  imageUrl: string,
  userId: string,
  thumbnailId: string
): Promise<boolean> {
  let storagePath = extractStoragePath(imageUrl, userId, thumbnailId)
  
  if (storagePath) {
    // Try to delete using extracted path
    const { error } = await supabase.storage
      .from('thumbnails')
      .remove([storagePath])
    
    if (!error) {
      return true
    }
  }
  
  // Fallback: try common extensions
  const extensions = ['png', 'jpg', 'jpeg']
  for (const ext of extensions) {
    const path = `${userId}/${thumbnailId}/thumbnail.${ext}`
    const { error } = await supabase.storage
      .from('thumbnails')
      .remove([path])
    
    if (!error) {
      return true
    }
  }
  
  return false
}

/**
 * Calculate age in days
 */
function getAgeInDays(createdAt: string): number {
  const created = new Date(createdAt)
  const now = new Date()
  const diffTime = now.getTime() - created.getTime()
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * POST /api/cron/cleanup-free-tier-thumbnails
 * 
 * Deletes free tier thumbnails older than 30 days.
 * Requires x-cron-secret header for authentication.
 */
export async function POST(request: Request) {
  try {
    // Authenticate using cron secret
    const cronSecret = request.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET
    
    if (!expectedSecret) {
      logError(new Error('CRON_SECRET environment variable not set'), {
        route: 'POST /api/cron/cleanup-free-tier-thumbnails',
        operation: 'cron-authentication',
      })
      return NextResponse.json(
        { error: 'Cron secret not configured' },
        { status: 500 }
      )
    }
    
    if (!cronSecret || cronSecret !== expectedSecret) {
      logError(new Error('Invalid cron secret'), {
        route: 'POST /api/cron/cleanup-free-tier-thumbnails',
        operation: 'cron-authentication',
      })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Create service client (bypasses RLS)
    const supabase = createServiceClient()
    
    // Step 1: Get all free tier user IDs (where product_id IS NULL)
    const { data: freeTierSubscriptions, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .select('user_id')
      .is('product_id', null) // Free tier
    
    if (subscriptionError) {
      logError(subscriptionError, {
        route: 'POST /api/cron/cleanup-free-tier-thumbnails',
        operation: 'query-free-tier-users',
      })
      return NextResponse.json(
        { error: 'Failed to query free tier users', details: subscriptionError.message },
        { status: 500 }
      )
    }
    
    if (!freeTierSubscriptions || freeTierSubscriptions.length === 0) {
      logInfo('No free tier users found', {
        route: 'POST /api/cron/cleanup-free-tier-thumbnails',
        operation: 'cleanup-complete',
        deleted: 0,
        errors: 0,
        totalProcessed: 0,
      })
      return NextResponse.json({
        deleted: 0,
        errors: 0,
        totalProcessed: 0,
        timestamp: new Date().toISOString(),
      })
    }
    
    const freeTierUserIds = freeTierSubscriptions.map(sub => sub.user_id)
    
    // Step 2: Query thumbnails for free tier users older than 30 days
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 30)
    
    const { data: thumbnails, error: queryError } = await supabase
      .from('thumbnails')
      .select('id, user_id, image_url, created_at')
      .in('user_id', freeTierUserIds)
      .lt('created_at', cutoffDate.toISOString())
    
    if (queryError) {
      logError(queryError, {
        route: 'POST /api/cron/cleanup-free-tier-thumbnails',
        operation: 'query-thumbnails',
      })
      return NextResponse.json(
        { error: 'Failed to query thumbnails', details: queryError.message },
        { status: 500 }
      )
    }
    
    if (!thumbnails || thumbnails.length === 0) {
      logInfo('No free tier thumbnails to delete', {
        route: 'POST /api/cron/cleanup-free-tier-thumbnails',
        operation: 'cleanup-complete',
        deleted: 0,
        errors: 0,
        totalProcessed: 0,
      })
      return NextResponse.json({
        deleted: 0,
        errors: 0,
        totalProcessed: 0,
        timestamp: new Date().toISOString(),
      })
    }
    
    // Process deletions
    let deletedCount = 0
    let errorCount = 0
    
    for (const thumbnail of thumbnails) {
      try {
        const thumbnailId = thumbnail.id
        const userId = thumbnail.user_id
        const imageUrl = thumbnail.image_url
        const createdAt = thumbnail.created_at
        const ageInDays = getAgeInDays(createdAt)
        
        // Delete from storage
        const storageDeleted = await deleteThumbnailFromStorage(
          supabase,
          imageUrl,
          userId,
          thumbnailId
        )
        
        if (!storageDeleted) {
          logWarn('Failed to delete thumbnail from storage', {
            route: 'POST /api/cron/cleanup-free-tier-thumbnails',
            operation: 'delete-storage',
            thumbnailId,
            userId,
            ageInDays,
          })
          // Continue anyway - try to delete from database
        }
        
        // Delete from database
        const { error: dbError } = await supabase
          .from('thumbnails')
          .delete()
          .eq('id', thumbnailId)
        
        if (dbError) {
          logError(dbError, {
            route: 'POST /api/cron/cleanup-free-tier-thumbnails',
            operation: 'delete-database',
            thumbnailId,
            userId,
            ageInDays,
          })
          errorCount++
        } else {
          deletedCount++
          logInfo('Deleted free tier thumbnail', {
            route: 'POST /api/cron/cleanup-free-tier-thumbnails',
            operation: 'delete-thumbnail',
            thumbnailId,
            userId,
            ageInDays,
          })
        }
      } catch (error) {
        errorCount++
        logError(error, {
          route: 'POST /api/cron/cleanup-free-tier-thumbnails',
          operation: 'delete-thumbnail',
          thumbnailId: thumbnail.id,
          userId: thumbnail.user_id,
        })
        // Continue processing other thumbnails
      }
    }
    
    logInfo('Cleanup job completed', {
      route: 'POST /api/cron/cleanup-free-tier-thumbnails',
      operation: 'cleanup-complete',
      deleted: deletedCount,
      errors: errorCount,
      totalProcessed: thumbnails.length,
    })
    
    return NextResponse.json({
      deleted: deletedCount,
      errors: errorCount,
      totalProcessed: thumbnails.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logError(error, {
      route: 'POST /api/cron/cleanup-free-tier-thumbnails',
      operation: 'cleanup-job',
    })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
