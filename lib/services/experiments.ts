/**
 * Experiments Service
 * 
 * Client-side service functions for experiments API operations.
 */

export interface Experiment {
  id: string
  user_id: string
  channel_id: string
  video_id: string
  status: 'draft' | 'ready_for_studio' | 'running' | 'needs_import' | 'completed'
  started_at: string | null
  completed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  variants?: ExperimentVariant[]
  result?: ExperimentResult
}

export interface ExperimentVariant {
  id: string
  experiment_id: string
  label: 'A' | 'B' | 'C'
  title_text: string
  thumbnail_asset_url: string
  thumbnail_id: string | null
  created_at: string
}

export interface ExperimentResult {
  id: string
  experiment_id: string
  winner_variant_label: 'A' | 'B' | 'C'
  imported_at: string
  youtube_label: string | null
  watch_time_share_a: number | null
  watch_time_share_b: number | null
  watch_time_share_c: number | null
  created_at: string
}

export interface CreateExperimentRequest {
  video_id: string
  channel_id: string
  notes?: string
}

export interface GenerateVariantsRequest {
  title: string
  description?: string
  tags?: string[]
  emotion?: string
  pose?: string
  style?: string
  palette?: string
  resolution?: '1K' | '2K' | '4K'
  aspectRatio?: string
  referenceImages?: string[]
  faceImages?: string[]
  faceCharacters?: Array<{ images: string[] }>
  customStyle?: string
  thumbnailText?: string
}

/**
 * List experiments
 */
export async function listExperiments(params?: {
  limit?: number
  offset?: number
  status?: string
  video_id?: string
}): Promise<{ experiments: Experiment[]; count: number }> {
  const searchParams = new URLSearchParams()
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.offset) searchParams.set('offset', params.offset.toString())
  if (params?.status) searchParams.set('status', params.status)
  if (params?.video_id) searchParams.set('video_id', params.video_id)

  const response = await fetch(`/api/experiments?${searchParams.toString()}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch experiments')
  }
  return response.json()
}

/**
 * Get experiment by ID
 */
export async function getExperiment(id: string): Promise<{ experiment: Experiment }> {
  const response = await fetch(`/api/experiments/${id}`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch experiment')
  }
  return response.json()
}

/**
 * Create experiment
 */
export async function createExperiment(
  data: CreateExperimentRequest
): Promise<{ experiment: Experiment }> {
  const response = await fetch('/api/experiments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create experiment')
  }
  return response.json()
}

/**
 * Update experiment
 */
export async function updateExperiment(
  id: string,
  data: Partial<{
    status: Experiment['status']
    notes: string
    started_at: string | null
    completed_at: string | null
  }>
): Promise<{ experiment: Experiment }> {
  const response = await fetch(`/api/experiments/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update experiment')
  }
  return response.json()
}

/**
 * Delete experiment
 */
export async function deleteExperiment(id: string): Promise<void> {
  const response = await fetch(`/api/experiments/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete experiment')
  }
}

/**
 * Generate variants (all 3 at once - deprecated, use generateSingleVariant instead)
 */
export async function generateVariants(
  experimentId: string,
  data: GenerateVariantsRequest
): Promise<{ variants: ExperimentVariant[]; count: number }> {
  const response = await fetch(`/api/experiments/${experimentId}/variants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate variants')
  }
  return response.json()
}

/**
 * Generate a single variant (A, B, or C)
 */
export async function generateSingleVariant(
  experimentId: string,
  label: 'A' | 'B' | 'C',
  data: GenerateVariantsRequest
): Promise<{ variant: ExperimentVariant }> {
  const response = await fetch(`/api/experiments/${experimentId}/variants/${label}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to generate variant')
  }
  return response.json()
}

/**
 * Update variant
 */
export async function updateVariant(
  experimentId: string,
  label: 'A' | 'B' | 'C',
  data: Partial<{
    title_text: string
    thumbnail_asset_url: string
    thumbnail_id: string | null
  }>
): Promise<{ variant: ExperimentVariant }> {
  const response = await fetch(`/api/experiments/${experimentId}/variants`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, label }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update variant')
  }
  return response.json()
}

/**
 * Mark experiment as started
 */
export async function markExperimentStarted(experimentId: string): Promise<{ experiment: Experiment }> {
  const response = await fetch(`/api/experiments/${experimentId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'mark_started' }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to mark experiment as started')
  }
  return response.json()
}

/**
 * Import result
 */
export async function importResult(
  experimentId: string,
  data: {
    winner_variant_label: 'A' | 'B' | 'C'
    youtube_label?: string
    watch_time_share_a?: number
    watch_time_share_b?: number
    watch_time_share_c?: number
  }
): Promise<{ experiment: Experiment }> {
  const response = await fetch(`/api/experiments/${experimentId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'import_result', ...data }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to import result')
  }
  return response.json()
}

/**
 * Update experiment status
 */
export async function updateExperimentStatus(
  experimentId: string,
  status: Experiment['status']
): Promise<{ experiment: Experiment }> {
  const response = await fetch(`/api/experiments/${experimentId}/actions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update_status', status }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update experiment status')
  }
  return response.json()
}

/**
 * Download variant pack
 */
export async function downloadVariantPack(experimentId: string): Promise<{
  experiment_id: string
  video_id: string
  variants: Array<{
    label: string
    filename: string
    data: string
    mimeType: string
  }>
}> {
  const response = await fetch(`/api/experiments/${experimentId}/download-pack`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to download variant pack')
  }
  return response.json()
}

/**
 * Get experiment analytics
 */
export async function getExperimentAnalytics(experimentId: string): Promise<{
  before: Array<{
    day: string
    views: number
    estimatedMinutesWatched: number
    averageViewDuration: number
    likes: number
    subscribersGained: number
  }>
  during: Array<{
    day: string
    views: number
    estimatedMinutesWatched: number
    averageViewDuration: number
    likes: number
    subscribersGained: number
  }>
  after: Array<{
    day: string
    views: number
    estimatedMinutesWatched: number
    averageViewDuration: number
    likes: number
    subscribersGained: number
  }>
  deltas: {
    before: { totalViews: number; totalMinutes: number; avgMinutesPerView: number }
    during: { totalViews: number; totalMinutes: number; avgMinutesPerView: number }
    after: { totalViews: number; totalMinutes: number; avgMinutesPerView: number }
  }
}> {
  const response = await fetch(`/api/experiments/${experimentId}/analytics`)
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to fetch experiment analytics')
  }
  return response.json()
}

/**
 * Sync analytics
 */
export async function syncAnalytics(videoIds?: string[]): Promise<{
  success: boolean
  message: string
  results: Array<{ videoId: string; synced: boolean; snapshotsCount?: number; error?: string }>
  synced: number
  total: number
}> {
  const response = await fetch('/api/experiments/sync-analytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_ids: videoIds }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to sync analytics')
  }
  return response.json()
}
