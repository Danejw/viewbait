/**
 * Get Referral Stats API Route
 * 
 * Returns referral statistics for the authenticated user.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { handleApiError } from '@/lib/server/utils/api-helpers'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Get referrals where user is the referrer
    const { data: referrals, error } = await supabase
      .from('referrals')
      .select('status')
      .eq('referrer_user_id', user.id)

    if (error) {
      logError(error, {
        route: 'GET /api/referrals/stats',
        userId: user.id,
        operation: 'get-referral-stats',
      })
      return NextResponse.json(
        {
          error: 'Failed to get referral stats',
          code: 'FETCH_ERROR',
        },
        { status: 500 }
      )
    }

    const stats = {
      pending: referrals?.filter((r) => r.status === 'pending').length || 0,
      rewarded: referrals?.filter((r) => r.status === 'rewarded').length || 0,
      total: referrals?.length || 0,
    }

    return NextResponse.json({
      stats,
    })
  } catch (error) {
    return handleApiError(error, 'GET /api/referrals/stats', 'get-referral-stats', undefined, 'Failed to get referral stats')
  }
}
