/**
 * Subscription Tiers Server-Side Data Layer
 * 
 * Provides in-memory caching for subscription tier configuration from database.
 * This replaces hard-coded constants and enables runtime updates without rebuilds.
 */

import { cache } from 'react'
import { createServiceClient } from '@/lib/supabase/service'
import type { SubscriptionTier, SubscriptionSetting } from '@/lib/types/database'
import type { TierConfig, TierName, Resolution } from '@/lib/constants/subscription-tiers'
import { logError } from '@/lib/server/utils/logger'

// ============================================================================
// Cache Configuration
// ============================================================================

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const CACHE_FAILURE_TTL_MS = 30 * 1000 // 30 seconds for failures

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

// In-memory cache
let tiersCache: CacheEntry<Map<string, TierConfig>> | null = null
let settingsCache: CacheEntry<Map<string, number>> | null = null

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Detect Stripe mode from environment variable
 */
function getStripeMode(): 'test' | 'live' {
  const secretKey = process.env.STRIPE_SECRET_KEY || ''
  return secretKey.startsWith('sk_test_') ? 'test' : 'live'
}

/**
 * Get mode-aware product ID from tier
 * Handles both old schema (product_id) and new schema (test_product_id/live_product_id)
 */
function getModeAwareProductId(tier: SubscriptionTier): string | null {
  // Check if new schema columns exist (migration 038 applied)
  if ('test_product_id' in tier || 'live_product_id' in tier) {
    const mode = getStripeMode()
    return mode === 'test' ? tier.test_product_id : tier.live_product_id
  }
  
  // Fallback to old schema (migration 038 not applied yet)
  // @ts-expect-error - product_id may exist in old schema
  return tier.product_id || null
}

/**
 * Get mode-aware price ID from tier
 * Handles both old schema (price_id) and new schema (test_price_id/live_price_id)
 */
function getModeAwarePriceId(tier: SubscriptionTier): string | null {
  // Check if new schema columns exist (migration 038 applied)
  if ('test_price_id' in tier || 'live_price_id' in tier) {
    const mode = getStripeMode()
    return mode === 'test' ? tier.test_price_id : tier.live_price_id
  }
  
  // Fallback to old schema (migration 038 not applied yet)
  // @ts-expect-error - price_id may exist in old schema
  return tier.price_id || null
}

/**
 * Convert database SubscriptionTier to TierConfig format
 * Uses mode-aware ID selection based on STRIPE_SECRET_KEY
 */
function dbTierToTierConfig(tier: SubscriptionTier | any): TierConfig {
  const productId = getModeAwareProductId(tier as SubscriptionTier)
  const priceId = getModeAwarePriceId(tier as SubscriptionTier)

  
  return {
    name: tier.name,
    product_id: productId,
    price_id: priceId,
    credits_per_month: tier.credits_per_month,
    allowed_resolutions: tier.allowed_resolutions as Resolution[],
    has_watermark: tier.has_watermark,
    has_enhance: tier.has_enhance,
    persistent_storage: tier.persistent_storage,
    storage_retention_days: tier.storage_retention_days,
    priority_generation: tier.priority_generation,
    early_access: tier.early_access,
    price: Number(tier.price),
    max_variations: tier.max_variations,
    can_create_custom: tier.can_create_custom,
  }
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid<T>(entry: CacheEntry<T> | null): boolean {
  if (!entry) return false
  return Date.now() < entry.expiresAt
}

// ============================================================================
// Tier Functions
// ============================================================================

/**
 * Fetch all tiers from database
 */
async function fetchTiersFromDB(): Promise<Map<string, TierConfig>> {
  const supabaseService = createServiceClient()
  
  const { data: tiers, error } = await supabaseService
    .from('subscription_tiers')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (error) {
    logError(error, {
      operation: 'fetch-tiers-from-db',
      route: 'subscription-tiers-cache',
    })
    throw error
  }

  if (!tiers || tiers.length === 0) {
    // Fallback to free tier if no tiers found
    const freeTier: TierConfig = {
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
    const map = new Map<string, TierConfig>()
    map.set('free', freeTier)
    return map
  }

  const tierMap = new Map<string, TierConfig>()
  for (const tier of tiers) {
    tierMap.set(tier.tier_name, dbTierToTierConfig(tier))
  }

  return tierMap
}

/**
 * Get tiers from cache or fetch from database
 */
async function getTiersFromCache(): Promise<Map<string, TierConfig>> {
  // Check if cache is valid
  if (isCacheValid(tiersCache)) {
    return tiersCache!.data
  }

  try {
    // Fetch from database
    const tiers = await fetchTiersFromDB()
    
    // Update cache
    tiersCache = {
      data: tiers,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }

    return tiers
  } catch (error) {
    // If we have stale cache, use it as fallback
    if (tiersCache) {
      logError(error as Error, {
        operation: 'get-tiers-from-cache-fallback',
        route: 'subscription-tiers-cache',
      })
      return tiersCache.data
    }

    // No cache available, return free tier as fallback
    logError(error as Error, {
      operation: 'get-tiers-from-cache-error',
      route: 'subscription-tiers-cache',
    })
    
    const freeTier: TierConfig = {
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
    const map = new Map<string, TierConfig>()
    map.set('free', freeTier)
    
    // Cache the fallback for a short time to avoid DB spam
    tiersCache = {
      data: map,
      expiresAt: Date.now() + CACHE_FAILURE_TTL_MS,
    }
    
    return map
  }
}

/**
 * Get tier configuration by Stripe product ID
 * Searches using mode-aware product IDs (test or live based on STRIPE_SECRET_KEY)
 */
export async function getTierByProductId(productId: string | null): Promise<TierConfig> {
  if (!productId) {
    const tiers = await getTiersFromCache()
    return tiers.get('free') || {
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

  const tiers = await getTiersFromCache()
  
  // Find tier by product_id (which is already mode-aware from dbTierToTierConfig)
  for (const [, config] of tiers) {
    if (config.product_id === productId) {
      return config
    }
  }
  
  // If not found in cache, fetch from DB and search by mode-aware IDs
  const supabaseService = createServiceClient()
  const mode = getStripeMode()
  const productIdColumn = mode === 'test' ? 'test_product_id' : 'live_product_id'
  
  const { data: tier, error } = await supabaseService
    .from('subscription_tiers')
    .select('*')
    .eq(productIdColumn, productId)
    .eq('is_active', true)
    .single()
  
  if (error || !tier) {
    // Fallback to free tier
    return tiers.get('free') || {
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
  
  return dbTierToTierConfig(tier)
}

/**
 * Get tier configuration by tier name
 * Wrapped with React.cache() for per-request deduplication
 */
export const getTierByName = cache(async (tierName: TierName): Promise<TierConfig> => {
  const tiers = await getTiersFromCache()
  return tiers.get(tierName) || tiers.get('free') || {
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
})

/**
 * Get tier name by Stripe product ID
 * Uses mode-aware product ID lookup
 */
export async function getTierNameByProductId(productId: string | null): Promise<TierName> {
  if (!productId) return 'free'

  const tiers = await getTiersFromCache()
  
  // Find tier by product_id (which is already mode-aware from dbTierToTierConfig)
  for (const [tierName, config] of tiers) {
    if (config.product_id === productId) {
      return tierName as TierName
    }
  }

  // If not found in cache, use getTierByProductId which handles mode-aware lookup
  const tier = await getTierByProductId(productId)
  return tier.name.toLowerCase() as TierName
}

/**
 * Get all active tiers as Record<TierName, TierConfig>
 * Wrapped with React.cache() for per-request deduplication
 */
export const getAllTiers = cache(async (): Promise<Record<TierName, TierConfig>> => {
  const tiers = await getTiersFromCache()
  
  // Convert Map to Record
  const result: Partial<Record<TierName, TierConfig>> = {}
  for (const [tierName, config] of tiers) {
    result[tierName as TierName] = config
  }

  // Ensure free tier exists
  if (!result.free) {
    result.free = {
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

  return result as Record<TierName, TierConfig>
})

/**
 * Invalidate tiers cache (for future admin updates)
 */
export function invalidateTiersCache(): void {
  tiersCache = null
}

// ============================================================================
// Settings Functions
// ============================================================================

/**
 * Fetch settings from database
 */
async function fetchSettingsFromDB(): Promise<Map<string, number>> {
  const supabaseService = createServiceClient()
  
  const { data: settings, error } = await supabaseService
    .from('subscription_settings')
    .select('*')

  if (error) {
    logError(error, {
      operation: 'fetch-settings-from-db',
      route: 'subscription-tiers-cache',
    })
    throw error
  }

  const settingsMap = new Map<string, number>()
  
  if (settings) {
    for (const setting of settings) {
      const value = parseInt(setting.value, 10)
      if (!isNaN(value)) {
        settingsMap.set(setting.key, value)
      }
    }
  }

  // Set defaults if missing
  if (!settingsMap.has('resolution_credits_1k')) {
    settingsMap.set('resolution_credits_1k', 1)
  }
  if (!settingsMap.has('resolution_credits_2k')) {
    settingsMap.set('resolution_credits_2k', 2)
  }
  if (!settingsMap.has('resolution_credits_4k')) {
    settingsMap.set('resolution_credits_4k', 4)
  }
  if (!settingsMap.has('edit_credit_cost')) {
    settingsMap.set('edit_credit_cost', 2)
  }

  return settingsMap
}

/**
 * Get settings from cache or fetch from database
 */
async function getSettingsFromCache(): Promise<Map<string, number>> {
  // Check if cache is valid
  if (isCacheValid(settingsCache)) {
    return settingsCache!.data
  }

  try {
    // Fetch from database
    const settings = await fetchSettingsFromDB()
    
    // Update cache
    settingsCache = {
      data: settings,
      expiresAt: Date.now() + CACHE_TTL_MS,
    }

    return settings
  } catch (error) {
    // If we have stale cache, use it as fallback
    if (settingsCache) {
      logError(error as Error, {
        operation: 'get-settings-from-cache-fallback',
        route: 'subscription-tiers-cache',
      })
      return settingsCache.data
    }

    // No cache available, return defaults
    logError(error as Error, {
      operation: 'get-settings-from-cache-error',
      route: 'subscription-tiers-cache',
    })
    
    const defaults = new Map<string, number>()
    defaults.set('resolution_credits_1k', 1)
    defaults.set('resolution_credits_2k', 2)
    defaults.set('resolution_credits_4k', 4)
    defaults.set('edit_credit_cost', 2)
    
    // Cache the defaults for a short time to avoid DB spam
    settingsCache = {
      data: defaults,
      expiresAt: Date.now() + CACHE_FAILURE_TTL_MS,
    }
    
    return defaults
  }
}

/**
 * Get resolution credits mapping
 */
export async function getResolutionCredits(): Promise<Record<Resolution, number>> {
  const settings = await getSettingsFromCache()
  
  return {
    '1K': settings.get('resolution_credits_1k') || 1,
    '2K': settings.get('resolution_credits_2k') || 2,
    '4K': settings.get('resolution_credits_4k') || 4,
  }
}

/**
 * Get edit credit cost
 */
export async function getEditCreditCost(): Promise<number> {
  const settings = await getSettingsFromCache()
  return settings.get('edit_credit_cost') || 2
}

/**
 * Invalidate settings cache
 */
export function invalidateSettingsCache(): void {
  settingsCache = null
}
