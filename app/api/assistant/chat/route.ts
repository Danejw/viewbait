/**
 * AI Assistant Chat API Route
 * 
 * Handles chat interactions with the AI assistant for thumbnail generation.
 * Uses Gemini API to reason about user intent and surface appropriate UI components.
 */

import { createClient } from '@/lib/supabase/server'
import { getOptionalAuth } from '@/lib/server/utils/auth'
import { NextResponse } from 'next/server'
import { callGeminiWithFunctionCalling, type FunctionCallingWithGroundingResult } from '@/lib/services/ai-core'
import { processGroundingCitations } from '@/lib/utils/citation-processor'
import { logError } from '@/lib/server/utils/logger'
import { getExpressionValues, getPoseValues, formatExpressionsForPrompt, formatPosesForPrompt } from '@/lib/constants/face-options'

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
  }
  suggestions?: string[]
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
        },
      },
      suggestions: {
        type: 'array',
        description: 'Array of 2-3 short, actionable suggestions for what the user might want to do next. Each suggestion should be a concise phrase (e.g., "Change the style to minimalist", "Add my face to the thumbnail", "Generate the thumbnail now"). Suggestions should be relevant to the current conversation context and help guide the user through the thumbnail creation process.',
        items: {
          type: 'string',
        },
      },
    },
    required: ['human_readable_message', 'ui_components'],
  },
}

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

PRE-FILL MAPPING (when surfacing these components, set these values):
- IncludeFaceSection -> set includeFace: true when user wants to add their face
- ThumbnailTextSection -> set thumbnailText to the user's title/text
- CustomInstructionsSection -> set customInstructions to the user's instruction verbatim
- StyleSelectionSection -> set selectedStyle when user names a style
- ColorPaletteSection -> set selectedColor when user names a palette
- AspectRatioSection -> set selectedAspectRatio when user specifies (16:9, 1:1, 4:3, 9:16)
- ResolutionSection -> set selectedResolution when user specifies (1K, 2K, 4K)
- VariationsSection -> set variations when user says how many (1-4)

IMPORTANT: 
- When you surface a ui_component, ALWAYS set the matching form_state_updates so the section is pre-filled for the user.
- Return only 1-2 ui_components per response that are directly relevant to the user's current message.
- The form_state_updates will automatically sync to the manual settings, keeping both interfaces in sync.`

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
                      ...(systemPrompt ? [{ text: systemPrompt }] : []),
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
              message: 'Calling generate_assistant_response function...'
            })

            emitSSE(controller, 'tool_call', {
              function: 'generate_assistant_response',
              status: 'calling'
            })

            const enhancedUserPrompt = searchResults
              ? `${userPrompt}\n\n[Search Results Context: ${searchResults}]`
              : userPrompt
            
            const apiResult = await callGeminiWithFunctionCalling(
              systemPrompt,
              enhancedUserPrompt,
              null, // No image data
              assistantToolDefinition,
              'generate_assistant_response',
              'gemini-2.5-flash', // Use a model that supports function calling
              false // Disable Google Search (we already did the search call above)
            )

            if (!apiResult || typeof apiResult !== 'object') {
              throw new Error('Invalid response from AI service')
            }

            // Mark tool call as complete
            emitSSE(controller, 'tool_call', {
              function: 'generate_assistant_response',
              status: 'complete'
            })

            emitSSE(controller, 'status', {
              type: 'streaming',
              message: 'Generating response...'
            })

            // Handle both old format (just function call args) and new format (with grounding metadata)
            let functionCallResult: any
            let finalGroundingMetadata: FunctionCallingWithGroundingResult['groundingMetadata'] = groundingMetadata

            if ('functionCallResult' in apiResult && 'groundingMetadata' in apiResult) {
              // New format with grounding metadata
              functionCallResult = apiResult.functionCallResult
              // Prefer grounding metadata from search call if available
              finalGroundingMetadata = groundingMetadata || apiResult.groundingMetadata
            } else {
              // Old format (backward compatibility)
              functionCallResult = apiResult
              // Use grounding metadata from search call if available
              finalGroundingMetadata = groundingMetadata
            }

            if (!functionCallResult || typeof functionCallResult !== 'object') {
              throw new Error('Invalid function call result from AI service')
            }

            // Get the original message
            let humanReadableMessage = functionCallResult.human_readable_message || 'I\'m here to help you create thumbnails!'

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
              form_state_updates: functionCallResult.form_state_updates || undefined,
              suggestions: Array.isArray(functionCallResult.suggestions) 
                ? functionCallResult.suggestions 
                : [],
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
              ...(systemPrompt ? [{ text: systemPrompt }] : []),
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
      systemPrompt,
      enhancedUserPrompt,
      null, // No image data
      assistantToolDefinition,
      'generate_assistant_response',
      'gemini-2.5-flash', // Use a model that supports function calling
      false // Disable Google Search (we already did the search call above)
    )

    if (!apiResult || typeof apiResult !== 'object') {
      throw new Error('Invalid response from AI service')
    }

    // Handle both old format (just function call args) and new format (with grounding metadata)
    let functionCallResult: any
    let finalGroundingMetadata: FunctionCallingWithGroundingResult['groundingMetadata'] = groundingMetadata

    if ('functionCallResult' in apiResult && 'groundingMetadata' in apiResult) {
      // New format with grounding metadata
      functionCallResult = apiResult.functionCallResult
      // Prefer grounding metadata from search call if available
      finalGroundingMetadata = groundingMetadata || apiResult.groundingMetadata
    } else {
      // Old format (backward compatibility)
      functionCallResult = apiResult
      // Use grounding metadata from search call if available
      finalGroundingMetadata = groundingMetadata
    }

    if (!functionCallResult || typeof functionCallResult !== 'object') {
      throw new Error('Invalid function call result from AI service')
    }

    // Get the original message
    let humanReadableMessage = functionCallResult.human_readable_message || 'I\'m here to help you create thumbnails!'

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
      form_state_updates: functionCallResult.form_state_updates || undefined,
      suggestions: Array.isArray(functionCallResult.suggestions) 
        ? functionCallResult.suggestions 
        : [],
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
