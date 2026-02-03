/**
 * Check Subscription API Route
 * 
 * Checks user subscription status by querying database directly.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkSubscription } from '@/lib/services/stripe'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { subscriptionErrorResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

// Cache responses for 30 seconds (shorter than other routes since credits change frequently)
export const revalidate = 30

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Call Stripe service to check subscription
    const subscriptionData = await checkSubscription(user.id)

    if (subscriptionData.error) {
      logError(subscriptionData.error, {
        route: 'POST /api/check-subscription',
        userId: user.id,
        operation: 'check-subscription-service',
      })
      return subscriptionErrorResponse('Failed to check subscription')
    }

    return NextResponse.json({
      subscribed: subscriptionData.subscribed,
      status: subscriptionData.status,
      tier: subscriptionData.tier,
      product_id: subscriptionData.product_id,
      subscription_end: subscriptionData.subscription_end,
      credits_remaining: subscriptionData.credits_remaining,
      credits_total: subscriptionData.credits_total,
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/check-subscription', 'check-subscription', undefined, 'Failed to check subscription')
  }
}
