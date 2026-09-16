/**
 * Experiment variant persistence helpers.
 *
 * Variants are replaced in place so regeneration cannot wipe A/B/C rows
 * before a replacement exists.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type ExperimentVariantLabel = 'A' | 'B' | 'C'

export interface ExperimentVariantRecord {
  id: string
  experiment_id: string
  label: ExperimentVariantLabel
  title_text: string
  thumbnail_asset_url: string
  thumbnail_id: string | null
}

export interface ReplaceExperimentVariantInput {
  experimentId: string
  label: ExperimentVariantLabel
  titleText: string
  thumbnailAssetUrl: string
  thumbnailId: string | null
}

/**
 * Replace one experiment variant without deleting first.
 * Updates the existing (experiment_id, label) row when present; otherwise inserts.
 */
export async function replaceExperimentVariant(
  supabase: SupabaseClient,
  input: ReplaceExperimentVariantInput
): Promise<{ data: ExperimentVariantRecord | null; error: Error | null }> {
  const payload = {
    title_text: input.titleText,
    thumbnail_asset_url: input.thumbnailAssetUrl,
    thumbnail_id: input.thumbnailId,
  }

  const { data: updated, error: updateError } = await supabase
    .from('experiment_variants')
    .update(payload)
    .eq('experiment_id', input.experimentId)
    .eq('label', input.label)
    .select()
    .maybeSingle()

  if (updateError) {
    return { data: null, error: updateError as Error }
  }

  if (updated) {
    return { data: updated as ExperimentVariantRecord, error: null }
  }

  const { data: inserted, error: insertError } = await supabase
    .from('experiment_variants')
    .insert({
      experiment_id: input.experimentId,
      label: input.label,
      ...payload,
    })
    .select()
    .single()

  if (insertError || !inserted) {
    return {
      data: null,
      error: (insertError as Error) || new Error('Failed to create variant record'),
    }
  }

  return { data: inserted as ExperimentVariantRecord, error: null }
}
