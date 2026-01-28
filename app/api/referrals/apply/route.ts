/**
 * Apply Referral Code API Route
 * 
 * Allows authenticated users to apply a referral code during signup.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { logError } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { validationErrorResponse, serverErrorResponse } from '@/lib/server/utils/error-handler'

export interface ApplyReferralCodeRequest {
  code: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse request body
    const body: ApplyReferralCodeRequest = await request.json()

    // Validate required fields
    if (!body.code || !body.code.trim()) {
      return validationErrorResponse('Referral code is required')
    }

    // Validate code format (alphanumeric, 8-12 chars)
    const codeRegex = /^[A-Z0-9]{8,12}$/
    const normalizedCode = body.code.trim().toUpperCase()
    if (!codeRegex.test(normalizedCode)) {
      return validationErrorResponse('Invalid referral code format. Code must be 8-12 alphanumeric characters.')
    }

    // Call RPC function directly
    const { data, error } = await supabase.rpc('rpc_apply_referral_code', {
      code_input: normalizedCode,
    })

    if (error) {
      logError(error, {
        route: 'POST /api/referrals/apply',
        userId: user.id,
        code: normalizedCode,
        operation: 'apply-referral-code',
      })
      return NextResponse.json(
        {
          error: error.message || 'Failed to apply referral code',
          code: 'APPLY_ERROR',
        },
        { status: 400 }
      )
    }

    if (data && typeof data === 'object' && 'status' in data) {
      const result = data as { status: string; message: string }
      if (result.status === 'success') {
        return NextResponse.json({
          success: true,
          message: result.message,
        })
      } else {
        // Business logic error (self-referral, invalid code, already applied)
        logError(new Error(result.message), {
          route: 'POST /api/referrals/apply',
          userId: user.id,
          code: normalizedCode,
          operation: 'apply-referral-code',
        })
        return NextResponse.json(
          {
            error: result.message,
            code: 'APPLY_ERROR',
          },
          { status: 400 }
        )
      }
    }

    // Unexpected response format
    logError(new Error('Invalid response format'), {
      route: 'POST /api/referrals/apply',
      userId: user.id,
      code: normalizedCode,
      operation: 'apply-referral-code',
    })
    return NextResponse.json(
      {
        error: 'Unexpected response from server',
        code: 'APPLY_ERROR',
      },
      { status: 500 }
    )
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to apply referral code', {
      route: 'POST /api/referrals/apply',
    })
  }
}
