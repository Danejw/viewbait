/**
 * Client-side service for thumbnail attention heatmap generation.
 * Calls the Next.js API route that uses Gemini to produce a heatmap image.
 */

export interface ThumbnailHeatmapParams {
  /** Client-fetched base64 image (exact image displayed). When set, preferred over imageUrl/thumbnailId. */
  imageData?: string
  mimeType?: string
  imageUrl?: string
  thumbnailId?: string
}

export interface ThumbnailHeatmapResult {
  dataUrl: string
}

/**
 * Request a heatmap for a thumbnail. Returns a data URL for the heatmap image
 * suitable for use as img src or overlay. Fails with an error if the API
 * returns non-OK (e.g. 403 for tier, 5xx).
 * When imageData + mimeType are provided, the API uses that exact image (best alignment with overlay).
 */
export async function generateThumbnailHeatmap(
  params: ThumbnailHeatmapParams
): Promise<ThumbnailHeatmapResult> {
  const { imageData, mimeType, imageUrl, thumbnailId } = params
  const hasClientImage = imageData && mimeType
  const hasUrlOrId = imageUrl || thumbnailId
  if (!hasClientImage && !hasUrlOrId) {
    throw new Error('Either (imageData + mimeType) or imageUrl or thumbnailId is required')
  }

  const body: Record<string, unknown> = {}
  if (imageData) body.imageData = imageData
  if (mimeType) body.mimeType = mimeType
  if (thumbnailId) body.thumbnailId = thumbnailId
  if (imageUrl && !hasClientImage) body.imageUrl = imageUrl

  const response = await fetch('/api/thumbnails/heatmap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Failed to generate heatmap'
    )
  }

  const heatmapImageData = data.imageData as string | undefined
  const heatmapMimeType = (data.mimeType as string) || 'image/png'
  if (!heatmapImageData) {
    throw new Error('No image data in heatmap response')
  }

  const dataUrl = `data:${heatmapMimeType};base64,${heatmapImageData}`
  return { dataUrl }
}
