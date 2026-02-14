/**
 * Subscriptions API Route
 * 
 * Handles GET (read subscription) and POST (create/update subscription) operations.
 * GET uses server client (RLS enforced), POST uses service role client.
 */

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  createCustomerPortalSession,
  pauseSubscription,
  resumeSubscription,
  type CustomerPortalFlowType,
} from '@/lib/services/stripe'
import {
  validationErrorResponse,
  databaseErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { UserSubscription, UserSubscriptionInsert } from '@/lib/types/database'

interface SubscriptionActionRequest {
  action?: 'pause' | 'resume' | 'manage_cancel' | 'manage_update'
}

// Cache GET responses for 30 seconds
export const revalidate = 30

/**
 * GET /api/subscriptions
 * Get the current user's subscription
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const { data: subscription, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (error) {
      // If subscription doesn't exist, return null (not an error)
      if (error.code === 'PGRST116') {
        return NextResponse.json({ subscription: null })
      }

      logError(error, {
        route: 'GET /api/subscriptions',
        userId: user.id,
        operation: 'fetch-subscription',
      })
      return databaseErrorResponse('Failed to fetch subscription')
    }

    return NextResponse.json({ subscription })
  } catch (error) {
    return handleApiError(error, 'GET /api/subscriptions', 'fetch-subscription', undefined, 'Failed to fetch subscription')
  }
}

/**
 * POST /api/subscriptions
 * Create or update subscription record (server-side only, uses service role)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse request body
    const body = (await request.json()) as Partial<UserSubscriptionInsert> & SubscriptionActionRequest

    if (body.action === 'pause') {
      const result = await pauseSubscription(user.id)
      if (!result.success || result.error) {
        return databaseErrorResponse(result.error?.message || 'Failed to pause subscription')
      }

      return NextResponse.json({ success: true })
    }

    if (body.action === 'resume') {
      const result = await resumeSubscription(user.id)
      if (!result.success || result.error) {
        return databaseErrorResponse(result.error?.message || 'Failed to resume subscription')
      }

      return NextResponse.json({ success: true, status: result.status ?? 'active' })
    }

    if (body.action === 'manage_cancel' || body.action === 'manage_update') {
      const flowType: CustomerPortalFlowType =
        body.action === 'manage_cancel' ? 'subscription_cancel' : 'subscription_update'
      const { url, error } = await createCustomerPortalSession(user.id, flowType)
      if (error || !url) {
        return databaseErrorResponse(error?.message || 'Failed to create customer portal link')
      }

      return NextResponse.json({ url })
    }

    // Use service role client for subscription creation/updates
    const supabaseService = createServiceClient()

    // Check if subscription already exists
    const { data: existing } = await supabaseService
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (existing) {
      // Update existing subscription
      const updateData: Partial<UserSubscriptionInsert> = {
        ...body,
        user_id: user.id, // Ensure user_id matches authenticated user
      }

      const { data: subscription, error: updateError } = await supabaseService
        .from('user_subscriptions')
        .update(updateData)
        .eq('user_id', user.id)
        .select()
        .single()

      if (updateError) {
        logError(updateError, {
          route: 'POST /api/subscriptions',
          userId: user.id,
          operation: 'update-subscription',
        })
        return databaseErrorResponse('Failed to update subscription')
      }

      return NextResponse.json({ subscription }, { status: 200 })
    } else {
      // Create new subscription
      const insertData: UserSubscriptionInsert = {
        user_id: user.id,
        status: body.status || 'free',
        credits_total: body.credits_total ?? 10,
        credits_remaining: body.credits_remaining ?? 10,
        stripe_customer_id: body.stripe_customer_id || null,
        subscription_id: body.subscription_id || null,
        product_id: body.product_id || null,
        current_period_start: body.current_period_start || null,
        current_period_end: body.current_period_end || null,
      }

      const { data: subscription, error: insertError } = await supabaseService
        .from('user_subscriptions')
        .insert(insertData)
        .select()
        .single()

      if (insertError) {
        logError(insertError, {
          route: 'POST /api/subscriptions',
          userId: user.id,
          operation: 'create-subscription',
        })
        return databaseErrorResponse('Failed to create subscription')
      }

      return NextResponse.json({ subscription }, { status: 201 })
    }
  } catch (error) {
    return handleApiError(error, 'POST /api/subscriptions', 'create-update-subscription', undefined, 'Failed to create/update subscription')
  }
}
