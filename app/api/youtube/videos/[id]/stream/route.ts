/**
 * YouTube Video Stream API Route
 *
 * Streams a YouTube video by ID for client-side frame extraction (FFmpeg.wasm).
 * Auth required. Stream is capped to avoid abuse and long waits.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  notFoundResponse,
  forbiddenResponse,
} from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { NextResponse } from 'next/server'

const YOUTUBE_WATCH_BASE = 'https://www.youtube.com/watch?v='
const MAX_STREAM_BYTES = 50 * 1024 * 1024 // 50 MB

/** YouTube video IDs are 11 chars, alphanumeric, hyphen, underscore */
function isValidVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{10,12}$/.test(id)
}

/** Read a Node ReadableStream into a Buffer with a byte cap */
function readStreamWithCap(
  stream: NodeJS.ReadableStream,
  maxBytes: number
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    let settled = false
    const settle = (buf: Buffer) => {
      if (settled) return
      settled = true
      stream.removeAllListeners()
      if (typeof (stream as { destroy?: () => void }).destroy === 'function') {
        (stream as { destroy: () => void }).destroy()
      }
      resolve(buf)
    }
    const onData = (chunk: Buffer) => {
      total += chunk.length
      if (total <= maxBytes) {
        chunks.push(chunk)
      }
      if (total >= maxBytes) {
        settle(Buffer.concat(chunks))
      }
    }
    const onError = (err: Error) => {
      if (settled) return
      settled = true
      stream.removeAllListeners()
      reject(err)
    }
    const onEnd = () => settle(Buffer.concat(chunks))
    stream.on('data', onData)
    stream.on('error', onError)
    stream.on('end', onEnd)
  })
}

/**
 * GET /api/youtube/videos/[id]/stream
 * Returns the video body (capped at MAX_STREAM_BYTES) for frame extraction.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    await requireAuth(supabase)

    const { id: videoId } = await context.params
    const trimmed = (videoId ?? '').trim()
    if (!trimmed || !isValidVideoId(trimmed)) {
      return validationErrorResponse('Invalid video ID')
    }

    const url = `${YOUTUBE_WATCH_BASE}${trimmed}`

    const ytdl = await import('@distube/ytdl-core')
    let info: Awaited<ReturnType<typeof ytdl.getInfo>>
    try {
      info = await ytdl.getInfo(url)
    } catch {
      return notFoundResponse('Video unavailable or private')
    }

    if (!info?.formats?.length) {
      return notFoundResponse('Video unavailable or private')
    }

    const videoOnlyFormats = ytdl.filterFormats(info.formats, 'videoonly')
    if (!videoOnlyFormats.length) {
      return notFoundResponse('No streamable video format available')
    }

    const tryDownload = async (filter: 'videoonly' | 'videoandaudio'): Promise<Buffer> => {
      const stream = ytdl.downloadFromInfo(info, { filter, quality: 'lowest' })
      return readStreamWithCap(stream, MAX_STREAM_BYTES)
    }

    let buffer: Buffer | null = null
    let firstErr: unknown = null
    try {
      buffer = await tryDownload('videoonly')
    } catch (streamErr) {
      firstErr = streamErr
    }

    const errMsg = firstErr instanceof Error ? firstErr.message : firstErr ? String(firstErr) : ''
    if (!buffer && errMsg.includes('403')) {
      try {
        buffer = await tryDownload('videoandaudio')
      } catch {
        return forbiddenResponse('YouTube blocked the download. Try uploading a file instead.')
      }
    }

    if (!buffer) {
      return notFoundResponse('Video unavailable or private')
    }
    if (buffer.length === 0) {
      return notFoundResponse('No video data available')
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error, 'GET /api/youtube/videos/[id]/stream', 'stream-video', undefined, 'Failed to stream video')
  }
}
