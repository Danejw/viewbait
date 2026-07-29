/**
 * OpenAI Apps challenge verification.
 * Must return only the raw token as text/plain (no JSON, no HTML).
 * @see https://developers.openai.com/apps-sdk/
 */
const CHALLENGE_TOKEN = 'J0HHcyiPMcBE9xtVLztqX1KHs8bGLEEvrQOL2rY7IeI'

export function GET() {
  return new Response(CHALLENGE_TOKEN, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
