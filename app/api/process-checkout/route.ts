/**
 * Process Checkout Session API Route
 * 
 * Fallback route to process checkout session when user returns from Stripe.
 * This is called when session_id is detected in the URL.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { processCheckoutSession } from '@/lib/services/stripe'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { validationErrorResponse, configErrorResponse, serverErrorResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

export interface ProcessCheckoutRequest {
  sessionId: string
}

export async function POST(request: Request) {
  let userId: string | undefined
  
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)
    userId = user.id

    // Parse request body
    const body: ProcessCheckoutRequest = await request.json()
    
    // Validate required fields
    if (!body.sessionId || !body.sessionId.trim()) {
      return validationErrorResponse('Session ID is required')
    }

    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return configErrorResponse('Stripe service not configured')
    }

    // Process the checkout session (pass current user so only the checkout owner can complete it)
    const result = await processCheckoutSession(body.sessionId.trim(), user.id)

    if (!result.success) {
      logError(result.error || new Error('Unknown error'), {
        route: 'POST /api/process-checkout',
        userId: user.id,
        sessionId: body.sessionId,
        operation: 'process-checkout-session',
      })
      return serverErrorResponse(
        result.error || new Error('Unknown error'),
        'Failed to process checkout session',
        {
          route: 'POST /api/process-checkout',
          userId: user.id,
        }
      )
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/process-checkout', 'process-checkout', undefined, 'Failed to process checkout')
  }
}
