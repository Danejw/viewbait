/**
 * Server-Side Subscription Data Fetching
 * 
 * Fetches subscription data server-side for SSR.
 * Reuses logic from lib/services/stripe.ts
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { getTierNameByProductId } from '@/lib/server/data/subscription-tiers'
import type { TierName } from '@/lib/constants/subscription-tiers'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserSubscription } from '@/lib/types/database'
import {
  deriveAccessTierFromStatus,
  type AppSubscriptionStatus,
} from '@/lib/services/subscription-lifecycle'

export interface FetchSubscriptionResult {
  subscribed: boolean
  status: string
  tier: TierName
  product_id: string | null
  subscription_end: string | null
  credits_remaining: number
  credits_total: number
  error: Error | null
}

export async function getSubscriptionRow(
  supabase: SupabaseClient,
  userId: string
): Promise<{ data: UserSubscription | null; error: Error | null }> {
  const { data, error } = await supabase
    .from('user_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return { data: null, error: error as Error }
  }

  return { data: data as UserSubscription | null, error: null }
}

/**
 * Fetch subscription status for the authenticated user
 */
export async function fetchSubscription(): Promise<FetchSubscriptionResult> {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const { data: subscription, error: dbError } = await getSubscriptionRow(supabase, user.id)

    if (dbError) {
      return {
        subscribed: false,
        status: 'free',
        tier: 'free',
        product_id: null,
        subscription_end: null,
        credits_remaining: 10,
        credits_total: 10,
        error: dbError as Error,
      }
    }

    // If no subscription found, return free tier defaults
    if (!subscription) {
      return {
        subscribed: false,
        status: 'free',
        tier: 'free',
        product_id: null,
        subscription_end: null,
        credits_remaining: 10,
        credits_total: 10,
        error: null,
      }
    }

    // Return subscription data
    const normalizedStatus = (
      subscription.status === 'canceled' ? 'cancelled' : subscription.status
    ) as AppSubscriptionStatus
    const resolvedTier = await getTierNameByProductId(subscription.product_id)
    const tierName = deriveAccessTierFromStatus(resolvedTier, normalizedStatus)
    const subscribed = !['free', 'cancelled', 'paused_free', 'past_due_locked'].includes(
      normalizedStatus
    )
    return {
      subscribed,
      status: normalizedStatus,
      tier: tierName,
      product_id: subscription.product_id,
      subscription_end: subscription.current_period_end,
      credits_remaining: subscription.credits_remaining,
      credits_total: subscription.credits_total,
      error: null,
    }
  } catch (error) {
    return {
      subscribed: false,
      status: 'free',
      tier: 'free',
      product_id: null,
      subscription_end: null,
      credits_remaining: 10,
      credits_total: 10,
      error: error instanceof Error ? error : new Error('Unknown error'),
    }
  }
}
