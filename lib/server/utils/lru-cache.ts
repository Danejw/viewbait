/**
 * LRU Cache Utilities for Cross-Request Caching
 * 
 * Provides LRU (Least Recently Used) cache for frequently accessed data
 * that persists across multiple requests. Useful for data that doesn't change
 * frequently but is accessed multiple times in quick succession.
 * 
 * Note: In serverless environments, this cache only persists within the same
 * function instance. For true cross-instance caching, consider Redis.
 */

import { LRUCache } from 'lru-cache'

// ============================================================================
// Cache Instances
// ============================================================================

/**
 * User profile cache
 * TTL: 5 minutes
 * Max entries: 1000
 */
export const userProfileCache = new LRUCache<string, any>({
  max: 1000,
  ttl: 5 * 60 * 1000, // 5 minutes
})

/**
 * YouTube playlist ID cache per user
 * TTL: 1 hour (playlist IDs rarely change)
 * Max entries: 500
 */
export const youtubePlaylistCache = new LRUCache<string, string>({
  max: 500,
  ttl: 60 * 60 * 1000, // 1 hour
})

/**
 * Subscription tier cache
 * TTL: 5 minutes
 * Max entries: 100
 */
export const subscriptionTierCache = new LRUCache<string, any>({
  max: 100,
  ttl: 5 * 60 * 1000, // 5 minutes
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generic cache helper that fetches data if not cached
 */
export async function getCached<T>(
  cache: LRUCache<string, T>,
  key: string,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = cache.get(key)
  if (cached !== undefined) {
    return cached
  }

  const data = await fetcher()
  cache.set(key, data)
  return data
}

/**
 * Clear all caches (useful for testing or manual invalidation)
 */
export function clearAllCaches(): void {
  userProfileCache.clear()
  youtubePlaylistCache.clear()
  subscriptionTierCache.clear()
}
