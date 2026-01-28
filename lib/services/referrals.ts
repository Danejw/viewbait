/**
 * Referrals Service
 * 
 * Handles referral code operations and referral relationships.
 * Provides functions for applying codes, fetching codes, and getting stats.
 * Client-side functions call API routes; server-side functions use service role client.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { apiGet, apiPost } from '@/lib/services/api-client'
import type { ReferralCode } from '@/lib/types/database'

/**
 * Apply a referral code for the authenticated user
 * Client-side only - calls API route
 */
export async function applyReferralCode(code: string): Promise<{
  success: boolean
  message: string
  error: Error | null
}> {
  const response = await apiPost<{ success: boolean; message: string }>(
    '/api/referrals/apply',
    { code: code.trim().toUpperCase() }
  )

  if (response.error) {
    return {
      success: false,
      message: response.error.message || 'Failed to apply referral code',
      error: new Error(response.error.message || 'Failed to apply referral code'),
    }
  }

  if (response.data) {
    return {
      success: response.data.success,
      message: response.data.message,
      error: null,
    }
  }

  return {
    success: false,
    message: 'Unexpected response from server',
    error: new Error('Invalid response format'),
  }
}

/**
 * Get the referral code for the authenticated user (if they have one)
 * Client-side only - calls API route
 */
export async function getReferralCode(): Promise<{
  code: ReferralCode | null
  error: Error | null
}> {
  const response = await apiGet<{ code: ReferralCode | null; hasCode: boolean }>(
    '/api/referrals/code'
  )

  if (response.error) {
    // 404 means user doesn't have a code yet - not an error
    if (response.error.status === 404) {
      return { code: null, error: null }
    }
    return {
      code: null,
      error: new Error(response.error.message || 'Failed to get referral code'),
    }
  }

  if (response.data) {
    return { code: response.data.code, error: null }
  }

  return { code: null, error: null }
}

/**
 * Get referral statistics for the authenticated user
 * Client-side only - calls API route
 */
export async function getReferralStats(): Promise<{
  stats: {
    pending: number
    rewarded: number
    total: number
  } | null
  error: Error | null
}> {
  const response = await apiGet<{ stats: { pending: number; rewarded: number; total: number } }>(
    '/api/referrals/stats'
  )

  if (response.error) {
    return {
      stats: null,
      error: new Error(response.error.message || 'Failed to get referral stats'),
    }
  }

  if (response.data) {
    return { stats: response.data.stats, error: null }
  }

  return {
    stats: { pending: 0, rewarded: 0, total: 0 },
    error: null,
  }
}

/**
 * Check if a user has made at least one purchase
 * Server-side only - uses service role client
 */
export async function checkUserHasPurchased(userId: string): Promise<{
  hasPurchased: boolean
  error: Error | null
}> {
  const supabaseService = createServiceClient()

  const { data, error } = await supabaseService
    .from('user_purchases')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    return { hasPurchased: false, error: error as Error }
  }

  return { hasPurchased: !!data, error: null }
}

/**
 * Get referral code by code string (for validation)
 * Server-side only - uses service role client
 */
export async function getReferralCodeByCode(code: string): Promise<{
  referralCode: ReferralCode | null
  error: Error | null
}> {
  const supabaseService = createServiceClient()

  const { data, error } = await supabaseService
    .from('referral_codes')
    .select('*')
    .eq('code', code.trim().toUpperCase())
    .eq('is_active', true)
    .single()

  if (error && error.code !== 'PGRST116') {
    return { referralCode: null, error: error as Error }
  }

  return { referralCode: data || null, error: null }
}

/**
 * Create a referral code for a user (server-side only)
 * Called after first purchase
 */
export async function createReferralCode(userId: string): Promise<{
  code: ReferralCode | null
  error: Error | null
}> {
  const supabaseService = createServiceClient()

  // Check if user already has a code
  const { data: existing } = await supabaseService
    .from('referral_codes')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (existing) {
    return { code: existing, error: null }
  }

  // Generate code using RPC function
  const { data: generatedCode, error: generateError } = await supabaseService.rpc(
    'generate_referral_code'
  )

  if (generateError || !generatedCode) {
    return {
      code: null,
      error: generateError || new Error('Failed to generate referral code'),
    }
  }

  // Insert referral code
  const { data: newCode, error: insertError } = await supabaseService
    .from('referral_codes')
    .insert({
      user_id: userId,
      code: generatedCode,
      is_active: true,
    })
    .select()
    .single()

  if (insertError) {
    // If code collision, retry once
    if (insertError.code === '23505') {
      const { data: retryCode, error: retryError } = await supabaseService.rpc(
        'generate_referral_code'
      )
      if (!retryError && retryCode) {
        const { data: finalCode, error: finalError } = await supabaseService
          .from('referral_codes')
          .insert({
            user_id: userId,
            code: retryCode,
            is_active: true,
          })
          .select()
          .single()

        if (finalError) {
          return { code: null, error: finalError as Error }
        }
        return { code: finalCode, error: null }
      }
    }
    return { code: null, error: insertError as Error }
  }

  return { code: newCode, error: null }
}
