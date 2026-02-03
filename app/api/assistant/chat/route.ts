/**
 * AI Assistant Chat API Route
 * 
 * Handles chat interactions with the AI assistant for thumbnail generation.
 * Uses Gemini API to reason about user intent and surface appropriate UI components.
 */

import { createClient } from '@/lib/supabase/server'
import { getOptionalAuth } from '@/lib/server/utils/auth'
import { NextResponse } from 'next/server'
import { callGeminiWithFunctionCalling, type FunctionCallingResult } from '@/lib/services/ai-core'
import { processGroundingCitations } from '@/lib/utils/citation-processor'
import { logError } from '@/lib/server/utils/logger'
import { submitFeedbackFromServer } from '@/lib/server/feedback'
import { getExpressionValues, getPoseValues, formatExpressionsForPrompt, formatPosesForPrompt } from '@/lib/constants/face-options'
import { getTierForUser, getTierNameForUser } from '@/lib/server/utils/tier'
import { SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS } from '@/lib/server/utils/url-refresh'
import { parseYouTubeVideoId, parseYouTubeVideoIds } from '@/lib/utils/youtube'
import { extractStyleFromImageUrls, MIN_IMAGES as EXTRACT_MIN_IMAGES, MAX_IMAGES as EXTRACT_MAX_IMAGES } from '@/lib/server/styles/extract-style-from-images'
import type { StyleInsert } from '@/lib/types/database'

const MAX_STYLE_REFERENCES = 10
const STYLE_REFERENCES_BUCKET = 'style-references'
const FACES_BUCKET = 'faces'
const APP_VERSION_FOR_FEEDBACK = process.env.NEXT_PUBLIC_APP_VERSION ?? 'web'

/**
 * Upload a base64-encoded image to the style-references bucket and return a signed URL.
 * Used when the user asks the agent to add an attached image to style references.
 */
async function uploadBase64ToStyleReferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  base64: string,
  mimeType: string,
  index: number
): Promise<string | null> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/gif' ? 'gif' : 'jpg'
  const path = `${userId}/ref-${Date.now()}-${index}.${ext}`
  const buffer = Buffer.from(base64, 'base64')
  const { error: uploadError } = await supabase.storage
    .from(STYLE_REFERENCES_BUCKET)
    .upload(path, buffer, { contentType: mimeType, cacheControl: '3600', upsert: true })
  if (uploadError) return null
  const { data: urlData, error: urlError } = await supabase.storage
    .from(STYLE_REFERENCES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS)
  if (urlError || !urlData?.signedUrl) return null
  return urlData.signedUrl
}

/**
 * If the agent set add_attached_images_to_style_references and the user attached images,
 * upload them to style-references and merge URLs into form_state_updates.
 */
async function enrichFormStateWithAttachedStyleReferences(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  currentStyleReferences: string[],
  attachedImages: Array<{ data: string; mimeType: string }>,
  formStateUpdates: Record<string, unknown> | undefined
): Promise<Record<string, unknown> | undefined> {
  const addAttached = formStateUpdates && (formStateUpdates as { add_attached_images_to_style_references?: boolean }).add_attached_images_to_style_references === true
  if (!addAttached || attachedImages.length === 0) return formStateUpdates
  const existing = currentStyleReferences ?? []
  const remaining = Math.max(0, MAX_STYLE_REFERENCES - existing.length)
  if (remaining === 0) return { ...formStateUpdates, includeStyleReferences: true, styleReferences: existing }
  const toUpload = attachedImages.slice(0, remaining)
  const uploadedUrls: string[] = []
  for (let i = 0; i < toUpload.length; i++) {
    const url = await uploadBase64ToStyleReferences(supabase, userId, toUpload[i].data, toUpload[i].mimeType, i)
    if (url) uploadedUrls.push(url)
  }
  const merged = [...existing, ...uploadedUrls]
  const out: Record<string, unknown> = { ...formStateUpdates, includeStyleReferences: true, styleReferences: merged }
  delete out.add_attached_images_to_style_references
  return out
}

/**
 * Upload a base64-encoded image to the faces bucket for a given face and return a signed URL.
 * Used when the user asks the agent to add an attached image as a new face.
 */
async function uploadBase64ToFaceImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  faceId: string,
  base64: string,
  mimeType: string,
  index: number
): Promise<string | null> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : mimeType === 'image/gif' ? 'gif' : 'jpg'
  const path = `${userId}/${faceId}/${index}.${ext}`
  const buffer = Buffer.from(base64, 'base64')
  const { error: uploadError } = await supabase.storage
    .from(FACES_BUCKET)
    .upload(path, buffer, { contentType: mimeType, cacheControl: '3600', upsert: true })
  if (uploadError) return null
  const { data: urlData, error: urlError } = await supabase.storage
    .from(FACES_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_ONE_YEAR_SECONDS)
  if (urlError || !urlData?.signedUrl) return null
  return urlData.signedUrl
}

/**
 * If the agent set add_attached_image_as_new_face and the user attached an image,
 * create a new face, upload the first image, and merge newFaceId/selectedFaces/includeFace into form_state_updates.
 */
async function enrichFormStateWithNewFaceFromAttachedImage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  currentSelectedFaces: string[],
  attachedImages: Array<{ data: string; mimeType: string }>,
  formStateUpdates: Record<string, unknown> | undefined
): Promise<Record<string, unknown> | undefined> {
  const addAsFace = formStateUpdates && (formStateUpdates as { add_attached_image_as_new_face?: boolean }).add_attached_image_as_new_face === true
  if (!addAsFace || attachedImages.length === 0) return formStateUpdates

  const tier = await getTierForUser(supabase, userId)
  if (!tier.can_create_custom) return formStateUpdates

  const nameRaw = (formStateUpdates as { new_face_name?: string }).new_face_name
  const name = (typeof nameRaw === 'string' && nameRaw.trim()) ? nameRaw.trim() : 'My face'

  const { data: face, error: insertError } = await supabase
    .from('faces')
    .insert({ user_id: userId, name, image_urls: [] })
    .select('id')
    .single()

  if (insertError || !face?.id) return formStateUpdates

  const url = await uploadBase64ToFaceImage(supabase, userId, face.id, attachedImages[0].data, attachedImages[0].mimeType, 0)
  if (!url) return formStateUpdates

  const { error: updateError } = await supabase
    .from('faces')
    .update({ image_urls: [url] })
    .eq('id', face.id)

  if (updateError) return formStateUpdates

  const existing = currentSelectedFaces ?? []
  const merged: Record<string, unknown> = {
    ...formStateUpdates,
    newFaceId: face.id,
    includeFace: true,
    selectedFaces: [...existing, face.id],
  }
  delete merged.add_attached_image_as_new_face
  delete merged.new_face_name
  return merged
}

/** Remove server-only keys from form_state_updates before sending to client. */
function stripServerOnlyFormUpdates(
  updates: Record<string, unknown> | undefined
): AssistantChatResponse['form_state_updates'] {
  if (!updates || typeof updates !== 'object') return undefined
  const {
    add_attached_images_to_style_references: _1,
    add_attached_image_as_new_face: _2,
    new_face_name: _3,
    ...rest
  } = updates
  return Object.keys(rest).length > 0 ? (rest as AssistantChatResponse['form_state_updates']) : undefined
}

export interface AssistantChatRequest {
  conversationHistory: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  formState: {
    thumbnailText: string
    includeFace: boolean
    selectedFaces: string[]
    expression: string | null
    pose: string | null
    styleReferences: string[]
    selectedStyle: string | null
    selectedColor: string | null
    selectedAspectRatio: string
    selectedResolution: string
    variations: number
    customInstructions: string
  }
  availableStyles?: Array<{ id: string; name: string }>
  availablePalettes?: Array<{ id: string; name: string }>
  /** Images attached to the current message (base64 data + mimeType). Sent to Gemini as visual context. */
  attachedImages?: Array<{ data: string; mimeType: string }>
}

export interface AssistantChatResponse {
  human_readable_message: string
  ui_components: Array<
    | 'ThumbnailTextSection'
    | 'IncludeFaceSection'
    | 'StyleSelectionSection'
    | 'ColorPaletteSection'
    | 'StyleReferencesSection'
    | 'AspectRatioSection'
    | 'ResolutionSection'
    | 'AspectRatioResolutionSection'
    | 'VariationsSection'
    | 'CustomInstructionsSection'
    | 'GenerateThumbnailButton'
    | 'RegisterNewFaceCard'
    | 'RegisterNewStyleCard'
    | 'RegisterNewPaletteCard'
  >
  form_state_updates?: {
    thumbnailText?: string
    selectedStyle?: string | null
    selectedColor?: string | null
    selectedAspectRatio?: string
    selectedResolution?: string
    variations?: number
    includeFace?: boolean
    expression?: string | null
    pose?: string | null
    customInstructions?: string
    includeStyleReferences?: boolean
    styleReferences?: string[]
    newFaceId?: string
    selectedFaces?: string[]
  }
  suggestions?: string[]
  /** When true, client shows an "Upgrade to Pro" chip and can open subscription modal. */
  offer_upgrade?: boolean
  /** Required tier for the requested action (e.g. 'pro'). Optional; used for analytics or future multi-tier upsells. */
  required_tier?: string
  /** When present, client opens the Video Analytics modal with this pre-fetched result (youtube_analyze_video tool). */
  youtube_analytics?: {
    videoId: string
    title?: string
    thumbnailUrl?: string
    analytics: Record<string, unknown>
  }
  /** When present, a new style was created from YouTube thumbnails (youtube_extract_style tool). */
  youtube_extract_style?: { styleId: string; styleName: string }
}

// Tool definition for structured output
const assistantToolDefinition = {
  name: 'generate_assistant_response',
  description: 'Generate a response for the thumbnail generation assistant. The assistant reasons about user intent from conversation history and determines which UI components to surface.',
  parameters: {
    type: 'object',
    properties: {
      human_readable_message: {
        type: 'string',
        description: 'A natural, conversational message to display to the user in a chat bubble. Should be helpful, friendly, and guide the user through the thumbnail creation process.',
      },
      ui_components: {
        type: 'array',
        description: 'Array of UI component names to display inline. Return ONLY 1-2 component names that are directly relevant to the user\'s last message. Example: if the user says "Add my face to the thumbnail" return only [\'IncludeFaceSection\']; if "Pick a style" return only [\'StyleSelectionSection\']. Do NOT return many or all sections at once.',
        items: {
          type: 'string',
          enum: [
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
          ],
        },
      },
      form_state_updates: {
        type: 'object',
        description: 'Form state updates to pre-fill the surfaced section. IMPORTANT: When you return a ui_component, you MUST also set the matching form_state_updates so the surfaced section is pre-filled. Examples: "Add my face" -> set includeFace: true; "Make it more dramatic" -> set customInstructions: "Make it more dramatic"; "Set title to X" -> set thumbnailText: "X"; "Use 16:9" -> set selectedAspectRatio: "16:9". Always couple surfacing a component with setting its values when the user has expressed intent or a value.',
        properties: {
          thumbnailText: {
            type: 'string',
            description: 'The thumbnail title/text. Set when surfacing ThumbnailTextSection and user has stated a title.',
          },
          selectedStyle: {
            type: 'string',
            description: 'Style ID or name. Set when surfacing StyleSelectionSection and user has mentioned a style.',
          },
          selectedColor: {
            type: 'string',
            description: 'Color palette ID or name. Set when surfacing ColorPaletteSection and user has mentioned a palette.',
          },
          selectedAspectRatio: {
            type: 'string',
            description: 'Aspect ratio (16:9, 1:1, 4:3, 9:16). Set when surfacing AspectRatioSection or AspectRatioResolutionSection and user has stated a ratio.',
            enum: ['16:9', '1:1', '4:3', '9:16'],
          },
          selectedResolution: {
            type: 'string',
            description: 'Resolution (1K, 2K, 4K). Set when surfacing ResolutionSection or AspectRatioResolutionSection and user has stated a resolution.',
            enum: ['1K', '2K', '4K'],
          },
          variations: {
            type: 'number',
            description: 'Number of variations (1-4). Set when surfacing VariationsSection and user has stated a count.',
            minimum: 1,
            maximum: 4,
          },
          includeFace: {
            type: 'boolean',
            description: 'Whether to include face. Set to true when surfacing IncludeFaceSection and user wants to add their face.',
          },
          expression: {
            type: 'string',
            description: 'Facial expression. Set when user mentions an expression.',
            enum: getExpressionValues(),
          },
          pose: {
            type: 'string',
            description: 'Pose. Set when user mentions a pose.',
            enum: getPoseValues(),
          },
          customInstructions: {
            type: 'string',
            description: 'Custom instructions text. Set when surfacing CustomInstructionsSection - copy the user\'s instruction verbatim (e.g., "Make it more dramatic", "Add a glowing effect").',
          },
          includeStyleReferences: {
            type: 'boolean',
            description: 'Whether to enable style reference images. Set to true when surfacing StyleReferencesSection or when the user wants to add an image to style references.',
          },
          styleReferences: {
            type: 'array',
            description: 'Full list of style reference image URLs. Only set when you are replacing or appending URLs (e.g. after backend adds uploaded images). Normally leave unset; use add_attached_images_to_style_references when user asks to add attached image(s).',
            items: { type: 'string' },
          },
        },
      },
      add_attached_images_to_style_references: {
        type: 'boolean',
        description: 'Set to true when the user has attached one or more images to this message AND asks to add them to style references (e.g. "add this to my style references", "use this as a style reference"). Surface StyleReferencesSection and set includeStyleReferences to true. The backend will upload the attached images and add their URLs to style references.',
      },
      add_attached_image_as_new_face: {
        type: 'boolean',
        description: 'Set to true when the user has attached an image to this message AND asks to add it as their face (e.g. "add this as my face", "use this as my face", "register this as a face"). Surface IncludeFaceSection or RegisterNewFaceCard. The backend will create a new face and upload the first attached image. Use only the first attached image; one face per message.',
      },
      new_face_name: {
        type: 'string',
        description: 'Optional name for the new face when add_attached_image_as_new_face is true. E.g. "Me", "Host", or leave unset for default "My face".',
      },
      suggestions: {
        type: 'array',
        description: 'Array of 2-3 short, actionable suggestions for what the user might want to do next. Each suggestion should be a concise phrase (e.g., "Change the style to minimalist", "Add my face to the thumbnail", "Generate the thumbnail now"). Suggestions should be relevant to the current conversation context and help guide the user through the thumbnail creation process.',
        items: {
          type: 'string',
        },
      },
      offer_upgrade: {
        type: 'boolean',
        description: 'Set to true when the user asked for something that requires a higher tier (e.g. YouTube features) and their current tier does not have access. The client will show an "Upgrade to Pro" suggestion chip.',
      },
      required_tier: {
        type: 'string',
        description: 'Optional. The tier required for the requested action (e.g. "pro"). Use when offer_upgrade is true.',
      },
    },
    required: ['human_readable_message', 'ui_components'],
  },
}

/** Tool definition for agent-initiated feedback (when user confirms submission). */
const createFeedbackToolDefinition = {
  name: 'create_feedback',
  description: 'Call this when the user has confirmed they want to submit feedback for something the application cannot do. Only call after you have offered to submit feedback and the user has said yes (e.g. "submit", "yes", "send it") or provided additions.',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Full feedback text: summary of the request. Append any user addition if they provided one.',
      },
      category: {
        type: 'string',
        description: 'One of: bug, feature request, other, just a message.',
        enum: ['bug', 'feature request', 'other', 'just a message'],
      },
      email: {
        type: 'string',
        description: 'User email if they provided it for follow-up. Optional.',
      },
      user_addition: {
        type: 'string',
        description: 'Any extra text the user asked to add. Optional; also append to message.',
      },
    },
    required: ['message', 'category'],
  },
}

/** Tool: analyze a YouTube video (Pro only). Call when user asks to analyze a video by URL or ID. */
const youtubeAnalyzeVideoToolDefinition = {
  name: 'youtube_analyze_video',
  description: 'Call when the user asks to analyze a YouTube video (e.g. "analyze this video", "run video analytics on ..."). Requires Pro. Extract the video ID from the user message (from a URL like youtube.com/watch?v=ID or youtu.be/ID, or a raw 11-character video ID).',
  parameters: {
    type: 'object',
    properties: {
      video_id: {
        type: 'string',
        description: 'YouTube video ID or full URL (e.g. youtube.com/watch?v=xyz or xyz).',
      },
    },
    required: ['video_id'],
  },
}

/** Tool: create a style from 2–10 YouTube thumbnails (Pro + can_create_custom). Call when user asks to create a style from videos. */
const youtubeExtractStyleToolDefinition = {
  name: 'youtube_extract_style',
  description: 'Call when the user asks to create a new style from YouTube thumbnails (e.g. "extract a style from these videos", "create a style from my thumbnails"). Requires Pro and custom styles. Extract 2–10 video IDs from the user message (URLs or raw IDs).',
  parameters: {
    type: 'object',
    properties: {
      video_ids: {
        type: 'array',
        description: 'Array of 2–10 YouTube video IDs or URLs. Each entry can be a full URL or an 11-character video ID.',
        items: { type: 'string' },
      },
    },
    required: ['video_ids'],
  },
}

const assistantToolDefinitions = [
  assistantToolDefinition,
  createFeedbackToolDefinition,
  youtubeAnalyzeVideoToolDefinition,
  youtubeExtractStyleToolDefinition,
]
const assistantToolNames = ['generate_assistant_response', 'create_feedback', 'youtube_analyze_video', 'youtube_extract_style']

// Helper function to emit SSE event
function emitSSE(controller: ReadableStreamDefaultController, event: string, data: any) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  controller.enqueue(new TextEncoder().encode(message))
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await getOptionalAuth(supabase)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      )
    }

    // Check if streaming is requested
    const url = new URL(request.url)
    const streamMode = url.searchParams.get('stream') === 'true'

    const body: AssistantChatRequest = await request.json()

    if (!body.conversationHistory || !Array.isArray(body.conversationHistory)) {
      return NextResponse.json(
        { error: 'Invalid request: conversationHistory is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    if (!body.formState || typeof body.formState !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request: formState is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    const tierName = await getTierNameForUser(supabase, user.id)
    const hasYouTube = tierName === 'pro'

    // Build system prompt
    const systemPrompt = `You are an expert an creating viral thumbnails with perfect, catchy simple titles. Your role is to guide users through the thumbnail creation process by reasoning about their intent from the conversation and surfacing appropriate UI components.
    If the user seems unsure, you can go ahead and help by being proactive and fill in the details for them.

AVAILABLE UI COMPONENTS (return only 1-2 that match the user's current message):
- ThumbnailTextSection: For setting the thumbnail title/text.
- IncludeFaceSection: For configuring face integration (selecting faces, expressions, poses)
- StyleSelectionSection: For selecting a visual style for the thumbnail
- ColorPaletteSection: For selecting a color palette
- StyleReferencesSection: For uploading style reference images
- AspectRatioSection: For setting only aspect ratio (16:9, 1:1, 4:3, 9:16). Use when the user asks only about aspect ratio.
- ResolutionSection: For setting only resolution (1K, 2K, 4K). Use when the user asks only about resolution.
- AspectRatioResolutionSection: For setting both aspect ratio and resolution together. Use when the user asks for both; otherwise prefer AspectRatioSection or ResolutionSection alone.
- VariationsSection: For setting number of variations to generate (1-4)
- CustomInstructionsSection: For adding or editing custom instructions for thumbnail generation. Surface this when the user wants to provide specific instructions, requirements, or preferences for how the thumbnail should look or be generated.
- GenerateThumbnailButton: Only surface this when you have sufficient information to generate a thumbnail. This implies a request for user confirmation.
- RegisterNewFaceCard: Allows the user to register a new face character for use in thumbnails. Surface this when the user wants to add a new face to their library.
- RegisterNewStyleCard: Allows the user to register a new visual style for use in thumbnails. Surface this when the user wants to add a new style to their library.
- RegisterNewPaletteCard: Allows the user to register a new color palette for use in thumbnails. Surface this when the user wants to add a new palette to their library.

THUMBNAIL GENERATION REQUIREMENTS:
To generate a thumbnail, the following information is typically needed:
1. Thumbnail text/title (what the thumbnail is about) (text after a colon will be used as subtitles. For example: "AI is Here to Stay: What you need to know.")
2. Style selection (optional but recommended)
3. Color palette (optional but recommended)
4. Aspect ratio and resolution
5. Number of variations

Optional enhancements:
- Face integration (faces, expressions, poses)
- Style reference images
- Custom instructions

CURRENT FORM STATE:
- Thumbnail Text: ${body.formState.thumbnailText || '(not set)'}
- Include Face: ${body.formState.includeFace ? 'Yes' : 'No'}
- Selected Faces: ${body.formState.selectedFaces.length > 0 ? body.formState.selectedFaces.length + ' face(s)' : 'None'}
- Expression: ${body.formState.expression || 'None'}
- Pose: ${body.formState.pose || 'None'}
- Style References: ${body.formState.styleReferences.length > 0 ? body.formState.styleReferences.length + ' image(s)' : 'None'}
- Selected Style: ${body.formState.selectedStyle || 'None'}
- Selected Color Palette: ${body.formState.selectedColor || 'None'}
- Aspect Ratio: ${body.formState.selectedAspectRatio || '16:9'}
- Resolution: ${body.formState.selectedResolution || '1K'}
- Variations: ${body.formState.variations || 1}
- Custom Instructions: ${body.formState.customInstructions || '(not set)'}

AVAILABLE OPTIONS:
${body.availableStyles && body.availableStyles.length > 0 
  ? `Available Styles: ${body.availableStyles.map(s => `${s.name} (ID: ${s.id})`).join(', ')}`
  : 'Available Styles: (not provided)'}
${body.availablePalettes && body.availablePalettes.length > 0 
  ? `Available Palettes: ${body.availablePalettes.map(p => `${p.name} (ID: ${p.id})`).join(', ')}`
  : 'Available Palettes: (not provided)'}

AVAILABLE EXPRESSIONS:
Available Expressions: ${formatExpressionsForPrompt()}

AVAILABLE POSES:
Available Poses: ${formatPosesForPrompt()}

USER CAPABILITIES:
- Tier: ${tierName}. YouTube integration: ${hasYouTube ? 'available.' : 'not available; suggest upgrade to Pro.'}

INSTRUCTIONS:
1. Analyze the conversation history to understand user intent. Reason holistically about what the user wants.
2. Return only 1-2 ui_components that match what the user just asked for. For example: "Add my face" -> only IncludeFaceSection; "Pick a style" -> only StyleSelectionSection; "Set the title" -> only ThumbnailTextSection. Do NOT return many or all sections at once.
3. ALWAYS PRE-FILL: When you return a ui_component, you MUST also set form_state_updates so the surfaced section is pre-filled. Examples:
   - "Add my face" -> return IncludeFaceSection AND set form_state_updates: { includeFace: true }
   - "Make it more dramatic" -> return CustomInstructionsSection AND set form_state_updates: { customInstructions: "Make it more dramatic" }
   - "Set the title to How to Code" -> return ThumbnailTextSection AND set form_state_updates: { thumbnailText: "How to Code" }
   - "Use 16:9" -> return AspectRatioSection AND set form_state_updates: { selectedAspectRatio: "16:9" }
   - "Make it 2K resolution" -> return ResolutionSection AND set form_state_updates: { selectedResolution: "2K" }
   - "I want 3 variations" -> return VariationsSection AND set form_state_updates: { variations: 3 }
4. For custom instructions: Copy the user's instruction text verbatim into customInstructions (e.g., "Make it look realistic", "Add a glowing effect").
5. Only include GenerateThumbnailButton when you believe sufficient information has been gathered and the user is ready to generate.
6. Write a natural, conversational message that guides the user. Be helpful and friendly.
7. When you extract form state values, mention them naturally in your message (e.g., "I've set the title to 'How to Build a Website' as you mentioned", "I've enabled face integration for you").
8. Generate 2-3 relevant suggestions for what the user might want to do next.
9. YOUTUBE: If the user asks for YouTube-related actions (connect or disconnect YouTube, view channel or list videos, set thumbnail for a video, update video title, video analytics, extract style from thumbnails) and their tier is not Pro (see USER CAPABILITIES above), respond with a helpful message explaining that YouTube integration is available on the Pro plan, set offer_upgrade to true, set required_tier to "pro", and include a suggestion like "Upgrade to Pro to unlock YouTube". If they have Pro, you can use the YouTube tools below for analyze and extract-style.
10. YOUTUBE TOOLS (call only when USER CAPABILITIES shows "YouTube integration: available"): (a) When the user clearly asks to analyze a video (e.g. "analyze this video", "run video analytics on ...", "what's in this video"), call youtube_analyze_video with video_id set to the video ID or full URL from their message. (b) When the user clearly asks to create a style from 2–10 YouTube thumbnails (e.g. "extract a style from these videos", "create a style from my thumbnails", "make a style from video X and Y"), call youtube_extract_style with video_ids as an array of 2–10 video IDs or URLs parsed from their message. Parse video IDs from URLs like youtube.com/watch?v=ID or youtu.be/ID, or use raw 11-character IDs.

PRE-FILL MAPPING (when surfacing these components, set these values):
- IncludeFaceSection -> set includeFace: true when user wants to add their face. If the user has ATTACHED an image and asks to add it as their face (e.g. "add this as my face", "use this as my face"), also set add_attached_image_as_new_face: true and optionally new_face_name (e.g. "Me"); the backend will create a new face and upload the first attached image.
- ThumbnailTextSection -> set thumbnailText to the user's title/text
- CustomInstructionsSection -> set customInstructions to the user's instruction verbatim
- StyleSelectionSection -> set selectedStyle when user names a style
- ColorPaletteSection -> set selectedColor when user names a palette
- StyleReferencesSection -> set includeStyleReferences: true when user wants style reference images. If the user has ATTACHED images to this message and asks to add them to style references (e.g. "add this to my style references", "use this as a style reference"), also set add_attached_images_to_style_references: true; the backend will upload the attached images and add their URLs.
- AspectRatioSection -> set selectedAspectRatio when user specifies (16:9, 1:1, 4:3, 9:16)
- ResolutionSection -> set selectedResolution when user specifies (1K, 2K, 4K)
- VariationsSection -> set variations when user says how many (1-4)

IMPORTANT: 
- When you surface a ui_component, ALWAYS set the matching form_state_updates so the section is pre-filled for the user.
- Return only 1-2 ui_components per response that are directly relevant to the user's current message.
- The form_state_updates will automatically sync to the manual settings, keeping both interfaces in sync.

FEEDBACK FOR REQUESTS WE CAN'T DO:
- When the user asks for something the application cannot do (e.g. export to Figma, integrate with X, a feature that doesn't exist), or you cannot fulfill the request:
  1. First turn: Use generate_assistant_response. Explain that the app can't do that yet. Offer to submit feedback for the team. In your message, summarize what you would send (short message + category, e.g. "Feature request: Export thumbnails to Figma"). Ask: "Would you like me to submit this? You can say 'submit' or add anything you want included."
  2. Do NOT call create_feedback until the user has confirmed (e.g. "yes", "submit", "send it", "that's all", or provides additions).
  3. After confirmation: Call create_feedback with message (the full summary; append any user addition), category (one of: bug, feature request, other, just a message), and optional email if the user provided it. If the user said something like "add: make it work on mobile", append that to message.
- Keep thumbnail-creation flow unchanged; only use feedback when the request is out of scope.
- If the user says "submit" without a prior offer, use generate_assistant_response and ask what they want to submit; do not call create_feedback without a clear prior offer and confirmation.`

    // Validate and normalize attached images (allowlist MIME types)
    const ALLOWED_IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
    const attachedImages: Array<{ data: string; mimeType: string }> = []
    if (Array.isArray(body.attachedImages) && body.attachedImages.length > 0) {
      for (const item of body.attachedImages) {
        if (item && typeof item.data === 'string' && typeof item.mimeType === 'string' && ALLOWED_IMAGE_MIMES.includes(item.mimeType)) {
          attachedImages.push({ data: item.data, mimeType: item.mimeType })
        }
      }
    }
    const imageDataForGemini = attachedImages.length > 0 ? attachedImages : null
    const systemPromptWithImages = imageDataForGemini
      ? `${systemPrompt}\n\nThe user has attached one or more images to this message. Use them as visual reference for style, composition, or content when responding. If the user asks to add the attached image(s) to their style references (e.g. "add this to my style references", "use this as a style reference"), surface StyleReferencesSection, set add_attached_images_to_style_references to true and includeStyleReferences to true. If the user asks to add the attached image as their face (e.g. "add this as my face", "use this as my face"), surface IncludeFaceSection or RegisterNewFaceCard, set add_attached_image_as_new_face to true and optionally new_face_name (e.g. "Me"); the backend will create a new face from the first attached image.`
      : systemPrompt

    // Build user prompt from conversation history
    const conversationText = body.conversationHistory
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n')

    const userPrompt = `Conversation history:\n\n${conversationText}\n\nBased on this conversation and the current form state, generate an appropriate response with relevant UI components.`

    // If streaming mode, create a ReadableStream for SSE
    if (streamMode) {
      const stream = new ReadableStream({
        async start(controller) {
          try {
            // Emit initial status
            emitSSE(controller, 'status', {
              type: 'analyzing',
              message: 'Analyzing conversation...'
            })

            // Note: Gemini API does not support using googleSearch tool with function calling in the same request
            // We'll make two sequential calls:
            // 1. First call with googleSearch to get search results and grounding metadata
            // 2. Second call with function calling to get structured output, including search context
            
            let searchResults: any = null
            let groundingMetadata: any = undefined
            
            // Step 1: Make a search call to get grounding metadata
            emitSSE(controller, 'status', {
              type: 'searching',
              message: 'Searching for context...'
            })

            try {
              const searchApiKey = process.env.GEMINI_API_KEY
              if (!searchApiKey) {
                throw new Error('GEMINI_API_KEY environment variable is not set')
              }
              
              const searchUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
              
              const searchRequestBody = {
                contents: [
                  {
                    role: 'user',
                    parts: [
                      ...(systemPromptWithImages ? [{ text: systemPromptWithImages }] : []),
                      { text: userPrompt },
                    ],
                  },
                ],
                tools: [
                  {
                    googleSearch: {},
                  },
                ],
                generationConfig: {
                  temperature: 0.7,
                  topK: 40,
                  topP: 0.95,
                  maxOutputTokens: 8192,
                },
              }
              
              const searchResponse = await fetch(searchUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-goog-api-key': searchApiKey,
                },
                body: JSON.stringify(searchRequestBody),
              })
              
              if (searchResponse.ok) {
                const searchData = await searchResponse.json()
                groundingMetadata = searchData.candidates?.[0]?.groundingMetadata
                const searchText = searchData.candidates?.[0]?.content?.parts?.find(
                  (part: any) => part.text
                )?.text
                
                // Store search results to include in the function calling prompt
                if (searchText) {
                  searchResults = searchText
                }
              }
            } catch (error) {
              // If search fails, continue without it
              console.warn('Google Search failed, continuing without search results:', error)
            }
            
            // Step 2: Make function calling call with search results in context (if available)
            emitSSE(controller, 'status', {
              type: 'function_calling',
              message: 'Calling assistant...'
            })

            const enhancedUserPrompt = searchResults
              ? `${userPrompt}\n\n[Search Results Context: ${searchResults}]`
              : userPrompt

            const apiResult = await callGeminiWithFunctionCalling(
              systemPromptWithImages,
              enhancedUserPrompt,
              imageDataForGemini,
              assistantToolDefinitions,
              assistantToolNames,
              'gemini-2.5-flash',
              false
            ) as FunctionCallingResult

            if (!apiResult || typeof apiResult !== 'object' || !('functionName' in apiResult)) {
              throw new Error('Invalid response from AI service')
            }

            const functionName = apiResult.functionName
            const functionCallResult = apiResult.functionCallResult
            const finalGroundingMetadata = groundingMetadata ?? apiResult.groundingMetadata

            emitSSE(controller, 'tool_call', {
              function: functionName,
              status: 'calling'
            })
            emitSSE(controller, 'tool_call', {
              function: functionName,
              status: 'complete'
            })

            emitSSE(controller, 'status', {
              type: 'streaming',
              message: 'Generating response...'
            })

            // Branch: create_feedback (execute insert, synthetic message) vs generate_assistant_response (normal flow)
            if (functionName === 'create_feedback') {
              let feedbackMessage = 'I\'ve submitted your feedback to the team. We\'ll review it.'
              try {
                const args = functionCallResult as { message?: string; category?: string; email?: string; user_addition?: string }
                const message = typeof args.message === 'string' ? args.message.trim() : ''
                const category = typeof args.category === 'string' ? args.category.trim() : ''
                const userAddition = typeof args.user_addition === 'string' ? args.user_addition.trim() : ''
                const emailArg = typeof args.email === 'string' ? args.email.trim() || null : null
                const fullMessage = userAddition ? `${message}\n\nUser addition: ${userAddition}` : message
                if (!message || !category) {
                  feedbackMessage = 'I couldn\'t submit: missing message or category. Please try again.'
                } else {
                  const pageUrl = request.url || '/studio'
                  const userAgent = request.headers.get('user-agent') ?? ''
                  const email = emailArg ?? (user?.email ?? null)
                  await submitFeedbackFromServer({
                    message: fullMessage,
                    category,
                    email,
                    page_url: pageUrl,
                    app_version: APP_VERSION_FOR_FEEDBACK,
                    user_agent: userAgent,
                  })
                }
              } catch (err) {
                logError(err, { route: 'POST /api/assistant/chat', operation: 'create_feedback' })
                feedbackMessage = 'Something went wrong submitting your feedback. Please try again later or use the feedback form in the app.'
              }
              const messageChars = feedbackMessage.split('')
              for (let i = 0; i < messageChars.length; i += 5) {
                const chunk = messageChars.slice(i, i + 5).join('')
                emitSSE(controller, 'text_chunk', { chunk })
                await new Promise(resolve => setTimeout(resolve, 20))
              }
              emitSSE(controller, 'complete', {
                human_readable_message: feedbackMessage,
                ui_components: [],
                form_state_updates: undefined,
                suggestions: ['Continue with thumbnail', 'Share another idea'],
              })
              controller.close()
              return
            }

            // youtube_analyze_video: run analysis, return youtube_analytics for client to open modal
            if (functionName === 'youtube_analyze_video') {
              if (tierName !== 'pro') {
                emitSSE(controller, 'complete', {
                  human_readable_message: 'YouTube video analysis is available on the Pro plan. Upgrade to analyze videos from the chat.',
                  ui_components: [],
                  form_state_updates: undefined,
                  suggestions: ['Upgrade to Pro', 'Continue with thumbnail'],
                  offer_upgrade: true,
                  required_tier: 'pro',
                })
                controller.close()
                return
              }
              const videoIdRaw = (functionCallResult as { video_id?: string })?.video_id
              const videoId = typeof videoIdRaw === 'string' ? parseYouTubeVideoId(videoIdRaw.trim()) : null
              if (!videoId) {
                emitSSE(controller, 'complete', {
                  human_readable_message: 'I couldn\'t find a valid YouTube video ID in that message. Please share a video link (e.g. youtube.com/watch?v=...) or the 11-character video ID.',
                  ui_components: [],
                  form_state_updates: undefined,
                  suggestions: ['Try another video', 'Continue with thumbnail'],
                })
                controller.close()
                return
              }
              try {
                const origin = new URL(request.url).origin
                const analyzeRes = await fetch(`${origin}/api/youtube/videos/analyze`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Cookie: request.headers.get('cookie') ?? '',
                  },
                  body: JSON.stringify({ videoId }),
                })
                if (!analyzeRes.ok) {
                  const errData = await analyzeRes.json().catch(() => ({}))
                  const errMsg = errData?.error ?? 'Video analysis failed. The video may be private or unavailable.'
                  emitSSE(controller, 'complete', {
                    human_readable_message: errMsg,
                    ui_components: [],
                    form_state_updates: undefined,
                    suggestions: ['Try another video', 'Continue with thumbnail'],
                  })
                  controller.close()
                  return
                }
                const analyzeData = await analyzeRes.json()
                const analytics = analyzeData?.analytics
                if (!analytics) {
                  emitSSE(controller, 'complete', {
                    human_readable_message: 'Video analysis could not be completed. Try again or a different video.',
                    ui_components: [],
                    form_state_updates: undefined,
                    suggestions: ['Try another video', 'Continue with thumbnail'],
                  })
                  controller.close()
                  return
                }
                const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
                emitSSE(controller, 'complete', {
                  human_readable_message: "I've analyzed the video. Opening the analytics panel with the summary, topic, key moments, and more.",
                  ui_components: [],
                  form_state_updates: undefined,
                  suggestions: ['Analyze another video', 'Create a thumbnail', 'Continue with thumbnail'],
                  youtube_analytics: {
                    videoId,
                    title: 'Video',
                    thumbnailUrl,
                    analytics,
                  },
                })
                controller.close()
                return
              } catch (analyzeErr) {
                logError(analyzeErr as Error, { route: 'POST /api/assistant/chat', operation: 'youtube_analyze_video' })
                emitSSE(controller, 'complete', {
                  human_readable_message: 'Something went wrong analyzing the video. Please try again.',
                  ui_components: [],
                  form_state_updates: undefined,
                  suggestions: ['Try another video', 'Continue with thumbnail'],
                })
                controller.close()
                return
              }
            }

            // youtube_extract_style: extract style from thumbnails, create style, return form_state_updates
            if (functionName === 'youtube_extract_style') {
              if (tierName !== 'pro') {
                emitSSE(controller, 'complete', {
                  human_readable_message: 'Creating a style from YouTube thumbnails is available on the Pro plan. Upgrade to use this feature.',
                  ui_components: [],
                  form_state_updates: undefined,
                  suggestions: ['Upgrade to Pro', 'Continue with thumbnail'],
                  offer_upgrade: true,
                  required_tier: 'pro',
                })
                controller.close()
                return
              }
              const tier = await getTierForUser(supabase, user.id)
              if (!tier.can_create_custom) {
                emitSSE(controller, 'complete', {
                  human_readable_message: 'Creating custom styles from YouTube thumbnails requires Starter or higher. Upgrade to unlock.',
                  ui_components: [],
                  form_state_updates: undefined,
                  suggestions: ['Upgrade to unlock', 'Continue with thumbnail'],
                  offer_upgrade: true,
                  required_tier: 'pro',
                })
                controller.close()
                return
              }
              const videoIdsRaw = (functionCallResult as { video_ids?: string[] })?.video_ids
              const videoIds = parseYouTubeVideoIds(Array.isArray(videoIdsRaw) ? videoIdsRaw : [])
              if (videoIds.length < EXTRACT_MIN_IMAGES || videoIds.length > EXTRACT_MAX_IMAGES) {
                emitSSE(controller, 'complete', {
                  human_readable_message: `Please provide between ${EXTRACT_MIN_IMAGES} and ${EXTRACT_MAX_IMAGES} YouTube video links or IDs to extract a common style.`,
                  ui_components: [],
                  form_state_updates: undefined,
                  suggestions: ['Add more videos', 'Continue with thumbnail'],
                })
                controller.close()
                return
              }
              try {
                const thumbnailUrls = videoIds.map((id) => `https://img.youtube.com/vi/${id}/maxresdefault.jpg`)
                const result = await extractStyleFromImageUrls(supabase, user.id, thumbnailUrls)
                const styleData: StyleInsert = {
                  user_id: user.id,
                  name: result.name,
                  description: result.description || null,
                  prompt: result.prompt || null,
                  reference_images: result.reference_images,
                  colors: [],
                  is_default: false,
                }
                const { data: style, error: insertError } = await supabase
                  .from('styles')
                  .insert(styleData)
                  .select('id, name')
                  .single()
                if (insertError || !style) {
                  logError(insertError as Error, { route: 'POST /api/assistant/chat', operation: 'youtube_extract_style_insert' })
                  emitSSE(controller, 'complete', {
                    human_readable_message: 'Style extraction succeeded but saving the style failed. Please try again.',
                    ui_components: [],
                    form_state_updates: undefined,
                    suggestions: ['Try again', 'Continue with thumbnail'],
                  })
                  controller.close()
                  return
                }
                emitSSE(controller, 'complete', {
                  human_readable_message: `I've created a new style "${style.name}" from the thumbnails you chose. I've selected it for you—you can use it for your next generation.`,
                  ui_components: ['StyleSelectionSection'],
                  form_state_updates: { selectedStyle: style.id },
                  suggestions: ['Generate a thumbnail', 'Change the style', 'Continue with thumbnail'],
                  youtube_extract_style: { styleId: style.id, styleName: style.name ?? result.name },
                })
                controller.close()
                return
              } catch (extractErr) {
                logError(extractErr as Error, { route: 'POST /api/assistant/chat', operation: 'youtube_extract_style' })
                const msg = extractErr instanceof Error ? extractErr.message : 'Style extraction failed.'
                emitSSE(controller, 'complete', {
                  human_readable_message: msg.includes('fetch') ? 'Could not load one or more thumbnails. Check that the video IDs or URLs are valid and public.' : 'Something went wrong extracting the style. Please try again.',
                  ui_components: [],
                  form_state_updates: undefined,
                  suggestions: ['Try different videos', 'Continue with thumbnail'],
                })
                controller.close()
                return
              }
            }

            if (!functionCallResult || typeof functionCallResult !== 'object') {
              throw new Error('Invalid function call result from AI service')
            }

            // generate_assistant_response flow
            let humanReadableMessage = (functionCallResult as { human_readable_message?: string }).human_readable_message || 'I\'m here to help you create thumbnails!'

            // Process citations if grounding metadata is present
            // Note: The grounding metadata is from the search call, so citations may not perfectly align
            // with the function calling response text, but we'll do our best to insert them
            if (finalGroundingMetadata) {
              humanReadableMessage = processGroundingCitations(finalGroundingMetadata, humanReadableMessage)
            }

            // Stream the message character by character for UX (simulated streaming)
            const messageChars = humanReadableMessage.split('')
            for (let i = 0; i < messageChars.length; i += 5) {
              const chunk = messageChars.slice(i, i + 5).join('')
              emitSSE(controller, 'text_chunk', { chunk })
              // Small delay to simulate streaming
              await new Promise(resolve => setTimeout(resolve, 20))
            }

            // Debug logging to see what the AI returned
            console.log('[API] Function call result:', JSON.stringify(functionCallResult, null, 2));
            console.log('[API] form_state_updates from AI:', functionCallResult.form_state_updates);
            console.log('[API] customInstructions in form_state_updates:', functionCallResult.form_state_updates?.customInstructions);

            // If agent asked to add attached images to style references, upload and merge URLs
            let formStateUpdates = functionCallResult.form_state_updates
            if (user && attachedImages.length > 0) {
              const styleEnriched = await enrichFormStateWithAttachedStyleReferences(
                supabase,
                user.id,
                body.formState.styleReferences ?? [],
                attachedImages,
                formStateUpdates
              )
              if (styleEnriched) formStateUpdates = styleEnriched as typeof functionCallResult.form_state_updates
              const faceEnriched = await enrichFormStateWithNewFaceFromAttachedImage(
                supabase,
                user.id,
                body.formState.selectedFaces ?? [],
                attachedImages,
                formStateUpdates
              )
              if (faceEnriched) formStateUpdates = faceEnriched as typeof functionCallResult.form_state_updates
            }

            const response: AssistantChatResponse = {
              human_readable_message: humanReadableMessage,
              ui_components: Array.isArray(functionCallResult.ui_components) 
                ? functionCallResult.ui_components.filter((comp: string) => 
                    [
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
                    ].includes(comp)
                  )
                : [],
              form_state_updates: stripServerOnlyFormUpdates(formStateUpdates as Record<string, unknown>),
              suggestions: Array.isArray(functionCallResult.suggestions) 
                ? functionCallResult.suggestions 
                : [],
              offer_upgrade: !!(functionCallResult as { offer_upgrade?: boolean }).offer_upgrade,
              required_tier: (functionCallResult as { required_tier?: string }).required_tier,
            }

            console.log('[API] Final response form_state_updates:', response.form_state_updates);

            // Emit complete event with final response
            emitSSE(controller, 'complete', response)
            controller.close()
          } catch (error) {
            emitSSE(controller, 'error', {
              error: error instanceof Error ? error.message : 'Failed to process chat request',
              code: 'INTERNAL_ERROR'
            })
            controller.close()
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    }

    // Non-streaming mode (original behavior)
    // Note: Gemini API does not support using googleSearch tool with function calling in the same request
    // We'll make two sequential calls:
    // 1. First call with googleSearch to get search results and grounding metadata
    // 2. Second call with function calling to get structured output, including search context
    
    let searchResults: any = null
    let groundingMetadata: any = undefined
    
    // Step 1: Make a search call to get grounding metadata
    try {
      const searchApiKey = process.env.GEMINI_API_KEY
      if (!searchApiKey) {
        throw new Error('GEMINI_API_KEY environment variable is not set')
      }
      
      const searchUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`
      
      const searchRequestBody = {
        contents: [
          {
            role: 'user',
            parts: [
              ...(systemPromptWithImages ? [{ text: systemPromptWithImages }] : []),
              { text: userPrompt },
            ],
          },
        ],
        tools: [
          {
            googleSearch: {},
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      }
      
      const searchResponse = await fetch(searchUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': searchApiKey,
        },
        body: JSON.stringify(searchRequestBody),
      })
      
      if (searchResponse.ok) {
        const searchData = await searchResponse.json()
        groundingMetadata = searchData.candidates?.[0]?.groundingMetadata
        const searchText = searchData.candidates?.[0]?.content?.parts?.find(
          (part: any) => part.text
        )?.text
        
        // Store search results to include in the function calling prompt
        if (searchText) {
          searchResults = searchText
        }
      }
    } catch (error) {
      // If search fails, continue without it
      console.warn('Google Search failed, continuing without search results:', error)
    }
    
    // Step 2: Make function calling call with search results in context (if available)
    const enhancedUserPrompt = searchResults
      ? `${userPrompt}\n\n[Search Results Context: ${searchResults}]`
      : userPrompt

    const apiResult = await callGeminiWithFunctionCalling(
      systemPromptWithImages,
      enhancedUserPrompt,
      imageDataForGemini,
      assistantToolDefinitions,
      assistantToolNames,
      'gemini-2.5-flash',
      false
    ) as FunctionCallingResult

    if (!apiResult || typeof apiResult !== 'object' || !('functionName' in apiResult)) {
      throw new Error('Invalid response from AI service')
    }

    const functionName = apiResult.functionName
    const functionCallResult = apiResult.functionCallResult
    const finalGroundingMetadata = groundingMetadata ?? apiResult.groundingMetadata

    // Branch: create_feedback (execute insert, synthetic response) vs generate_assistant_response (normal flow)
    if (functionName === 'create_feedback') {
      let feedbackMessage = 'I\'ve submitted your feedback to the team. We\'ll review it.'
      try {
        const args = functionCallResult as { message?: string; category?: string; email?: string; user_addition?: string }
        const message = typeof args.message === 'string' ? args.message.trim() : ''
        const category = typeof args.category === 'string' ? args.category.trim() : ''
        const userAddition = typeof args.user_addition === 'string' ? args.user_addition.trim() : ''
        const emailArg = typeof args.email === 'string' ? args.email.trim() || null : null
        const fullMessage = userAddition ? `${message}\n\nUser addition: ${userAddition}` : message
        if (!message || !category) {
          feedbackMessage = 'I couldn\'t submit: missing message or category. Please try again.'
        } else {
          const pageUrl = request.url || '/studio'
          const userAgent = request.headers.get('user-agent') ?? ''
          const email = emailArg ?? (user?.email ?? null)
          await submitFeedbackFromServer({
            message: fullMessage,
            category,
            email,
            page_url: pageUrl,
            app_version: APP_VERSION_FOR_FEEDBACK,
            user_agent: userAgent,
          })
        }
      } catch (err) {
        logError(err, { route: 'POST /api/assistant/chat', operation: 'create_feedback' })
        feedbackMessage = 'Something went wrong submitting your feedback. Please try again later or use the feedback form in the app.'
      }
      return NextResponse.json({
        human_readable_message: feedbackMessage,
        ui_components: [],
        form_state_updates: undefined,
        suggestions: ['Continue with thumbnail', 'Share another idea'],
      })
    }

    // youtube_analyze_video (non-streaming): run analysis, return youtube_analytics for client to open modal
    if (functionName === 'youtube_analyze_video') {
      if (!user) {
        return NextResponse.json({
          human_readable_message: 'You need to be signed in to analyze a YouTube video.',
          ui_components: [],
          form_state_updates: undefined,
          suggestions: ['Continue with thumbnail'],
        })
      }
      const tierName = await getTierNameForUser(supabase, user.id)
      if (tierName !== 'pro') {
        return NextResponse.json({
          human_readable_message: 'YouTube video analysis is available on the Pro plan. Upgrade to analyze videos from the chat.',
          ui_components: [],
          form_state_updates: undefined,
          suggestions: ['Upgrade to Pro', 'Continue with thumbnail'],
          offer_upgrade: true,
          required_tier: 'pro',
        })
      }
      const videoIdRaw = (functionCallResult as { video_id?: string })?.video_id
      const videoId = typeof videoIdRaw === 'string' ? parseYouTubeVideoId(videoIdRaw.trim()) : null
      if (!videoId) {
        return NextResponse.json({
          human_readable_message: 'I couldn\'t find a valid YouTube video ID in that message. Please share a video link (e.g. youtube.com/watch?v=...) or the 11-character video ID.',
          ui_components: [],
          form_state_updates: undefined,
          suggestions: ['Try another video', 'Continue with thumbnail'],
        })
      }
      try {
        const origin = new URL(request.url).origin
        const analyzeRes = await fetch(`${origin}/api/youtube/videos/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: request.headers.get('cookie') ?? '',
          },
          body: JSON.stringify({ videoId }),
        })
        if (!analyzeRes.ok) {
          const errData = await analyzeRes.json().catch(() => ({}))
          const errMsg = errData?.error ?? 'Video analysis failed. The video may be private or unavailable.'
          return NextResponse.json({
            human_readable_message: errMsg,
            ui_components: [],
            form_state_updates: undefined,
            suggestions: ['Try another video', 'Continue with thumbnail'],
          })
        }
        const analyzeData = await analyzeRes.json()
        const analytics = analyzeData?.analytics
        if (!analytics) {
          return NextResponse.json({
            human_readable_message: 'Video analysis could not be completed. Try again or a different video.',
            ui_components: [],
            form_state_updates: undefined,
            suggestions: ['Try another video', 'Continue with thumbnail'],
          })
        }
        const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        return NextResponse.json({
          human_readable_message: "I've analyzed the video. Opening the analytics panel with the summary, topic, key moments, and more.",
          ui_components: [],
          form_state_updates: undefined,
          suggestions: ['Analyze another video', 'Create a thumbnail', 'Continue with thumbnail'],
          youtube_analytics: {
            videoId,
            title: 'Video',
            thumbnailUrl,
            analytics,
          },
        })
      } catch (analyzeErr) {
        logError(analyzeErr as Error, { route: 'POST /api/assistant/chat', operation: 'youtube_analyze_video' })
        return NextResponse.json({
          human_readable_message: 'Something went wrong analyzing the video. Please try again.',
          ui_components: [],
          form_state_updates: undefined,
          suggestions: ['Try another video', 'Continue with thumbnail'],
        })
      }
    }

    // youtube_extract_style (non-streaming): extract style from thumbnails, create style, return form_state_updates
    if (functionName === 'youtube_extract_style') {
      if (!user) {
        return NextResponse.json({
          human_readable_message: 'You need to be signed in to create a style from YouTube thumbnails.',
          ui_components: [],
          form_state_updates: undefined,
          suggestions: ['Continue with thumbnail'],
        })
      }
      const tierName = await getTierNameForUser(supabase, user.id)
      if (tierName !== 'pro') {
        return NextResponse.json({
          human_readable_message: 'Creating a style from YouTube thumbnails is available on the Pro plan. Upgrade to use this feature.',
          ui_components: [],
          form_state_updates: undefined,
          suggestions: ['Upgrade to Pro', 'Continue with thumbnail'],
          offer_upgrade: true,
          required_tier: 'pro',
        })
      }
      const tier = await getTierForUser(supabase, user.id)
      if (!tier.can_create_custom) {
        return NextResponse.json({
          human_readable_message: 'Creating custom styles from YouTube thumbnails requires Starter or higher. Upgrade to unlock.',
          ui_components: [],
          form_state_updates: undefined,
          suggestions: ['Upgrade to unlock', 'Continue with thumbnail'],
          offer_upgrade: true,
          required_tier: 'pro',
        })
      }
      const videoIdsRaw = (functionCallResult as { video_ids?: string[] })?.video_ids
      const videoIds = parseYouTubeVideoIds(Array.isArray(videoIdsRaw) ? videoIdsRaw : [])
      if (videoIds.length < EXTRACT_MIN_IMAGES || videoIds.length > EXTRACT_MAX_IMAGES) {
        return NextResponse.json({
          human_readable_message: `Please provide between ${EXTRACT_MIN_IMAGES} and ${EXTRACT_MAX_IMAGES} YouTube video links or IDs to extract a common style.`,
          ui_components: [],
          form_state_updates: undefined,
          suggestions: ['Add more videos', 'Continue with thumbnail'],
        })
      }
      try {
        const thumbnailUrls = videoIds.map((id) => `https://img.youtube.com/vi/${id}/maxresdefault.jpg`)
        const result = await extractStyleFromImageUrls(supabase, user.id, thumbnailUrls)
        const styleData: StyleInsert = {
          user_id: user.id,
          name: result.name,
          description: result.description || null,
          prompt: result.prompt || null,
          reference_images: result.reference_images,
          colors: [],
          is_default: false,
        }
        const { data: style, error: insertError } = await supabase
          .from('styles')
          .insert(styleData)
          .select('id, name')
          .single()
        if (insertError || !style) {
          logError(insertError as Error, { route: 'POST /api/assistant/chat', operation: 'youtube_extract_style_insert' })
          return NextResponse.json({
            human_readable_message: 'Style extraction succeeded but saving the style failed. Please try again.',
            ui_components: [],
            form_state_updates: undefined,
            suggestions: ['Try again', 'Continue with thumbnail'],
          })
        }
        return NextResponse.json({
          human_readable_message: `I've created a new style "${style.name}" from the thumbnails you chose. I've selected it for you—you can use it for your next generation.`,
          ui_components: ['StyleSelectionSection'],
          form_state_updates: { selectedStyle: style.id },
          suggestions: ['Generate a thumbnail', 'Change the style', 'Continue with thumbnail'],
          youtube_extract_style: { styleId: style.id, styleName: style.name ?? result.name },
        })
      } catch (extractErr) {
        logError(extractErr as Error, { route: 'POST /api/assistant/chat', operation: 'youtube_extract_style' })
        const msg = extractErr instanceof Error ? extractErr.message : 'Style extraction failed.'
        return NextResponse.json({
          human_readable_message: msg.includes('fetch') ? 'Could not load one or more thumbnails. Check that the video IDs or URLs are valid and public.' : 'Something went wrong extracting the style. Please try again.',
          ui_components: [],
          form_state_updates: undefined,
          suggestions: ['Try different videos', 'Continue with thumbnail'],
        })
      }
    }

    if (!functionCallResult || typeof functionCallResult !== 'object') {
      throw new Error('Invalid function call result from AI service')
    }

    // generate_assistant_response flow
    let humanReadableMessage = (functionCallResult as { human_readable_message?: string }).human_readable_message || 'I\'m here to help you create thumbnails!'

    // Process citations if grounding metadata is present
    // Note: The grounding metadata is from the search call, so citations may not perfectly align
    // with the function calling response text, but we'll do our best to insert them
    if (finalGroundingMetadata) {
      humanReadableMessage = processGroundingCitations(finalGroundingMetadata, humanReadableMessage)
    }

    // Debug logging to see what the AI returned
    console.log('[API] Function call result:', JSON.stringify(functionCallResult, null, 2));
    console.log('[API] form_state_updates from AI:', functionCallResult.form_state_updates);
    console.log('[API] customInstructions in form_state_updates:', functionCallResult.form_state_updates?.customInstructions);

    // If agent asked to add attached images to style references or as new face, upload and merge
    let formStateUpdates = functionCallResult.form_state_updates
    if (user && attachedImages.length > 0) {
      const styleEnriched = await enrichFormStateWithAttachedStyleReferences(
        supabase,
        user.id,
        body.formState.styleReferences ?? [],
        attachedImages,
        formStateUpdates
      )
      if (styleEnriched) formStateUpdates = styleEnriched as typeof functionCallResult.form_state_updates
      const faceEnriched = await enrichFormStateWithNewFaceFromAttachedImage(
        supabase,
        user.id,
        body.formState.selectedFaces ?? [],
        attachedImages,
        formStateUpdates
      )
      if (faceEnriched) formStateUpdates = faceEnriched as typeof functionCallResult.form_state_updates
    }

    const response: AssistantChatResponse = {
      human_readable_message: humanReadableMessage,
      ui_components: Array.isArray(functionCallResult.ui_components) 
        ? functionCallResult.ui_components.filter((comp: string) => 
            [
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
            ].includes(comp)
          )
        : [],
      form_state_updates: stripServerOnlyFormUpdates(formStateUpdates as Record<string, unknown>),
      suggestions: Array.isArray(functionCallResult.suggestions) 
        ? functionCallResult.suggestions 
        : [],
      offer_upgrade: !!(functionCallResult as { offer_upgrade?: boolean }).offer_upgrade,
      required_tier: (functionCallResult as { required_tier?: string }).required_tier,
    }

    console.log('[API] Final response form_state_updates:', response.form_state_updates);

    return NextResponse.json(response)
  } catch (error) {
    logError(error as Error, {
      route: 'assistant/chat',
      operation: 'POST',
    })

    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to process chat request',
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
