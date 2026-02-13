/**
 * Credit History API Route
 * 
 * Handles GET requests to retrieve credit transaction history.
 * Uses server client with RLS enforcement (users can only see their own transactions).
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  databaseErrorResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError, parseQueryParams } from '@/lib/server/utils/api-helpers'
import { logError } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import type { CreditTransaction } from '@/lib/types/database'

// Cache responses for 60 seconds
export const revalidate = 60

/**
 * GET /api/subscriptions/credits/history
 * Get credit transaction history for the authenticated user
 * Query params: limit (default 50), offset (default 0), type (optional filter)
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse query parameters (lenient: invalid limit/offset use default or capped)
    const { searchParams } = new URL(request.url)
    const { limit, offset } = parseQueryParams(request, {
      defaultLimit: 50,
      maxLimit: 100,
      defaultOffset: 0,
    })
    const typeFilter = searchParams.get('type')

    // Build query (RLS enforces user can only see own transactions)
    let query = supabase
      .from('credit_transactions')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)

    // Apply type filter if provided (before ordering and range)
    if (typeFilter && typeFilter.trim()) {
      query = query.eq('type', typeFilter)
    }

    // Apply ordering and pagination
    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: transactions, error, count } = await query

    if (error) {
      logError(error, {
        route: 'GET /api/subscriptions/credits/history',
        userId: user.id,
        operation: 'fetch-credit-history',
      })
      return databaseErrorResponse('Failed to fetch credit history')
    }

    return NextResponse.json({
      transactions: (transactions || []) as CreditTransaction[],
      count: count || 0,
    })
  } catch (error) {
    return handleApiError(error, 'GET /api/subscriptions/credits/history', 'fetch-credit-history', undefined, 'Failed to fetch credit history')
  }
}
