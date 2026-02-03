/**
 * Create Referral Code API Route
 * 
 * Creates a referral code for the authenticated user if they have an active subscription.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createReferralCode } from '@/lib/services/referrals'
import { checkSubscription } from '@/lib/services/stripe'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { subscriptionErrorResponse, forbiddenResponse, databaseErrorResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Check if user already has a referral code directly from database
    const { data: existingCode, error: getCodeError } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()
    
    if (getCodeError && getCodeError.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's okay, user just doesn't have a code yet
      logError(getCodeError, {
        route: 'POST /api/referrals/create',
        userId: user.id,
        operation: 'check-existing-code',
      })
    }

    if (existingCode) {
      return NextResponse.json({
        code: existingCode.code,
        message: 'Referral code already exists',
      })
    }

    // Check if user has an active subscription
    const subscriptionData = await checkSubscription(user.id)

    if (subscriptionData.error) {
      logError(subscriptionData.error, {
        route: 'POST /api/referrals/create',
        userId: user.id,
        operation: 'check-subscription',
      })
      return subscriptionErrorResponse('Failed to check subscription status')
    }

    // Verify user has active subscription
    if (!subscriptionData.subscribed) {
      return forbiddenResponse('You must have an active subscription to create a referral code.')
    }

    // Create referral code
    const { code, error: createError } = await createReferralCode(user.id)

    if (createError) {
      logError(createError, {
        route: 'POST /api/referrals/create',
        userId: user.id,
        operation: 'create-referral-code',
      })
      return databaseErrorResponse('Failed to create referral code')
    }

    if (!code) {
      return databaseErrorResponse('Failed to create referral code')
    }

    return NextResponse.json({
      code: code.code,
      message: 'Referral code created successfully',
    })
  } catch (error) {
    return handleApiError(error, 'POST /api/referrals/create', 'create-referral-code', undefined, 'Failed to create referral code')
  }
}
