/**
 * Subscription Tier Configuration
 * 
 * Type definitions for subscription tiers.
 * Actual tier data is now stored in the database and fetched via hooks/cache.
 * This file maintains type definitions and helper function signatures for backward compatibility.
 */

export type TierName = 'free' | 'starter' | 'advanced' | 'pro'

export type Resolution = '1K' | '2K' | '4K'

export interface TierConfig {
  name: string
  product_id: string | null
  price_id: string | null
  credits_per_month: number
  allowed_resolutions: Resolution[]
  has_watermark: boolean
  has_enhance: boolean
  persistent_storage: boolean
  storage_retention_days: number | null
  priority_generation: boolean
  early_access: boolean
  price: number
  max_variations: number
  can_create_custom: boolean
}

/**
 * @deprecated Use useSubscriptionTiers() hook on client or getTierByProductId() on server
 * This constant is no longer populated - data comes from database
 */
export const SUBSCRIPTION_TIERS: Record<TierName, TierConfig> = {} as Record<TierName, TierConfig>

/**
 * @deprecated Use useSubscriptionTiers().resolutionCredits on client or getResolutionCredits() on server
 */
export const RESOLUTION_CREDITS: Record<Resolution, number> = {
  '1K': 1,
  '2K': 2,
  '4K': 4,
} as Record<Resolution, number>

/**
 * @deprecated Use useSubscriptionTiers().editCreditCost on client or getEditCreditCost() on server
 */
export const EDIT_CREDIT_COST = 2

/**
 * @deprecated On client: use useSubscriptionTiers().getTierByProductId()
 * On server: use getTierByProductId() from @/lib/server/data/subscription-tiers
 * This function is kept for backward compatibility but will be removed
 */
export function getTierByProductId(productId: string | null): TierConfig {
  // Fallback implementation - should not be used in new code
  return {
    name: 'Free',
    product_id: null,
    price_id: null,
    credits_per_month: 10,
    allowed_resolutions: ['1K'],
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
 * @deprecated On server: use getTierNameByProductId() from @/lib/server/data/subscription-tiers
 * This function is kept for backward compatibility but will be removed
 */
export function getTierNameByProductId(productId: string | null): TierName {
  return 'free'
}

/**
 * Check if a resolution is available for a tier
 * @deprecated Use tier config from hook/cache instead
 */
export function canUseResolution(
  productId: string | null,
  resolution: Resolution
): boolean {
  // This should be called with tier config from hook/cache
  const tier = getTierByProductId(productId)
  return tier.allowed_resolutions.includes(resolution)
}

/**
 * Get the credit cost for a resolution
 * @deprecated Use useSubscriptionTiers().resolutionCredits on client or getResolutionCredits() on server
 */
export function getResolutionCost(resolution: Resolution): number {
  return RESOLUTION_CREDITS[resolution] || 1
}

/**
 * Check if a tier has access to AI title enhancement
 * @deprecated Use tier config from hook/cache instead
 */
export function canUseEnhance(productId: string | null): boolean {
  const tier = getTierByProductId(productId)
  return tier.has_enhance
}

/**
 * Check if a tier has watermarks applied
 * @deprecated Use tier config from hook/cache instead
 */
export function hasWatermark(productId: string | null): boolean {
  const tier = getTierByProductId(productId)
  return tier.has_watermark
}

/**
 * Check if user has enough credits for an action
 * @deprecated Use tier config from hook/cache instead
 */
export function hasEnoughCredits(
  creditsRemaining: number,
  resolution: Resolution
): boolean {
  return creditsRemaining >= (RESOLUTION_CREDITS[resolution] || 1)
}

/**
 * Get the maximum number of variations allowed for a tier
 * @deprecated Use tier config from hook/cache instead
 */
export function getMaxVariations(productId: string | null): number {
  const tier = getTierByProductId(productId)
  return tier.max_variations
}

/**
 * Check if a tier can create custom styles, palettes, and faces
 * @deprecated Use tier config from hook/cache instead
 */
export function canCreateCustomAssets(productId: string | null): boolean {
  const tier = getTierByProductId(productId)
  return tier.can_create_custom
}

/**
 * Get the minimum tier required for a specific number of variations
 */
export function getRequiredTierForVariations(variations: number): TierName {
  if (variations <= 1) return 'free'
  if (variations <= 2) return 'starter'
  if (variations <= 3) return 'advanced'
  return 'pro'
}

/**
 * Get the minimum tier required for a resolution
 */
export function getRequiredTierForResolution(resolution: Resolution): TierName {
  if (resolution === '1K') return 'free'
  if (resolution === '2K') return 'starter'
  return 'advanced' // 4K requires advanced or pro
}
