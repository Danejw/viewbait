/**
 * Client-side only: fetch an image URL and return base64 + mimeType.
 * Used so the heatmap API receives the exact image the user sees (same bytes).
 * Do not use on the server (use ai-helpers fetchImageAsBase64 there).
 */

const CHUNK_SIZE = 8192

/**
 * Convert ArrayBuffer to base64 string in the browser without blowing the call stack.
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, bytes.length))
    binary += String.fromCharCode(...chunk)
  }
  return btoa(binary)
}

/**
 * Fetch an image from a URL (same-origin or CORS-enabled) and return base64 + mimeType.
 * Use this when you need to send the exact image the browser would display to an API.
 *
 * @param imageUrl - Full URL or data URL of the image
 * @returns { data: base64 string, mimeType: string } or null on failure
 */
export async function fetchImageAsBase64Client(
  imageUrl: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    if (imageUrl.startsWith('data:image/')) {
      const [header, base64Data] = imageUrl.split(',')
      if (!base64Data) return null
      const mimeTypeMatch = header.match(/data:image\/([^;]+)/)
      const mimeType = mimeTypeMatch ? `image/${mimeTypeMatch[1]}` : 'image/png'
      return { data: base64Data, mimeType }
    }

    const response = await fetch(imageUrl)
    if (!response.ok) return null

    const arrayBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/png'
    const mimeType = contentType.split(';')[0].trim()

    const data = arrayBufferToBase64(arrayBuffer)
    return { data, mimeType }
  } catch {
    return null
  }
}
