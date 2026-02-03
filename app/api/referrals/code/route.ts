/**
 * Get Referral Code API Route
 * 
 * Returns the authenticated user's referral code if they have one.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sanitizeErrorForClient } from '@/lib/utils/error-sanitizer'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { handleApiError } from '@/lib/server/utils/api-helpers'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Get referral code directly from database
    const { data: code, error } = await supabase
      .from('referral_codes')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" - that's okay, user just doesn't have a code yet
      logError(error, {
        route: 'GET /api/referrals/code',
        userId: user.id,
        operation: 'get-referral-code',
      })

      return NextResponse.json(
        {
          error: sanitizeErrorForClient(error, 'get-referral-code', 'Failed to get referral code'),
          code: 'FETCH_ERROR',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      code: code || null,
      hasCode: !!code,
    })
  } catch (error) {
    return handleApiError(error, 'GET /api/referrals/code', 'get-referral-code', undefined, 'Internal server error')
  }
}
