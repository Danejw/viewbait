/**
 * Subscription Tiers Hook
 * 
 * Fetches subscription tier configuration from the database using React Query.
 * Provides cached access to tier data and helper functions.
 */

import { useQuery } from '@tanstack/react-query'
import type { TierName, TierConfig, Resolution } from '@/lib/constants/subscription-tiers'

export interface TiersResponse {
  tiers: Record<TierName, TierConfig>
  resolution_credits: Record<Resolution, number>
  edit_credit_cost: number
}

/**
 * Fetch tiers from API
 */
async function fetchTiers(): Promise<TiersResponse> {
  const response = await fetch('/api/tiers')
  if (!response.ok) {
    throw new Error('Failed to fetch subscription tiers')
  }
  return response.json()
}

/**
 * Hook to get subscription tiers
 * 
 * @returns Object with tiers data, loading state, and helper functions
 */
export function useSubscriptionTiers() {
  const { data, isLoading, error } = useQuery<TiersResponse>({
    queryKey: ['subscription-tiers'],
    queryFn: fetchTiers,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  })

  /**
   * Get tier configuration by Stripe product ID
   */
  const getTierByProductId = (productId: string | null): TierConfig => {
    if (!data?.tiers) {
      // Fallback to free tier
      return {
        name: 'Free',
        product_id: null,
        price_id: null,
        credits_per_month: 10,
        allowed_resolutions: ['1K'],
        allowed_aspect_ratios: ['16:9'],
        has_watermark: true,
        has_enhance: false,
        persistent_storage: false,
        storage_retention_days: 30,
        priority_generation: false,
        early_access: false,
        price: 0,
        max_variations: 1,
        can_create_custom: false,
      }
    }

    if (!productId) {
      return data.tiers.free || {
        name: 'Free',
        product_id: null,
        price_id: null,
        credits_per_month: 10,
        allowed_resolutions: ['1K'],
        allowed_aspect_ratios: ['16:9'],
        has_watermark: true,
        has_enhance: false,
        persistent_storage: false,
        storage_retention_days: 30,
        priority_generation: false,
        early_access: false,
        price: 0,
        max_variations: 1,
        can_create_custom: false,
      }
    }

    // Find tier by product_id
    for (const [, config] of Object.entries(data.tiers)) {
      if (config.product_id === productId) {
        return config
      }
    }

    // Fallback to free tier
    return data.tiers.free || {
      name: 'Free',
      product_id: null,
      price_id: null,
      credits_per_month: 10,
      allowed_resolutions: ['1K'],
      allowed_aspect_ratios: ['16:9'],
      has_watermark: true,
      has_enhance: false,
      persistent_storage: false,
      storage_retention_days: 30,
      priority_generation: false,
      early_access: false,
      price: 0,
      max_variations: 1,
      can_create_custom: false,
    }
  }

  /**
   * Get tier configuration by tier name
   */
  const getTierByName = (tierName: TierName): TierConfig => {
    if (!data?.tiers) {
      // Fallback to free tier
      return {
        name: 'Free',
        product_id: null,
        price_id: null,
        credits_per_month: 10,
        allowed_resolutions: ['1K'],
        allowed_aspect_ratios: ['16:9'],
        has_watermark: true,
        has_enhance: false,
        persistent_storage: false,
        storage_retention_days: 30,
        priority_generation: false,
        early_access: false,
        price: 0,
        max_variations: 1,
        can_create_custom: false,
      }
    }

    return data.tiers[tierName] || data.tiers.free || {
      name: 'Free',
      product_id: null,
      price_id: null,
      credits_per_month: 10,
      allowed_resolutions: ['1K'],
      allowed_aspect_ratios: ['16:9'],
      has_watermark: true,
      has_enhance: false,
      persistent_storage: false,
      storage_retention_days: 30,
      priority_generation: false,
      early_access: false,
      price: 0,
      max_variations: 1,
      can_create_custom: false,
    }
  }

  /**
   * Get resolution credits mapping
   */
  const getResolutionCredits = (): Record<Resolution, number> => {
    if (!data?.resolution_credits) {
      return {
        '1K': 1,
        '2K': 2,
        '4K': 4,
      }
    }
    return data.resolution_credits
  }

  /**
   * Get edit credit cost
   */
  const getEditCreditCost = (): number => {
    return data?.edit_credit_cost || 2
  }

  return {
    tiers: data?.tiers || ({} as Record<TierName, TierConfig>),
    resolutionCredits: getResolutionCredits(),
    editCreditCost: getEditCreditCost(),
    isLoading,
    error,
    getTierByProductId,
    getTierByName,
  }
}
