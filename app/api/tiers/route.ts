/**
 * Subscription Tiers API Route
 * 
 * Returns all active subscription tiers from the database.
 * Public endpoint - tier information is not sensitive.
 */

import { NextResponse } from 'next/server'
import { getAllTiers, getResolutionCredits, getEditCreditCost } from '@/lib/server/data/subscription-tiers'
import { serverErrorResponse } from '@/lib/server/utils/error-handler'
import type { TierName, Resolution } from '@/lib/constants/subscription-tiers'

export interface TiersResponse {
  tiers: Record<TierName, {
    name: string
    product_id: string | null
    price_id: string | null
    credits_per_month: number
    allowed_resolutions: Resolution[]
    allowed_aspect_ratios: string[]
    has_watermark: boolean
    has_enhance: boolean
    persistent_storage: boolean
    storage_retention_days: number | null
    priority_generation: boolean
    early_access: boolean
    price: number
    max_variations: number
    can_create_custom: boolean
  }>
  resolution_credits: Record<Resolution, number>
  edit_credit_cost: number
}

/**
 * GET /api/tiers
 * Returns all active subscription tiers and settings
 */
export async function GET() {
  try {
    const [tiers, resolutionCredits, editCreditCost] = await Promise.all([
      getAllTiers(),
      getResolutionCredits(),
      getEditCreditCost(),
    ])

    const response: TiersResponse = {
      tiers,
      resolution_credits: resolutionCredits,
      edit_credit_cost: editCreditCost,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('[API /tiers] Error:', error)
    return serverErrorResponse(error, 'Failed to fetch subscription tiers', {
      route: 'GET /api/tiers',
    })
  }
}
