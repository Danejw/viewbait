/**
 * Tier Utility
 *
 * Shared helper to resolve the current user's subscription tier for gated routes.
 * Keeps tier resolution consistent and avoids duplicating subscription fetch logic.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getTierByProductId, getTierNameByProductId } from '@/lib/server/data/subscription-tiers'
import type { TierConfig, TierName } from '@/lib/constants/subscription-tiers'
import {
  deriveAccessTierFromStatus,
  type AppSubscriptionStatus,
} from '@/lib/services/subscription-lifecycle'

function normalizeSubscriptionStatus(
  status: string | null | undefined,
  productId: string | null | undefined
): AppSubscriptionStatus {
  if (status === 'canceled') {
    return 'cancelled'
  }

  if (status) {
    return status as AppSubscriptionStatus
  }

  return productId ? 'active' : 'free'
}

/**
 * Get tier configuration for a user by their user ID.
 * Loads user_subscriptions for the user and resolves tier via product_id.
 *
 * @param supabase - Supabase client (typically from createClient() so RLS applies)
 * @param userId - Authenticated user's ID
 * @returns Tier config for the user (free tier if no subscription or not found)
 */
export async function getTierForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<TierConfig> {
  const { data: subscription, error } = await supabase
    .from('user_subscriptions')
    .select('product_id, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !subscription) {
    return getTierByProductId(null)
  }

  const productId = subscription.product_id ?? null
  const resolvedTierName = await getTierNameByProductId(productId)
  const accessTierName = deriveAccessTierFromStatus(
    resolvedTierName,
    normalizeSubscriptionStatus(subscription.status, productId)
  )

  if (accessTierName === 'free' && resolvedTierName !== 'free') {
    return getTierByProductId(null)
  }

  return getTierByProductId(productId)
}

/**
 * Get stable tier name (TierName) for a user by their user ID.
 * Use this for capability checks (e.g. YouTube = Pro only); do not use TierConfig.name (display name).
 *
 * @param supabase - Supabase client (typically from createClient() so RLS applies)
 * @param userId - Authenticated user's ID
 * @returns TierName e.g. 'free' | 'starter' | 'advanced' | 'pro'
 */
export async function getTierNameForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<TierName> {
  const { data: subscription, error } = await supabase
    .from('user_subscriptions')
    .select('product_id, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !subscription) {
    return 'free'
  }

  const productId = subscription.product_id ?? null
  const resolvedTierName = await getTierNameByProductId(productId)

  return deriveAccessTierFromStatus(
    resolvedTierName,
    normalizeSubscriptionStatus(subscription.status, productId)
  )
}
