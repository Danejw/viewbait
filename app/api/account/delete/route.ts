/**
 * Account Deletion API Route
 * 
 * Handles user-initiated account deletion with complete storage cleanup.
 * Requires password confirmation for security.
 * Deletes all storage files from all buckets before deleting the user account.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { logInfo, logError } from '@/lib/server/utils/logger'
import {
  validationErrorResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/server/utils/error-handler'
import { deleteAllUserStorage } from '@/lib/services/storage'

/**
 * POST /api/account/delete
 * Delete user account and all associated data
 * 
 * Request body:
 * {
 *   password: string  // Required for confirmation
 * }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse request body
    let body: { password?: string }
    try {
      body = await request.json()
    } catch (error) {
      return validationErrorResponse('Invalid request body')
    }

    // Validate password is provided
    if (!body.password || typeof body.password !== 'string' || body.password.trim().length === 0) {
      return validationErrorResponse('Password is required for account deletion')
    }

    // Verify password by attempting sign-in
    // We need the user's email for password verification
    if (!user.email) {
      logError(new Error('User email not available for password verification'), {
        route: 'POST /api/account/delete',
        userId: user.id,
        operation: 'password-verification',
      })
      return serverErrorResponse(
        new Error('Unable to verify password: email not available'),
        'Account deletion failed',
        { route: 'POST /api/account/delete' }
      )
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: body.password,
    })

    if (signInError) {
      logError(signInError, {
        route: 'POST /api/account/delete',
        userId: user.id,
        operation: 'password-verification-failed',
      })
      return forbiddenResponse('Invalid password. Account deletion requires password confirmation.')
    }

    // Password verified, proceed with account deletion
    logInfo('Starting account deletion', {
      route: 'POST /api/account/delete',
      userId: user.id,
      operation: 'account-deletion-start',
    })

    // Step 1: Delete all storage files from all buckets
    logInfo('Starting storage cleanup', {
      route: 'POST /api/account/delete',
      userId: user.id,
      operation: 'storage-cleanup-start',
    })

    let storageResult = { deleted: 0, errors: [] }
    try {
      storageResult = await deleteAllUserStorage(user.id)

      // Log storage cleanup results
      if (storageResult.errors.length > 0) {
        logError(new Error(`Storage cleanup completed with errors: ${storageResult.errors.length} bucket(s) failed`), {
          route: 'POST /api/account/delete',
          userId: user.id,
          operation: 'storage-cleanup-partial-failure',
          deletedFiles: storageResult.deleted,
          errors: storageResult.errors.map((e) => ({ bucket: e.bucket, message: e.error.message })),
        })
      } else {
        logInfo('Storage cleanup completed successfully', {
          route: 'POST /api/account/delete',
          userId: user.id,
          operation: 'storage-cleanup-success',
          deletedFiles: storageResult.deleted,
        })
      }
    } catch (storageError) {
      // Log storage cleanup failure but continue with account deletion
      logError(storageError instanceof Error ? storageError : new Error('Storage cleanup failed'), {
        route: 'POST /api/account/delete',
        userId: user.id,
        operation: 'storage-cleanup-failure',
      })
      // Continue with account deletion even if storage cleanup fails
    }

    // Step 2: Delete user from auth.users (triggers cascade deletion of all database records)
    const supabaseService = createServiceClient()
    
    const { error: deleteError } = await supabaseService.auth.admin.deleteUser(user.id)

    if (deleteError) {
      logError(deleteError, {
        route: 'POST /api/account/delete',
        userId: user.id,
        operation: 'account-deletion-failed',
        storageCleanupCompleted: true,
        deletedFiles: storageResult.deleted,
      })
      return serverErrorResponse(
        deleteError,
        'Failed to delete account. Please contact support.',
        { route: 'POST /api/account/delete' }
      )
    }

    // Account deletion successful
    logInfo('Account deletion completed successfully', {
      route: 'POST /api/account/delete',
      userId: user.id,
      operation: 'account-deletion-success',
      deletedFiles: storageResult.deleted,
      storageErrors: storageResult.errors.length,
    })

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully',
    })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }

    return serverErrorResponse(error, 'Failed to delete account', {
      route: 'POST /api/account/delete',
    })
  }
}
