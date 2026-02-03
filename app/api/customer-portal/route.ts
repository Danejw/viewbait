/**
 * Customer Portal API Route
 * 
 * Handles Stripe customer portal session creation using Stripe SDK.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createCustomerPortalSession } from '@/lib/services/stripe'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  configErrorResponse,
  stripeErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return configErrorResponse('Stripe service not configured')
    }

    // Call Stripe service
    const { url, error: stripeError } = await createCustomerPortalSession(user.id)

    if (stripeError || !url) {
      return stripeErrorResponse(
        stripeError || new Error('Unknown error'),
        'Failed to create customer portal session',
        { route: 'POST /api/customer-portal', userId: user.id }
      )
    }

    return NextResponse.json({
      url,
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/customer-portal', 'create-customer-portal-session', undefined, 'Failed to create customer portal session')
  }
}
