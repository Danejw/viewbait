/**
 * Credits Utility
 * 
 * Provides atomic credit decrement operations with idempotency support.
 * Prevents race conditions and double-charges in credit deduction.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface DecrementCreditsResult {
  success: boolean
  duplicate?: boolean
  remaining?: number
  reason?: string
}

export interface IncrementCreditsResult {
  success: boolean
  duplicate?: boolean
  remaining?: number
  reason?: string
}

/**
 * Atomically decrement user credits with idempotency protection.
 * 
 * This function calls a PostgreSQL function that:
 * - Checks/inserts idempotency key atomically (detects duplicates)
 * - Decrements credits only if sufficient balance exists
 * - Records transaction in a single atomic operation
 * - Returns consistent results for duplicate requests
 * 
 * @param client - Supabase client (should be service role for RLS bypass)
 * @param userId - User ID to decrement credits for
 * @param cost - Number of credits to deduct
 * @param idempotencyKey - Unique key to prevent duplicate operations
 * @param thumbnailId - Optional thumbnail ID associated with this transaction
 * @param description - Optional description for the transaction
 * @param transactionType - Transaction type: 'generation' or 'edit' (default: 'generation')
 * @returns Result object with success status, remaining credits, and duplicate flag
 */
export async function decrementCreditsAtomic(
  client: SupabaseClient,
  userId: string,
  cost: number,
  idempotencyKey: string,
  thumbnailId?: string | null,
  description?: string | null,
  transactionType: 'generation' | 'edit' = 'generation'
): Promise<DecrementCreditsResult> {
  const { data, error } = await client.rpc('decrement_credits_atomic', {
    p_user_id: userId,
    p_cost: cost,
    p_idempotency_key: idempotencyKey,
    p_thumbnail_id: thumbnailId || null,
    p_description: description || null,
    p_transaction_type: transactionType,
  })

  if (error) {
    // Log error and return failure
    console.error('Error calling decrement_credits_atomic:', error)
    return {
      success: false,
      reason: 'DATABASE_ERROR',
    }
  }

  // Parse JSON response from RPC
  if (!data) {
    return {
      success: false,
      reason: 'NO_RESPONSE',
    }
  }

  // RPC returns JSON, parse it
  const result = typeof data === 'string' ? JSON.parse(data) : data

  return {
    success: result.success ?? false,
    duplicate: result.duplicate ?? false,
    remaining: result.remaining ?? undefined,
    reason: result.reason ?? undefined,
  }
}

/**
 * Atomically increment user credits with idempotency protection.
 * 
 * This function calls a PostgreSQL function that:
 * - Checks/inserts idempotency key atomically (detects duplicates)
 * - Increments credits atomically
 * - Records transaction in a single atomic operation
 * - Returns consistent results for duplicate requests
 * 
 * Used for refunding credits when generation fails or times out.
 * 
 * @param client - Supabase client (should be service role for RLS bypass)
 * @param userId - User ID to increment credits for
 * @param amount - Number of credits to add (must be positive)
 * @param idempotencyKey - Unique key to prevent duplicate operations
 * @param description - Optional description for the transaction
 * @param transactionType - Transaction type: 'refund' (default) or other type
 * @returns Result object with success status, remaining credits, and duplicate flag
 */
export async function incrementCreditsAtomic(
  client: SupabaseClient,
  userId: string,
  amount: number,
  idempotencyKey: string,
  description?: string | null,
  transactionType: string = 'refund'
): Promise<IncrementCreditsResult> {
  if (amount <= 0) {
    return {
      success: false,
      reason: 'INVALID_AMOUNT',
    }
  }

  const { data, error } = await client.rpc('increment_credits_atomic', {
    p_user_id: userId,
    p_amount: amount,
    p_idempotency_key: idempotencyKey,
    p_description: description || null,
    p_transaction_type: transactionType,
  })

  if (error) {
    // Log error and return failure
    console.error('Error calling increment_credits_atomic:', error)
    return {
      success: false,
      reason: 'DATABASE_ERROR',
    }
  }

  // Parse JSON response from RPC
  if (!data) {
    return {
      success: false,
      reason: 'NO_RESPONSE',
    }
  }

  // RPC returns JSON, parse it
  const result = typeof data === 'string' ? JSON.parse(data) : data

  return {
    success: result.success ?? false,
    duplicate: result.duplicate ?? false,
    remaining: result.remaining ?? undefined,
    reason: result.reason ?? undefined,
  }
}
