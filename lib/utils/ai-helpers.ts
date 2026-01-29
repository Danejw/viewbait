/**
 * AI Helper Utilities
 * 
 * Non-sensitive utility functions for AI operations.
 * Emotion/pose mappings and helper functions.
 */

import { logError } from '@/lib/server/utils/logger'

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

    // Handle regular URLs
    const response = await fetch(imageUrl)
    if (!response.ok) {
      logError(new Error(`Failed to fetch image: ${response.statusText}`), {
        operation: 'fetch-image-as-base64',
        route: 'ai-helpers',
        statusCode: response.status,
      })
      return null
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    
    // Determine mime type from response or URL
    const contentType = response.headers.get('content-type') || 'image/png'
    const mimeType = contentType.split(';')[0].trim()

    return { data: base64, mimeType }
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

