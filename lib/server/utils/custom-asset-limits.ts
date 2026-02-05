/**
 * Custom asset count helpers for free-tier allowance
 *
 * Used by API routes to allow "first face" / "first style" for free tier
 * without changing tier config. Generate route uses counts to allow
 * custom assets when both face and style count are within free limit.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface CustomAssetCounts {
  faceCount: number
  styleCount: number
}

/**
 * Get count of user's faces and user-created (non-default) styles.
 * Used to enforce free-tier "one face, one style" allowance.
 */
export async function getCustomAssetCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<CustomAssetCounts> {
  const [facesResult, stylesResult] = await Promise.all([
    supabase
      .from('faces')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('styles')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_default', false),
  ])
  return {
    faceCount: facesResult.count ?? 0,
    styleCount: stylesResult.count ?? 0,
  }
}
