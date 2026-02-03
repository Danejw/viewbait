/**
 * Deduct Credits API Route
 * 
 * Handles POST requests to deduct credits from a user's subscription.
 * Uses service role client to bypass RLS (server-side only).
 */

import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  insufficientCreditsResponse,
  databaseErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError } from '@/lib/server/utils/logger'
import { decrementCreditsAtomic } from '@/lib/server/utils/credits'
import { NextResponse } from 'next/server'
import type { CreditTransaction, CreditTransactionInsert } from '@/lib/types/database'

export interface DeductCreditsRequest {
  amount: number
  type: string
  description: string
  thumbnailId?: string
}

/**
 * POST /api/subscriptions/credits/deduct
 * Deduct credits from user's subscription
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse request body
    const body: DeductCreditsRequest = await request.json()

    // Validate required fields
    if (!body.amount || body.amount <= 0) {
      return validationErrorResponse('Amount must be greater than 0')
    }

    if (!body.type || !body.type.trim()) {
      return validationErrorResponse('Type is required')
    }

    if (!body.description || !body.description.trim()) {
      return validationErrorResponse('Description is required')
    }

    // Validate transaction type (must be 'generation' or 'edit' for atomic function)
    const transactionType = body.type.trim()
    if (transactionType !== 'generation' && transactionType !== 'edit') {
      return validationErrorResponse('Type must be "generation" or "edit"')
    }

    // Use service role client for atomic credit decrement (bypasses RLS)
    const supabaseService = createServiceClient()

    // Get current subscription to validate credits before proceeding
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('credits_remaining')
      .eq('user_id', user.id)
      .single()

    const currentCredits = subscription?.credits_remaining ?? 10

    // Validate credits are sufficient before proceeding
    // This prevents unnecessary database operations and provides clear error messages
    if (currentCredits < body.amount) {
      return insufficientCreditsResponse(currentCredits, body.amount)
    }

    // Generate idempotency key for this operation
    const idempotencyKey = crypto.randomUUID()

    // Call atomic credit decrement function
    const creditResult = await decrementCreditsAtomic(
      supabaseService,
      user.id,
      body.amount,
      idempotencyKey,
      body.thumbnailId || null,
      body.description.trim(),
      transactionType as 'generation' | 'edit'
    )

    // Handle atomic function results
    if (!creditResult.success) {
      if (creditResult.reason === 'INSUFFICIENT') {
        return insufficientCreditsResponse(currentCredits, body.amount)
      }

      // Database error or other failure
      logError(new Error(`Credit deduction failed: ${creditResult.reason}`), {
        route: 'POST /api/subscriptions/credits/deduct',
        userId: user.id,
        operation: 'atomic-credit-decrement',
        amount: body.amount,
        idempotencyKey,
      })
      return databaseErrorResponse('Failed to deduct credits')
    }

    // If duplicate (idempotent retry), return success with existing result
    if (creditResult.duplicate) {
      // Transaction was already processed in previous attempt, return success
      return NextResponse.json({
        transaction: {
          id: 'duplicate',
          user_id: user.id,
          amount: -body.amount,
          type: transactionType,
          description: body.description.trim(),
          thumbnail_id: body.thumbnailId || null,
          created_at: new Date().toISOString(),
        } as CreditTransaction,
        creditsRemaining: creditResult.remaining ?? currentCredits - body.amount,
      })
    }

    // Success: use remaining credits from atomic function
    const newCreditsRemaining = creditResult.remaining ?? currentCredits - body.amount

    // Fetch the created transaction for response (optional, for consistency with old API)
    const { data: transaction } = await supabaseService
      .from('credit_transactions')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      transaction: transaction as CreditTransaction || {
        id: 'atomic',
        user_id: user.id,
        amount: -body.amount,
        type: transactionType,
        description: body.description.trim(),
        thumbnail_id: body.thumbnailId || null,
        idempotency_key: idempotencyKey,
        created_at: new Date().toISOString(),
      } as CreditTransaction,
      creditsRemaining: newCreditsRemaining,
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/subscriptions/credits/deduct', 'deduct-credits', undefined, 'Failed to deduct credits')
  }
}
