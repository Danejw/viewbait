/**
 * Subscriptions Service
 * 
 * Handles subscription status, credits, and Stripe integration.
 * Communicates with Next.js API routes for all operations.
 */

import { apiGet, apiPost } from '@/lib/services/api-client'
import type { 
  UserSubscription, 
  CreditTransaction, 
  CreditTransactionInsert 
} from '@/lib/types/database'
import { 
  type TierName 
} from '@/lib/constants/subscription-tiers'
import { getTierByProductId as getTierByProductIdServer, getTierNameByProductId as getTierNameByProductIdServer } from '@/lib/server/data/subscription-tiers'

export type CustomerPortalFlowType = 'manage' | 'subscription_cancel' | 'subscription_update'

export interface SubscriptionStatus {
  subscribed: boolean
  status: string
  tier: TierName
  product_id: string | null
  subscription_end: string | null
  credits_remaining: number
  credits_total: number
}

/**
 * Get the current user's subscription
 */
export async function getSubscription(userId: string): Promise<{
  subscription: UserSubscription | null
  error: Error | null
}> {
  const { data, error } = await apiGet<{ subscription: UserSubscription | null }>('/api/subscriptions')

  return {
    subscription: data?.subscription || null,
    error: error ? new Error(error.message) : null,
  }
}

/**
 * Check subscription status via API route
 * This syncs with Stripe and updates credits if needed
 */
export async function checkSubscription(): Promise<{
  status: SubscriptionStatus | null
  error: Error | null
}> {
  try {
    const response = await fetch('/api/check-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      return { status: null, error: new Error(errorData.error || 'Failed to check subscription') }
    }

    const data = await response.json()
    // Tier name is already returned from the API
    const tierName = data.tier || 'free'

    return {
      status: {
        subscribed: data.subscribed,
        status: data.status,
        tier: tierName,
        product_id: data.product_id,
        subscription_end: data.subscription_end,
        credits_remaining: data.credits_remaining,
        credits_total: data.credits_total,
      },
      error: null,
    }
  } catch (error) {
    return {
      status: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Create a Stripe checkout session for subscription
 */
export async function createCheckout(priceId: string): Promise<{
  url: string | null
  error: Error | null
}> {
  try {
    const response = await fetch('/api/create-checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ priceId }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        url: null,
        error: new Error(errorData.error || 'Failed to create checkout'),
      }
    }

    const data = await response.json()
    return { url: data.url, error: null }
  } catch (error) {
    return {
      url: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

/**
 * Get Stripe customer portal URL for subscription management
 */
export async function getCustomerPortal(flowType: CustomerPortalFlowType = 'manage'): Promise<{
  url: string | null
  error: Error | null
}> {
  try {
    const response = await fetch('/api/customer-portal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ flowType }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return { url: null, error: new Error(errorData.error || 'Failed to get customer portal') }
    }

    const data = await response.json()
    return { url: data.url, error: null }
  } catch (error) {
    return {
      url: null,
      error: error instanceof Error ? error : new Error('Network error'),
    }
  }
}

export async function pauseSubscription(): Promise<{
  success: boolean
  error: Error | null
}> {
  const { data, error } = await apiPost<{ success: boolean }>('/api/subscriptions', {
    action: 'pause',
  })

  return {
    success: data?.success ?? false,
    error: error ? new Error(error.message) : null,
  }
}

export async function resumeSubscription(): Promise<{
  success: boolean
  status: string | null
  error: Error | null
}> {
  const { data, error } = await apiPost<{ success: boolean; status: string | null }>(
    '/api/subscriptions',
    {
      action: 'resume',
    }
  )

  return {
    success: data?.success ?? false,
    status: data?.status ?? null,
    error: error ? new Error(error.message) : null,
  }
}

/**
 * Deduct credits for a generation
 */
export async function deductCredits(
  userId: string,
  amount: number,
  type: string,
  description: string,
  thumbnailId?: string
): Promise<{
  transaction: CreditTransaction | null
  error: Error | null
}> {
  const { data, error } = await apiPost<{ transaction: CreditTransaction, creditsRemaining: number }>(
    '/api/subscriptions/credits/deduct',
    {
      amount,
      type,
      description,
      thumbnailId,
    }
  )

  return {
    transaction: data?.transaction || null,
    error: error ? new Error(error.message) : null,
  }
}

/**
 * Get credit transaction history
 */
export async function getCreditHistory(
  userId: string,
  limit: number = 50,
  offset: number = 0,
  type?: string
): Promise<{
  transactions: CreditTransaction[]
  error: Error | null
}> {
  // Build query string
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  })
  if (type) {
    params.append('type', type)
  }

  const { data, error } = await apiGet<{ transactions: CreditTransaction[], count: number }>(
    `/api/subscriptions/credits/history?${params.toString()}`
  )

  return {
    transactions: data?.transactions || [],
    error: error ? new Error(error.message) : null,
  }
}

/**
 * Get subscription tier config (server-side only)
 */
export async function getSubscriptionTierConfig(productId: string | null) {
  return await getTierByProductIdServer(productId)
}

/**
 * Create or get subscription record for a new user
 */
export async function ensureSubscription(userId: string): Promise<{
  subscription: UserSubscription | null
  error: Error | null
}> {
  // First try to get existing subscription
  const { data: existingData, error: getError } = await apiGet<{ subscription: UserSubscription | null }>('/api/subscriptions')

  if (getError) {
    return {
      subscription: null,
      error: new Error(getError.message),
    }
  }

  // If subscription exists, return it
  if (existingData?.subscription) {
    return { subscription: existingData.subscription, error: null }
  }

  // Create new free subscription
  const { data, error } = await apiPost<{ subscription: UserSubscription }>(
    '/api/subscriptions',
    {
      status: 'free',
      credits_total: 10,
      credits_remaining: 10,
    }
  )

  return {
    subscription: data?.subscription || null,
    error: error ? new Error(error.message) : null,
  }
}

/**
 * Grant credits to a user (server-side only)
 * This function requires service role access and should only be called from server-side code
 */
export async function grantCredits(
  userId: string,
  amount: number,
  type: string,
  description: string,
  metadata?: Record<string, unknown>,
  idempotencyKey?: string
): Promise<{
  transaction: CreditTransaction | null
  error: Error | null
}> {
  // This function must be called server-side with service role client
  // Import createServiceClient dynamically to avoid client-side bundling
  const { createServiceClient } = await import('@/lib/supabase/service')
  const supabaseService = createServiceClient()

  // Build transaction data
  const transactionData: CreditTransactionInsert = {
    user_id: userId,
    amount: amount, // Positive for grants
    type,
    description,
    metadata: metadata || (idempotencyKey ? { idempotency_key: idempotencyKey } : undefined),
  }

  // Insert credit transaction
  const { data: transaction, error: transactionError } = await supabaseService
    .from('credit_transactions')
    .insert(transactionData)
    .select()
    .single()

  if (transactionError) {
    // If it's a unique violation on idempotency key, that's okay - already granted
    if (transactionError.code === '23505' && idempotencyKey) {
      // Try to find the existing transaction
      const { data: existing } = await supabaseService
        .from('credit_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('metadata->>idempotency_key', idempotencyKey)
        .single()
      
      if (existing) {
        return { transaction: existing as CreditTransaction, error: null }
      }
    }
    return { transaction: null, error: transactionError as Error }
  }

  // Update remaining credits (create subscription if doesn't exist)
  const { data: sub } = await supabaseService
    .from('user_subscriptions')
    .select('credits_remaining')
    .eq('user_id', userId)
    .single()

  if (sub) {
    await supabaseService
      .from('user_subscriptions')
      .update({ credits_remaining: sub.credits_remaining + amount })
      .eq('user_id', userId)
  } else {
    // Create subscription if it doesn't exist
    await supabaseService
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        status: 'free',
        credits_total: Math.max(amount, 10),
        credits_remaining: amount,
      })
  }

  return { transaction, error: null }
}

