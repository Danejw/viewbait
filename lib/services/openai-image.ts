/**
 * OpenAI Images API (GPT Image models).
 * @see https://developers.openai.com/api/reference/resources/images
 */

import { OPENAI_IMAGE_MODEL_ID } from '@/lib/constants/image-models'
import {
  fetchImageAsBase64,
  getResolutionDimensions,
  type GenerateThumbnailResult,
} from '@/lib/utils/ai-helpers'
import { sanitizeApiErrorResponse } from '@/lib/utils/error-sanitizer'
import { logError } from '@/lib/server/utils/logger'
import { retryWithBackoff, TimeoutError } from '@/lib/utils/retry-with-backoff'

const OPENAI_API_BASE = 'https://api.openai.com/v1'
const MAX_OPENAI_EDGE = 3840
const MAX_OPENAI_EDGE_ALT = 2160
const MIN_OPENAI_PIXELS = 655_360
const MAX_OPENAI_PIXELS = 8_294_400
const MIN_ASPECT = 1 / 3
const MAX_ASPECT = 3

export type OpenAIImageQuality = 'low' | 'medium' | 'high' | 'auto'

function roundTo16(value: number): number {
  return Math.max(16, Math.round(value / 16) * 16)
}

function roundUpTo16(value: number): number {
  return Math.max(16, Math.ceil(value / 16) * 16)
}

function roundDownTo16(value: number): number {
  return Math.max(16, Math.floor(value / 16) * 16)
}

function clampAspectAndMaxEdges(w: number, h: number): { w: number; h: number } {
  let width = w
  let height = h
  const ratio = width / height
  if (ratio > MAX_ASPECT) {
    width = roundDownTo16(height * MAX_ASPECT)
  } else if (ratio < MIN_ASPECT) {
    height = roundDownTo16(width / MIN_ASPECT)
  }
  if (width > MAX_OPENAI_EDGE || height > MAX_OPENAI_EDGE_ALT) {
    const scale = Math.min(MAX_OPENAI_EDGE / width, MAX_OPENAI_EDGE_ALT / height)
    width = roundDownTo16(width * scale)
    height = roundDownTo16(height * scale)
  }
  return { w: width, h: height }
}

/**
 * Snap dimensions for gpt-image-2: divisible by 16, aspect 1:3–3:1, pixel budget 655360–8294400, max 3840×2160.
 * @see https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide
 */
export function snapOpenAISize(
  width: number,
  height: number
): { width: number; height: number; size: string } {
  let w = roundTo16(width)
  let h = roundTo16(height)
  ;({ w, h } = clampAspectAndMaxEdges(w, h))

  if (w * h < MIN_OPENAI_PIXELS) {
    const scale = Math.sqrt(MIN_OPENAI_PIXELS / (w * h))
    w = roundUpTo16(w * scale)
    h = roundUpTo16(h * scale)
    while (w * h < MIN_OPENAI_PIXELS) {
      if (w <= h) w += 16
      else h += 16
    }
    ;({ w, h } = clampAspectAndMaxEdges(w, h))
  }

  if (w * h > MAX_OPENAI_PIXELS) {
    const scale = Math.sqrt(MAX_OPENAI_PIXELS / (w * h))
    w = roundDownTo16(w * scale)
    h = roundDownTo16(h * scale)
    ;({ w, h } = clampAspectAndMaxEdges(w, h))
  }

  return { width: w, height: h, size: `${w}x${h}` }
}

export function resolutionToOpenAISize(
  resolution: '1K' | '2K' | '4K',
  aspectRatio: string
): string {
  const { width, height } = getResolutionDimensions(resolution, aspectRatio)
  return snapOpenAISize(width, height).size
}

export function mapResolutionToQuality(
  resolution: '1K' | '2K' | '4K'
): OpenAIImageQuality {
  if (resolution === '1K') return 'medium'
  return 'high'
}

function getOpenAIApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }
  return apiKey
}

function base64ToBlob(data: string, mimeType: string): Blob {
  const buffer = Buffer.from(data, 'base64')
  return new Blob([buffer], { type: mimeType })
}

function mimeToExtension(mimeType: string): string {
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg'
  if (mimeType.includes('webp')) return 'webp'
  return 'png'
}

interface OpenAIImagesResponse {
  data?: Array<{ b64_json?: string; url?: string }>
  error?: { message?: string }
}

function parseOpenAIImagesResponse(data: OpenAIImagesResponse): GenerateThumbnailResult {
  const b64 = data.data?.[0]?.b64_json
  if (b64) {
    return { imageData: b64, mimeType: 'image/png' }
  }
  throw new Error('No image data found in OpenAI API response')
}

async function openAIImagesRequest(
  path: string,
  init: RequestInit,
  operation: string
): Promise<GenerateThumbnailResult> {
  const apiKey = getOpenAIApiKey()
  const url = `${OPENAI_API_BASE}${path}`

  try {
    const response = await retryWithBackoff(() =>
      fetch(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...init.headers,
        },
      })
    )

    if (!response.ok) {
      const errorText = await response.text()
      const sanitizedError = sanitizeApiErrorResponse(errorText)
      logError(new Error(`OpenAI API error: ${response.status} - ${sanitizedError}`), {
        operation,
        route: 'openai-image',
        statusCode: response.status,
      })
      if (response.status === 503) {
        throw new Error(
          'Image service is temporarily unavailable. Please try again in a few minutes.'
        )
      }
      if (response.status === 429) {
        throw new Error('AI service is busy. Please try again in a moment.')
      }
      throw new Error(`OpenAI API error: ${response.status} - ${sanitizedError}`)
    }

    const data = (await response.json()) as OpenAIImagesResponse
    return parseOpenAIImagesResponse(data)
  } catch (error) {
    if (error instanceof TimeoutError) {
      logError(error, { operation, route: 'openai-image', errorType: 'timeout' })
      throw error
    }
    logError(error, { operation, route: 'openai-image' })
    throw error
  }
}

async function loadImagesFromUrls(urls: string[]): Promise<Array<{ data: string; mimeType: string }>> {
  const loaded: Array<{ data: string; mimeType: string }> = []
  for (const url of urls) {
    const img = await fetchImageAsBase64(url)
    if (img) loaded.push(img)
  }
  return loaded
}

/**
 * POST /images/edits with multipart form (reference + optional face images).
 */
async function callOpenAIImageEditsMultipart(
  prompt: string,
  images: Array<{ data: string; mimeType: string }>,
  size: string,
  quality: OpenAIImageQuality,
  model: string = OPENAI_IMAGE_MODEL_ID
): Promise<GenerateThumbnailResult> {
  const form = new FormData()
  form.append('model', model)
  form.append('prompt', prompt)
  form.append('size', size)
  form.append('quality', quality)
  form.append('n', '1')
  form.append('output_format', 'png')

  images.forEach((img, index) => {
    const ext = mimeToExtension(img.mimeType)
    const blob = base64ToBlob(img.data, img.mimeType)
    form.append('image[]', blob, `input-${index}.${ext}`)
  })

  return openAIImagesRequest('/images/edits', { method: 'POST', body: form }, 'openai-image-edits')
}

/**
 * Generate a thumbnail via OpenAI (generations or edits when references exist).
 */
export async function callOpenAIImageGeneration(
  prompt: string,
  referenceImages: string[],
  faceImages: string[],
  resolution: '1K' | '2K' | '4K',
  aspectRatio: string,
  model: string = OPENAI_IMAGE_MODEL_ID
): Promise<GenerateThumbnailResult> {
  const size = resolutionToOpenAISize(resolution, aspectRatio)
  const quality = mapResolutionToQuality(resolution)

  const allUrls = [...referenceImages, ...faceImages]
  if (allUrls.length > 0) {
    const images = await loadImagesFromUrls(allUrls)
    if (images.length === 0) {
      throw new Error('Failed to load reference images for OpenAI image edit')
    }
    return callOpenAIImageEditsMultipart(prompt, images, size, quality, model)
  }

  return openAIImagesRequest(
    '/images/generations',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        n: 1,
        size,
        quality,
        output_format: 'png',
      }),
    },
    'openai-image-generations'
  )
}

/**
 * Edit a thumbnail via OpenAI Images edits API.
 */
export async function callOpenAIImageEdit(
  editPrompt: string,
  originalImage: { data: string; mimeType: string },
  referenceImages: Array<{ data: string; mimeType: string }> | undefined,
  resolution: '1K' | '2K' | '4K',
  aspectRatio: string,
  model: string = OPENAI_IMAGE_MODEL_ID
): Promise<GenerateThumbnailResult> {
  const size = resolutionToOpenAISize(resolution, aspectRatio)
  const quality = mapResolutionToQuality(resolution)
  const images = [originalImage, ...(referenceImages ?? [])]
  return callOpenAIImageEditsMultipart(editPrompt, images, size, quality, model)
}
