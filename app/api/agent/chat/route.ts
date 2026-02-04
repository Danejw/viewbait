/**
 * POST /api/agent/chat
 *
 * Text-only YouTube AI assistant: accepts messages, calls Gemini with agent tools,
 * executes tool calls server-side, returns final message and optional tool results for data cards.
 * Pro tier required. Uses same tool registry as execute-tool.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import { AGENT_TOOL_REGISTRY, type AgentToolContext } from '@/lib/server/agent/tool-registry'
import { isYouTubeConnected } from '@/lib/services/youtube'
import { retryWithBackoff } from '@/lib/utils/retry-with-backoff'
import { sanitizeApiErrorResponse } from '@/lib/utils/error-sanitizer'

const GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_TOOL_ROUNDS = 5

/** Gemini function declaration shape for generateContent. */
const agentToolDeclarations = [
  {
    name: 'check_youtube_connection',
    description: 'Check if the user has YouTube connected and their subscription tier. Call when you need to know if the user can use YouTube features.',
    parameters: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
  {
    name: 'list_my_videos',
    description: 'List the authenticated user\'s latest YouTube channel videos (uploads).',
    parameters: {
      type: 'object' as const,
      properties: {
        maxResults: { type: 'number' as const, description: 'Max videos to return (1-50)' },
        pageToken: { type: 'string' as const, description: 'Pagination token' },
      },
      required: [] as string[],
    },
  },
  {
    name: 'get_video_details',
    description: 'Get details for a single YouTube video by ID or URL.',
    parameters: {
      type: 'object' as const,
      properties: {
        video_id: { type: 'string' as const, description: 'YouTube video ID or URL' },
      },
      required: ['video_id'] as string[],
    },
  },
  {
    name: 'search_videos',
    description: 'Search YouTube for videos by query.',
    parameters: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' as const, description: 'Search query' },
        maxResults: { type: 'number' as const, description: 'Max results (1-50)' },
        order: { type: 'string' as const, description: 'relevance, date, viewCount, or rating' },
      },
      required: ['query'] as string[],
    },
  },
  {
    name: 'get_playlist_videos',
    description: 'Get videos in a YouTube playlist by playlist ID.',
    parameters: {
      type: 'object' as const,
      properties: {
        playlist_id: { type: 'string' as const, description: 'YouTube playlist ID' },
        maxResults: { type: 'number' as const, description: 'Max results' },
        pageToken: { type: 'string' as const, description: 'Pagination token' },
      },
      required: ['playlist_id'] as string[],
    },
  },
  {
    name: 'get_video_comments',
    description: 'Get top comments for a YouTube video.',
    parameters: {
      type: 'object' as const,
      properties: {
        video_id: { type: 'string' as const, description: 'YouTube video ID or URL' },
        maxResults: { type: 'number' as const, description: 'Max comments' },
      },
      required: ['video_id'] as string[],
    },
  },
  {
    name: 'get_channel_analytics',
    description: 'Get channel-level analytics (views, watch time, etc.) for the user\'s channel for a date range.',
    parameters: {
      type: 'object' as const,
      properties: {
        start_date: { type: 'string' as const, description: 'YYYY-MM-DD' },
        end_date: { type: 'string' as const, description: 'YYYY-MM-DD' },
        days: { type: 'number' as const, description: 'Last N days if no dates' },
      },
      required: [] as string[],
    },
  },
  {
    name: 'get_video_analytics',
    description: 'Get analytics for a specific video (views, watch time, time series) for a date range.',
    parameters: {
      type: 'object' as const,
      properties: {
        video_id: { type: 'string' as const, description: 'YouTube video ID or URL' },
        start_date: { type: 'string' as const, description: 'YYYY-MM-DD' },
        end_date: { type: 'string' as const, description: 'YYYY-MM-DD' },
        days: { type: 'number' as const, description: 'Last N days' },
      },
      required: ['video_id'] as string[],
    },
  },
  {
    name: 'get_my_channel_info',
    description: 'Get the authenticated user\'s YouTube channel info (title, subscribers, etc.).',
    parameters: { type: 'object' as const, properties: {}, required: [] as string[] },
  },
]

/** Chat flow: exclude check_youtube_connection — context is injected in the system instruction. */
const CHAT_TOOL_DECLARATIONS = agentToolDeclarations.filter((d) => d.name !== 'check_youtube_connection')
const CHAT_TOOL_NAMES = CHAT_TOOL_DECLARATIONS.map((d) => d.name)

function buildSystemInstruction(connected: boolean, tier: string): string {
  return `You are a helpful YouTube AI assistant for creators. Answer questions about the user's channel, videos, analytics, and search using the tools below.

User context (use this; do NOT call check_youtube_connection):
- tier=${tier}, YouTube connected=${connected}

Rules:
- If connected is false and the user asks for their videos/analytics, reply briefly asking them to connect their YouTube channel in settings.
- If connected is true and the user asks for their videos, most viewed video, analytics, or channel info, call the right tool (list_my_videos, get_video_analytics, get_channel_analytics, get_my_channel_info, etc.), then reply with a short summary and key numbers.
- For "most viewed" or "highest viewed" video: call list_my_videos to get their videos, then call get_video_analytics for each if needed to compare views, or use list_my_videos response if it includes view counts. Summarize and name the top video.
- After receiving tool results, always respond with a concise text reply summarizing the data for the user. Do not end your turn with only tool calls.`
}

export interface AgentChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
}

export interface AgentChatResponse {
  message: string
  toolResults?: Array<{ tool: string; result: unknown }>
  code?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tierName = await getTierNameForUser(supabase, user.id)
    if (tierName !== 'pro') {
      return NextResponse.json(
        {
          success: false,
          error: 'YouTube assistant requires a Pro subscription.',
          code: 'TIER_REQUIRED',
        },
        { status: 403 }
      )
    }

    const body: AgentChatRequest = await request.json()
    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'messages array is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const connected = await isYouTubeConnected(user.id)
    const context: AgentToolContext = { tier: tierName, connected }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Assistant is not configured.', code: 'CONFIG_ERROR' },
        { status: 503 }
      )
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

    const systemInstruction = buildSystemInstruction(connected, tierName)
    const contents: Array<{ role: string; parts: Array<{ text?: string; functionCall?: { name: string; args: unknown }; functionResponse?: { name: string; response: unknown } }> }> = []

    const firstUserContent = [systemInstruction, body.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')].join('\n\n')
    contents.push({ role: 'user', parts: [{ text: firstUserContent }] })

    const toolResults: Array<{ tool: string; result: unknown }> = []
    let rounds = 0
    let lastText = ''
    /** True if we executed at least one tool (success or failure); used to run summary when only errors were returned. */
    let hadToolRound = false

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++
      const requestBody = {
        contents: contents.map((c) => ({
          role: c.role,
          parts: c.parts.map((p) => {
            if (p.text !== undefined) return { text: p.text }
            if (p.functionCall) return { functionCall: p.functionCall }
            if (p.functionResponse) return { functionResponse: p.functionResponse }
            return {}
          }),
        })),
        tools: [{ functionDeclarations: CHAT_TOOL_DECLARATIONS }],
        toolConfig: {
          functionCallingConfig: { mode: 'ANY' as const, allowedFunctionNames: CHAT_TOOL_NAMES },
        },
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      }

      const response = await retryWithBackoff(() =>
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(requestBody),
        })
      )

      if (!response.ok) {
        const errorText = await response.text()
        const sanitized = sanitizeApiErrorResponse(errorText)
        logError(new Error(`Gemini API error: ${response.status}`), {
          route: 'POST /api/agent/chat',
          status: response.status,
        })
        return NextResponse.json(
          { success: false, message: sanitized || 'Assistant failed.', code: 'GEMINI_ERROR' },
          { status: 502 }
        )
      }

      const data = (await response.json()) as {
        candidates?: Array<{
          content?: {
            parts?: Array<{
              text?: string
              functionCall?: { name: string; args: unknown }
            }>
          }
        }>
      }

      const parts = data.candidates?.[0]?.content?.parts ?? []
      const textPart = parts.find((p) => p.text)
      const functionCallPart = parts.find((p) => p.functionCall)

      if (textPart?.text) {
        lastText = textPart.text
        if (!functionCallPart) break
      }

      if (functionCallPart?.functionCall) {
        const name = functionCallPart.functionCall.name
        const args = functionCallPart.functionCall.args as Record<string, unknown>

        const entry = AGENT_TOOL_REGISTRY[name]
        if (!entry) {
          hadToolRound = true
          contents.push(
            { role: 'model', parts: [{ functionCall: { name, args } }] },
            { role: 'user', parts: [{ functionResponse: { name, response: { error: `Unknown tool: ${name}` } } }] }
          )
          continue
        }

        const parsed = entry.schema.safeParse(args)
        const params = parsed.success ? parsed.data : args

        try {
          const result = await entry.handler(user.id, params, context)
          hadToolRound = true
          toolResults.push({ tool: name, result })
          contents.push(
            { role: 'model', parts: [{ functionCall: { name, args } }] },
            { role: 'user', parts: [{ functionResponse: { name, response: result } }] }
          )
        } catch (err) {
          hadToolRound = true
          const message = err instanceof Error ? err.message : 'Tool failed'
          contents.push(
            { role: 'model', parts: [{ functionCall: { name, args } }] },
            { role: 'user', parts: [{ functionResponse: { name, response: { error: message } } }] }
          )
        }
      } else {
        break
      }
    }

    // If the model never returned a text reply but we had tool rounds (success or failure), force a summary turn.
    if (!lastText && (toolResults.length > 0 || hadToolRound)) {
      const summaryPrompt =
        toolResults.length > 0
          ? `The user asked a question and you received tool results above. Reply with a brief, helpful summary (1-4 sentences) for the user. Mention key numbers (e.g. views, watch time). Do not call any tools.`
          : `The user asked a question and one or more tools were called but returned errors (e.g. YouTube not connected). Reply with a brief, helpful message (1-3 sentences) telling the user what went wrong and what they can do (e.g. connect their YouTube channel in settings). Do not call any tools.`
      const summaryContents = [
        ...contents,
        {
          role: 'user' as const,
          parts: [{ text: summaryPrompt }],
        },
      ]
      const summaryBody = {
        contents: summaryContents.map((c) => ({
          role: c.role,
          parts: c.parts.map((p) => {
            if (p.text !== undefined) return { text: p.text }
            if (p.functionCall) return { functionCall: p.functionCall }
            if (p.functionResponse) return { functionResponse: p.functionResponse }
            return {}
          }).filter((p) => Object.keys(p).length > 0),
        })),
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 1024,
        },
      }
      try {
        const summaryRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey! },
          body: JSON.stringify(summaryBody),
        })
        if (summaryRes.ok) {
          const summaryData = (await summaryRes.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
          }
          const summaryText = summaryData.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text
          if (summaryText) lastText = summaryText
        }
      } catch {
        // leave lastText empty; fallback message will be used
      }
    }

    logInfo('Agent chat completed', {
      route: 'POST /api/agent/chat',
      userId: user.id,
      toolCalls: toolResults.length,
    })

    return NextResponse.json({
      success: true,
      message: lastText || "I couldn't generate a response. Please try again.",
      toolResults: toolResults.length > 0 ? toolResults : undefined,
    })
  } catch (error) {
    logError(error, { route: 'POST /api/agent/chat', operation: 'agent-chat' })
    const message = error instanceof Error ? error.message : 'Request failed'
    return NextResponse.json(
      { success: false, message, code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
