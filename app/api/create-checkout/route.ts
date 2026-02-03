/**
 * Create Checkout API Route
 * 
 * Handles Stripe checkout session creation using Stripe SDK.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createCheckoutSession } from '@/lib/services/stripe'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  configErrorResponse,
  stripeErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

export interface CreateCheckoutRequest {
  priceId: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse request body
    const body: CreateCheckoutRequest = await request.json()
    
    // Validate required fields
    if (!body.priceId || !body.priceId.trim()) {
      return validationErrorResponse('Price ID is required')
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return configErrorResponse('Stripe service not configured')
    }

    // Get user email from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()
    
    const userEmail = profile?.email || user.email || ''
    if (!userEmail) {
      return validationErrorResponse('User email is required')
    }

    // Call Stripe service
    const { url, error: stripeError } = await createCheckoutSession(
      user.id,
      userEmail,
      body.priceId.trim()
    )

    if (stripeError || !url) {
      return stripeErrorResponse(
        stripeError || new Error('Unknown error'),
        'Failed to create checkout session',
        { route: 'POST /api/create-checkout', userId: user.id }
      )
    }

    return NextResponse.json({
      url,
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/create-checkout', 'create-checkout-session', undefined, 'Failed to create checkout session')
  }
}
