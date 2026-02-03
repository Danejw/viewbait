/**
 * Tier Utility
 *
 * Shared helper to resolve the current user's subscription tier for gated routes.
 * Keeps tier resolution consistent and avoids duplicating subscription fetch logic.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getTierByProductId, getTierNameByProductId } from '@/lib/server/data/subscription-tiers'
import type { TierConfig, TierName } from '@/lib/constants/subscription-tiers'

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
    .select('product_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !subscription) {
    return getTierByProductId(null)
  }

  return getTierByProductId(subscription.product_id ?? null)
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
    .select('product_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !subscription?.product_id) {
    return 'free'
  }

  return getTierNameByProductId(subscription.product_id)
}
