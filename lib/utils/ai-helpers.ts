/**
 * AI Helper Utilities
 * 
 * Non-sensitive utility functions for AI operations.
 * Emotion/pose mappings and helper functions.
 */

import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { logError } from '@/lib/server/utils/logger'

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const IMAGE_FETCH_TIMEOUT_MS = 15_000
const MAX_IMAGE_REDIRECTS = 3
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
const TRUSTED_IMAGE_HOSTS = new Set(['i.ytimg.com', 'img.youtube.com'])

// Emotion mappings - not sensitive, used for transforming user input
export const EMOTION_DESCRIPTIONS: Record<string, string> = {
  excited: 'extremely excited and enthusiastic facial expression with wide eyes',
  thinking: 'thoughtful thinking expression with hand on chin or contemplative look',
  shocked: 'shocked and surprised expression with mouth open and wide eyes',
  fire: 'intense fired-up expression, hyped and energetic',
  cool: 'cool and confident expression with a slight smirk',
  'mind-blown': 'mind blown expression with wide eyes and amazed look',
  happy: 'genuinely happy and joyful expression with a big smile',
  serious: 'serious and focused expression with intense eyes',
  angry: 'angry and frustrated expression with furrowed brows',
  curious: 'curious and intrigued expression with raised eyebrow',
  sad: 'sad and emotional expression',
  confident: 'cool and confident expression with a slight smirk',
  neutral: 'neutral expression',
  confused: 'confused and puzzled expression with furrowed brows',
  surprised: 'surprised expression with raised eyebrows and open mouth',
  worried: 'worried and anxious expression with tense facial features',
  determined: 'determined and resolute expression with focused eyes',
  playful: 'playful and mischievous expression with a grin',
  smirk: 'smirking expression with a knowing smile and slightly raised corner of mouth',
  skeptical: 'skeptical and doubtful expression with raised eyebrow',
  relieved: 'relieved and relaxed expression with a gentle smile',
  intense: 'intense and focused expression with piercing eyes',
  friendly: 'friendly and warm expression with a welcoming smile',
  dramatic: 'dramatic and expressive facial expression',
  calm: 'calm and peaceful expression with relaxed features',
}

// Pose mappings - not sensitive, used for transforming user input
export const POSE_DESCRIPTIONS: Record<string, string> = {
  pointing: 'pointing at something with hand extended',
  'thumbs-up': 'giving a thumbs up gesture',
  'arms-crossed': 'arms crossed confidently',
  'hands-on-hips': 'hands on hips in a confident stance',
  'leaning-in': 'leaning forward towards camera',
  'looking-away': 'looking away to the side dramatically',
  'hands-up': 'hands raised up in the air',
  thoughtful: 'hand on chin in a thinking pose',
  thinking: 'hand on chin in a thinking pose',
  shrugging: 'shrugging with palms up',
  facepalm: 'hand on face in a facepalm gesture',
  celebration: 'arms raised in celebration',
  praying: 'hands pressed together in prayer position',
  'peace-sign': 'making a peace sign with fingers',
  flexing: 'flexing muscles in a strong pose',
  'waving': 'waving hand in greeting',
  'clapping': 'clapping hands together',
  'saluting': 'hand raised in a salute gesture',
  'heart-hands': 'hands forming a heart shape',
  'rock-on': 'rock and roll hand gesture with index and pinky extended',
  'fist-pump': 'fist raised in the air in victory',
  'open-arms': 'arms spread wide in welcoming gesture',
  'hands-behind-head': 'hands behind head in relaxed pose',
  'leaning-back': 'leaning back in relaxed position',
  'forward-lean': 'leaning forward with hands on knees',
  'side-profile': 'turned to the side showing profile',
  'over-shoulder': 'looking back over shoulder',
  none: '',
}

/**
 * Normalize emotion key for lookup (e.g. "Mind blown" -> "mind-blown", "Happy" -> "happy")
 */
function normalizeEmotionKey(emotion: string): string {
  return emotion.toLowerCase().trim().replace(/\s+/g, '-')
}

/**
 * Get emotion description from key
 */
export function getEmotionDescription(emotion?: string): string {
  if (!emotion) return ''
  const key = normalizeEmotionKey(emotion)
  return EMOTION_DESCRIPTIONS[key] ?? EMOTION_DESCRIPTIONS[emotion] ?? emotion
}

/**
 * Get pose description from key
 */
export function getPoseDescription(pose?: string): string {
  if (!pose || pose === 'none') return ''
  return POSE_DESCRIPTIONS[pose] || pose
}

/**
 * Get resolution dimensions from resolution string
 */
export function getResolutionDimensions(resolution: '1K' | '2K' | '4K', aspectRatio: string): { width: number; height: number } {
  const [widthRatio, heightRatio] = aspectRatio.split(':').map(Number)
  const ratio = widthRatio / heightRatio

  const baseHeights: Record<'1K' | '2K' | '4K', number> = {
    '1K': 576,
    '2K': 1152,
    '4K': 2304,
  }

  const height = baseHeights[resolution]
  const width = Math.round(height * ratio)

  return { width, height }
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '')
}

function getSupabaseStorageHost(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return null

  try {
    return normalizeHostname(new URL(supabaseUrl).hostname)
  } catch {
    return null
  }
}

function isTrustedImageHost(hostname: string): boolean {
  if (TRUSTED_IMAGE_HOSTS.has(hostname)) return true

  const supabaseHost = getSupabaseStorageHost()
  return !!supabaseHost && (hostname === supabaseHost || hostname.endsWith(`.${supabaseHost}`))
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }

  const [first, second] = parts
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  )
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase()
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  )
}

function isPrivateIpAddress(address: string): boolean {
  if (address.toLowerCase().startsWith('::ffff:')) {
    return isPrivateIpAddress(address.slice(7))
  }

  const version = isIP(address)
  if (version === 4) return isPrivateIpv4(address)
  if (version === 6) return isPrivateIpv6(address)
  return true
}

async function isPublicHttpUrl(url: URL): Promise<boolean> {
  if (url.protocol !== 'https:') return false

  const hostname = normalizeHostname(url.hostname)
  if (!hostname) return false
  if (!isTrustedImageHost(hostname)) return false

  if (isIP(hostname)) {
    return !isPrivateIpAddress(hostname)
  }

  const addresses = await lookup(hostname, { all: true })
  return addresses.length > 0 && addresses.every((entry) => !isPrivateIpAddress(entry.address))
}

async function fetchSafeImageUrl(url: URL, redirectsRemaining: number): Promise<Response | null> {
  if (!(await isPublicHttpUrl(url))) {
    return null
  }

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'ViewBait-AI-Image-Fetch/1' },
    redirect: 'manual',
    signal: AbortSignal.timeout(IMAGE_FETCH_TIMEOUT_MS),
  })

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location')
    if (!location || redirectsRemaining <= 0) {
      return null
    }
    return fetchSafeImageUrl(new URL(location, url), redirectsRemaining - 1)
  }

  return response
}

/**
 * Fetch image from URL and convert to base64
 * Handles both regular URLs and data URLs (base64 encoded images)
 */
export async function fetchImageAsBase64(imageUrl: string): Promise<{ data: string; mimeType: string } | null> {
  try {
    // Handle data URLs (base64 encoded images from client)
    if (imageUrl.startsWith('data:image/')) {
      const [header, base64Data] = imageUrl.split(',')
      if (!base64Data) {
        logError(new Error('Invalid data URL format'), {
          operation: 'fetch-image-as-base64',
          route: 'ai-helpers',
        })
        return null
      }
      
      // Extract mime type from data URL header (e.g., "data:image/png;base64")
      const mimeTypeMatch = header.match(/data:image\/([^;]+)/)
      const mimeType = mimeTypeMatch ? `image/${mimeTypeMatch[1]}` : 'image/png'
      
      return { data: base64Data, mimeType }
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(imageUrl)
    } catch {
      logError(new Error('Invalid image URL'), {
        operation: 'fetch-image-as-base64',
        route: 'ai-helpers',
      })
      return null
    }

    // Handle regular URLs
    const response = await fetchSafeImageUrl(parsedUrl, MAX_IMAGE_REDIRECTS)
    if (!response) {
      logError(new Error('Image URL is not allowed'), {
        operation: 'fetch-image-as-base64',
        route: 'ai-helpers',
      })
      return null
    }

    if (!response.ok) {
      logError(new Error(`Failed to fetch image: ${response.statusText}`), {
        operation: 'fetch-image-as-base64',
        route: 'ai-helpers',
        statusCode: response.status,
      })
      return null
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() || ''
    if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
      logError(new Error('Fetched URL did not return a supported image type'), {
        operation: 'fetch-image-as-base64',
        route: 'ai-helpers',
      })
      return null
    }

    const contentLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_SIZE_BYTES) {
      logError(new Error('Fetched image exceeds size limit'), {
        operation: 'fetch-image-as-base64',
        route: 'ai-helpers',
      })
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      logError(new Error('Fetched image exceeds size limit'), {
        operation: 'fetch-image-as-base64',
        route: 'ai-helpers',
      })
      return null
    }

    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')

    return { data: base64, mimeType: contentType }
  } catch (error) {
    logError(error, {
      operation: 'fetch-image-as-base64',
      route: 'ai-helpers',
    })
    return null
  }
}

/**
 * Result interface for image generation
 */
export interface GenerateThumbnailResult {
  imageData: string // base64 image data
  mimeType: string
}

