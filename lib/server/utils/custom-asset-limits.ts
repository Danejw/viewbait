/**
 * Custom asset count helpers for free-tier allowance
 *
 * Used by API routes to allow "first face" / "first style" / "first palette"
 * for free tier. Generate route uses counts to allow custom assets when
 * within free limit.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  FREE_TIER_MAX_CUSTOM_FACES,
  FREE_TIER_MAX_CUSTOM_PALETTES,
  FREE_TIER_MAX_CUSTOM_STYLES,
} from '@/lib/constants/free-tier-limits'

export interface CustomAssetCounts {
  faceCount: number
  styleCount: number
  paletteCount: number
}

/**
 * Get count of user's faces, user-created (non-default) styles, and palettes.
 * Used to enforce free-tier "one face, one style, one palette" allowance.
 */
export async function getCustomAssetCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomAssetCounts> {
  const [facesResult, stylesResult, palettesResult] = await Promise.all([
    supabase
      .from('faces')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('styles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_default', false),
    supabase
      .from('palettes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_default', false),
  ])
  return {
    faceCount: facesResult.count ?? 0,
    styleCount: stylesResult.count ?? 0,
    paletteCount: palettesResult.count ?? 0,
  }
}

/**
 * Returns true if a free-tier user can create one more face (within limit).
 */
export function canCreateFaceWithinFreeTier(counts: CustomAssetCounts): boolean {
  return counts.faceCount < FREE_TIER_MAX_CUSTOM_FACES
}

/**
 * Returns true if a free-tier user can create one more style (within limit).
 */
export function canCreateStyleWithinFreeTier(counts: CustomAssetCounts): boolean {
  return counts.styleCount < FREE_TIER_MAX_CUSTOM_STYLES
}

/**
 * Returns true if a free-tier user can create one more palette (within limit).
 */
export function canCreatePaletteWithinFreeTier(counts: CustomAssetCounts): boolean {
  return counts.paletteCount < FREE_TIER_MAX_CUSTOM_PALETTES
}

/**
 * Returns true if a free-tier user is allowed to have faces (for upload: face already exists, so check <= limit).
 */
export function canHaveFaceWithinFreeTier(counts: CustomAssetCounts): boolean {
  return counts.faceCount <= FREE_TIER_MAX_CUSTOM_FACES
}
