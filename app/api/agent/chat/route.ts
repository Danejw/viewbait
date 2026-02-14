/**
 * POST /api/agent/chat
 *
 * Text-only YouTube AI assistant: accepts messages, calls Gemini with agent tools,
 * executes tool calls server-side, returns final message and optional tool results for data cards.
 * Pro tier required. Uses same tool registry as execute-tool.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { enforceRateLimit } from '@/lib/server/utils/rate-limit'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import { AGENT_TOOL_REGISTRY, type AgentToolContext } from '@/lib/server/agent/tool-registry'
import { isYouTubeConnected } from '@/lib/services/youtube'
import { retryWithBackoff } from '@/lib/utils/retry-with-backoff'
import { sanitizeApiErrorResponse } from '@/lib/utils/error-sanitizer'
import { getExpressionValues, getPoseValues } from '@/lib/constants/face-options'

const GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_TOOL_ROUNDS = 5

/** Allowed UI component names for thumbnail_assistant_response (must match DynamicUIRenderer). */
const THUMBNAIL_UI_COMPONENTS = [
  'ThumbnailTextSection',
  'IncludeFaceSection',
  'StyleSelectionSection',
  'ColorPaletteSection',
  'StyleReferencesSection',
  'AspectRatioSection',
  'ResolutionSection',
  'AspectRatioResolutionSection',
  'VariationsSection',
  'CustomInstructionsSection',
  'GenerateThumbnailButton',
  'ProjectSelectorSection',
  'RegisterNewFaceCard',
  'RegisterNewStyleCard',
  'RegisterNewPaletteCard',
] as const

/** Remove server-only keys from form_state_updates before sending to client. */
function stripServerOnlyFormUpdates(updates: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!updates || typeof updates !== 'object') return undefined
  const {
    add_attached_images_to_style_references: _1,
    add_attached_image_as_new_face: _2,
    new_face_name: _3,
    ...rest
  } = updates
  return Object.keys(rest).length > 0 ? rest : undefined
}

/** Resolve selectedStyle/selectedColor by name to ID using available lists. */
function resolveStylePaletteNames(
  updates: Record<string, unknown>,
  availableStyles: Array<{ id: string; name?: string }>,
  availablePalettes: Array<{ id: string; name?: string }>
): Record<string, unknown> {
  const result = { ...updates }
  const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (result.selectedStyle != null && !uuidLike.test(String(result.selectedStyle))) {
    const byName = availableStyles.find((s) => s.name?.toLowerCase() === String(result.selectedStyle).toLowerCase())
    if (byName) result.selectedStyle = byName.id
  }
  if (result.selectedColor != null && !uuidLike.test(String(result.selectedColor))) {
    const byName = availablePalettes.find((p) => p.name?.toLowerCase() === String(result.selectedColor).toLowerCase())
    if (byName) result.selectedColor = byName.id
  }
  return result
}

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
  {
    name: 'get_channel_pulse',
    description: 'Get a quick channel pulse: channel info + analytics for last N days + recent videos. Run in parallel for a proactive summary when the user opens the assistant or asks "how\'s my channel?".',
    parameters: {
      type: 'object' as const,
      properties: {
        days: { type: 'number' as const, description: 'Last N days for analytics (1-14)' },
        recentVideosCount: { type: 'number' as const, description: 'Number of recent videos to include (1-10)' },
      },
      required: [] as string[],
    },
  },
  {
    name: 'get_underperforming_videos',
    description: 'Find videos with below-average views in the last N days. Use when the user asks which videos need a new thumbnail or what to improve.',
    parameters: {
      type: 'object' as const,
      properties: {
        days: { type: 'number' as const, description: 'Period in days (1-90)' },
        maxVideosToCheck: { type: 'number' as const, description: 'Max videos to analyze (1-20)' },
      },
      required: [] as string[],
    },
  },
  {
    name: 'apply_thumbnail_to_video',
    description: 'Apply a ViewBait thumbnail (by thumbnail_id) to a YouTube video (by video_id). Use when the user asks to set or use a thumbnail for a video.',
    parameters: {
      type: 'object' as const,
      properties: {
        video_id: { type: 'string' as const, description: 'YouTube video ID or URL' },
        thumbnail_id: { type: 'string' as const, description: 'ViewBait thumbnail ID (from gallery)' },
      },
      required: ['video_id', 'thumbnail_id'] as string[],
    },
  },
  {
    name: 'get_upload_rhythm',
    description: 'Get recent upload dates and a short summary of upload rhythm (e.g. which days the user usually uploads). Use for content calendar or "ready to publish" nudges.',
    parameters: {
      type: 'object' as const,
      properties: {
        lastN: { type: 'number' as const, description: 'Number of recent videos to consider (1-50)' },
      },
      required: [] as string[],
    },
  },
  {
    name: 'thumbnail_assistant_response',
    description:
      'Use when the user asks for help with thumbnails: set title, aspect ratio, resolution, variations, style, palette, face, or custom instructions. Surfaces 1-2 relevant generator UI sections and pre-fills form state. When a focused video is set, you can pre-fill thumbnailText from the video title. Always pair surfacing a ui_component with setting the matching form_state_updates.',
    parameters: {
      type: 'object' as const,
      properties: {
        human_readable_message: {
          type: 'string' as const,
          description:
            'A natural, conversational message to display. Be helpful and guide the user through thumbnail creation.',
        },
        ui_components: {
          type: 'array' as const,
          description: 'Return ONLY 1-2 component names relevant to the user\'s request.',
          items: {
            type: 'string' as const,
            enum: [...THUMBNAIL_UI_COMPONENTS],
          },
        },
        form_state_updates: {
          type: 'object' as const,
          description:
            'Pre-fill the surfaced section. When you surface a component, set its values here (e.g. thumbnailText, selectedAspectRatio, variations).',
          properties: {
            thumbnailText: { type: 'string' as const },
            selectedStyle: { type: 'string' as const },
            selectedColor: { type: 'string' as const },
            selectedAspectRatio: {
              type: 'string' as const,
              enum: ['16:9', '1:1', '3:2', '3:4', '4:3', '9:16', '2:3', '4:5', '5:4', '21:9'],
            },
            selectedResolution: { type: 'string' as const, enum: ['1K', '2K', '4K'] },
            variations: { type: 'number' as const, minimum: 1, maximum: 4 },
            includeFace: { type: 'boolean' as const },
            expression: { type: 'string' as const, enum: getExpressionValues() },
            pose: { type: 'string' as const, enum: getPoseValues() },
            customInstructions: { type: 'string' as const },
            includeStyleReferences: { type: 'boolean' as const },
            styleReferences: { type: 'array' as const, items: { type: 'string' as const } },
          },
          required: [] as string[],
        },
        suggestions: {
          type: 'array' as const,
          description: '2-3 short actionable suggestions (e.g. "Change to 2K resolution", "Generate the thumbnail now").',
          items: { type: 'string' as const },
        },
        offer_upgrade: { type: 'boolean' as const, description: 'Set true when the user asked for a higher-tier feature.' },
        required_tier: { type: 'string' as const },
      },
      required: ['human_readable_message', 'ui_components'] as string[],
    },
  },
]

/** Chat flow: exclude check_youtube_connection — context is injected in the system instruction. */
const CHAT_TOOL_DECLARATIONS = agentToolDeclarations.filter((d) => d.name !== 'check_youtube_connection')
const CHAT_TOOL_NAMES = CHAT_TOOL_DECLARATIONS.map((d) => d.name)

function buildSystemInstruction(
  connected: boolean,
  tier: string,
  focusedVideo: { id: string; title?: string } | null
): string {
  const focusBlock =
    focusedVideo != null
      ? `\nFocused video (user is working on this): id=${focusedVideo.id}, title=${focusedVideo.title ?? 'unknown'}. When the user says "generate a thumbnail", "this video", or similar without specifying which, prefer this video. Suggest "Generate thumbnail" or "Focus on this video" actions when relevant.`
      : ''

  return `You are a helpful YouTube AI assistant for creators. Answer questions about the user's channel, videos, analytics, and search using the tools below.

User context (use this; do NOT call check_youtube_connection):
- tier=${tier}, YouTube connected=${connected}
${focusBlock}

Sub-agents and when to use them:
- get_channel_pulse: Use for a proactive "here's your channel" summary (e.g. when the user opens the assistant or asks "how's my channel?"). Returns channel info + recent analytics + recent videos in one call.
- get_underperforming_videos: When the user asks which videos need a new thumbnail or what to improve, call this to get videos with below-average views; then suggest they can "Generate thumbnail" for each.
- apply_thumbnail_to_video: When the user wants to set a ViewBait thumbnail on a YouTube video, call with video_id and thumbnail_id (the user may say "use my latest thumbnail for video X" or "apply that to this video").
- get_upload_rhythm: When the user asks about upload schedule, content calendar, or "when do I usually post?", use this for upload dates and a short rhythm summary.
- get_video_comments: When the user asks about a specific video's comments or what viewers said, call this; then you can suggest thumbnail or title ideas based on recurring themes or sentiment.

Rules:
- If connected is false and the user asks for their videos/analytics, reply briefly asking them to connect their YouTube channel in settings.
- If connected is true and the user asks for their videos, most viewed video, analytics, or channel info, call the right tool (list_my_videos, get_video_analytics, get_channel_analytics, get_my_channel_info, get_channel_pulse, etc.), then reply with a short summary and key numbers.
- For "most viewed" or "highest viewed" video: call list_my_videos to get their videos, then call get_video_analytics for each if needed to compare views. Summarize and name the top video.
- After receiving tool results, always respond with a concise text reply summarizing the data for the user. Do not end your turn with only tool calls.
- When you show a list of videos (e.g. from list_my_videos or get_underperforming_videos), mention that the user can "Generate thumbnail" or "Focus on this video" for any of them (the UI will show those actions).

Thumbnail help (thumbnail_assistant_response):
- When the user asks for help with thumbnails (e.g. "set title to X", "use 16:9", "3 variations", "add my face", "pick a style", "help me make a thumbnail for this video"), call thumbnail_assistant_response with a helpful message, 1-2 relevant ui_components, and the matching form_state_updates so the surfaced section is pre-filled.
- When a focused video is set, you can pre-fill thumbnailText from the video title when the user says "make a thumbnail for this video" or "generate a thumbnail".
- Always pair surfacing a component with setting its values in form_state_updates (e.g. "Use 16:9" -> AspectRatioSection and selectedAspectRatio: "16:9").`
}

/** Form state shape for thumbnail-assistant (same as assistant/chat). */
export interface AgentChatFormState {
  thumbnailText?: string
  includeFace?: boolean
  selectedFaces?: string[]
  expression?: string | null
  pose?: string | null
  styleReferences?: string[]
  selectedStyle?: string | null
  selectedColor?: string | null
  selectedAspectRatio?: string
  selectedResolution?: string
  variations?: number
  customInstructions?: string
  includeStyleReferences?: boolean
}

export interface AgentChatRequest {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  /** When set, the assistant prefers this video for "generate thumbnail" or "this video" context. */
  focusedVideoId?: string | null
  focusedVideoTitle?: string | null
  /** When true and messages are empty, run channel pulse in parallel and return a proactive summary. */
  runChannelPulse?: boolean
  /** Current generator form state (for thumbnail_assistant_response context and pre-fill). */
  formState?: AgentChatFormState
  /** Available styles for name→id resolution (id, name). */
  availableStyles?: Array<{ id: string; name?: string }>
  /** Available palettes for name→id resolution (id, name). */
  availablePalettes?: Array<{ id: string; name?: string }>
}

export interface AgentChatResponse {
  message: string
  toolResults?: Array<{ tool: string; result: unknown }>
  code?: string
  /** When the model used thumbnail_assistant_response. */
  form_state_updates?: Record<string, unknown>
  ui_components?: string[]
  suggestions?: string[]
  offer_upgrade?: boolean
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const rateLimitRes = enforceRateLimit('agent-chat', request, user.id)
    if (rateLimitRes) return rateLimitRes

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
    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { success: false, error: 'messages array is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const connected = await isYouTubeConnected(user.id)
    const context: AgentToolContext = { tier: tierName, connected }
    const focusedVideo =
      body.focusedVideoId != null && body.focusedVideoId !== ''
        ? { id: body.focusedVideoId, title: body.focusedVideoTitle ?? undefined }
        : null

    // Optional: run channel pulse when assistant is opened (no user message yet)
    const runChannelPulse =
      connected &&
      body.runChannelPulse === true &&
      (body.messages.length === 0 ||
        (body.messages.length === 1 && body.messages[0].role === 'assistant' && !body.messages[0].content?.trim()))
    if (runChannelPulse) {
      const pulseEntry = AGENT_TOOL_REGISTRY.get_channel_pulse
      if (pulseEntry) {
        try {
          const pulseResult = await pulseEntry.handler(user.id, { days: 7, recentVideosCount: 5 }, context)
          const pulseToolResults: Array<{ tool: string; result: unknown }> = [
            { tool: 'get_channel_pulse', result: pulseResult },
          ]
          const apiKey = process.env.GEMINI_API_KEY
          if (apiKey) {
            const systemInstruction = buildSystemInstruction(connected, tierName, focusedVideo)
            const pulsePrompt = `The user just opened the assistant. You received get_channel_pulse results below. Reply with a short, friendly "Channel pulse" summary (2-4 sentences): channel name, key numbers from the last 7 days (views, watch time, subs if available), and the 5 most recent videos. Do not call any tools.`
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
              body: JSON.stringify({
                contents: [
                  {
                    role: 'user',
                    parts: [
                      { text: [systemInstruction, pulsePrompt, 'Tool result: get_channel_pulse', JSON.stringify(pulseResult)].join('\n\n') },
                    ],
                  },
                ],
                generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
              }),
            })
            if (response.ok) {
              const data = (await response.json()) as {
                candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
              }
              const text = data.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text
              if (text) {
                return NextResponse.json({
                  success: true,
                  message: text,
                  toolResults: pulseToolResults,
                })
              }
            }
          }
          // Fallback: return raw pulse data with a generic message
          return NextResponse.json({
            success: true,
            message: "Here's a quick look at your channel. Ask me anything about your videos or analytics.",
            toolResults: pulseToolResults,
          })
        } catch (err) {
          logError(err instanceof Error ? err : new Error('Channel pulse failed'), {
            route: 'POST /api/agent/chat',
            userId: user.id,
          })
          // Fall through to normal flow with empty messages
        }
      }
    }

    if (body.messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'messages array is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Assistant is not configured.', code: 'CONFIG_ERROR' },
        { status: 503 }
      )
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

    const systemInstruction = buildSystemInstruction(connected, tierName, focusedVideo)
    const contents: Array<{ role: string; parts: Array<{ text?: string; functionCall?: { name: string; args: unknown }; functionResponse?: { name: string; response: unknown } }> }> = []

    const firstUserContent = [systemInstruction, body.messages.map((m) => `${m.role}: ${m.content}`).join('\n\n')].join('\n\n')
    contents.push({ role: 'user', parts: [{ text: firstUserContent }] })

    const toolResults: Array<{ tool: string; result: unknown }> = []
    let rounds = 0
    let lastText = ''
    /** True if we executed at least one tool (success or failure); used to run summary when only errors were returned. */
    let hadToolRound = false
    /** When the model calls thumbnail_assistant_response, we capture it for the response (form_state_updates, ui_components, etc.). */
    let thumbnailPayload: {
      human_readable_message: string
      form_state_updates?: Record<string, unknown>
      ui_components: string[]
      suggestions?: string[]
      offer_upgrade?: boolean
    } | null = null

    const availableStyles = body.availableStyles ?? []
    const availablePalettes = body.availablePalettes ?? []

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

        if (name === 'thumbnail_assistant_response') {
          hadToolRound = true
          const humanReadableMessage = typeof args.human_readable_message === 'string' ? args.human_readable_message : 'I\'ve updated the thumbnail settings.'
          const rawUpdates = args.form_state_updates as Record<string, unknown> | undefined
          const resolved = rawUpdates
            ? resolveStylePaletteNames(rawUpdates, availableStyles, availablePalettes)
            : undefined
          const form_state_updates = resolved ? stripServerOnlyFormUpdates(resolved) : undefined
          const ui_components = Array.isArray(args.ui_components)
            ? (args.ui_components as string[]).filter((c) => THUMBNAIL_UI_COMPONENTS.includes(c as (typeof THUMBNAIL_UI_COMPONENTS)[number]))
            : []
          thumbnailPayload = {
            human_readable_message: humanReadableMessage,
            form_state_updates: form_state_updates ?? undefined,
            ui_components,
            suggestions: Array.isArray(args.suggestions) ? (args.suggestions as string[]) : undefined,
            offer_upgrade: !!args.offer_upgrade,
          }
          contents.push(
            { role: 'model', parts: [{ functionCall: { name, args } }] },
            { role: 'user', parts: [{ functionResponse: { name, response: { received: true } } }] }
          )
          continue
        }

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
