/**
 * Style Analysis API Route
 * 
 * Handles style analysis using Google Gemini API.
 * Handles image uploads to storage and analyzes images with AI.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { callGeminiWithFunctionCalling } from '@/lib/services/ai-core'
import { fetchImageAsBase64 } from '@/lib/utils/ai-helpers'
import { requireAuth } from '@/lib/server/utils/auth'
import {
  validationErrorResponse,
  configErrorResponse,
  aiServiceErrorResponse,
  serverErrorResponse,
  tierLimitResponse,
} from '@/lib/server/utils/error-handler'
import { getTierForUser } from '@/lib/server/utils/tier'

export interface AnalyzeStyleRequest {
  imageUrls?: string[]
  // If imageUrls is not provided, we expect FormData with 'images' files
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tier = await getTierForUser(supabase, user.id)
    if (!tier.can_create_custom) {
      return tierLimitResponse('Custom styles, palettes, and faces require Starter or higher.')
    }

    let imageUrls: string[]

    // Check if request is FormData (file upload) or JSON (URLs)
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      // Handle file uploads
      const formData = await request.formData()
      const imageFiles = formData.getAll('images') as File[]

      if (imageFiles.length === 0) {
        return validationErrorResponse('At least one image file is required')
      }

      // Validate and upload files
      const uploadedUrls: string[] = []
      const tempId = crypto.randomUUID()

      for (let i = 0; i < imageFiles.length; i++) {
        const imageFile = imageFiles[i]

        // Validate file type
        if (!imageFile.type.startsWith('image/')) {
          return validationErrorResponse(`File ${i + 1} must be an image`)
        }

        // Validate file size (max 10MB)
        if (imageFile.size > 10 * 1024 * 1024) {
          return validationErrorResponse(`Image ${i + 1} size must be less than 10MB`)
        }

        // Upload to storage
        const storagePath = `${user.id}/${tempId}-${i}.${imageFile.name.split('.').pop() || 'png'}`
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('style-references')
          .upload(storagePath, imageFile, {
            cacheControl: '3600',
            upsert: true,
          })

        if (uploadError || !uploadData) {
          return NextResponse.json(
            { error: `Failed to upload image ${i + 1}`, code: 'UPLOAD_ERROR' },
            { status: 500 }
          )
        }

        // Get signed URL for the uploaded file
        const { data: urlData } = await supabase.storage
          .from('style-references')
          .createSignedUrl(storagePath, 3600)

        if (urlData?.signedUrl) {
          uploadedUrls.push(urlData.signedUrl)
        }
      }

      imageUrls = uploadedUrls
    } else {
      // Handle JSON with imageUrls
      const body: AnalyzeStyleRequest = await request.json()
      
      if (!body.imageUrls || body.imageUrls.length === 0) {
        return validationErrorResponse('At least one image URL is required')
      }

      imageUrls = body.imageUrls
    }

    // Check if AI service is configured
    if (!process.env.GEMINI_API_KEY) {
      return configErrorResponse('AI service not configured')
    }

    // Fetch and convert first image to base64 (Gemini may support multiple, but start with one)
    const imageData = await fetchImageAsBase64(imageUrls[0])
    if (!imageData) {
      return aiServiceErrorResponse(
        new Error('Failed to fetch or process image'),
        'Failed to fetch or process image',
        { route: 'POST /api/analyze-style', userId: user.id }
      )
    }

    // Build prompts inline (server-side only - prompts never exposed to frontend)
    const userPrompt = `You are an expert visual style analyst for thumbnails. Analyze this image and extract its visual style characteristics.

Your task is to:
1. Identify the key visual elements: colors, lighting, composition, typography style, effects (glow, shadows, gradients), mood/emotion
2. Create a catchy, memorable style name (2 words max) that captures the essence
3. Write a brief description (1 sentence) explaining what makes this style distinctive
4. Write a detailed generation prompt (100-200 words) that would allow an AI to recreate this exact visual style for YouTube thumbnails

Focus on:
- Color palette and color grading
- Lighting style (dramatic, soft, neon, natural)
- Composition techniques
- Text/typography treatment if visible (but do not include the actual text in the description. Can you describe its styling)
- Special effects (blur, glow, grain, etc.)
- Overall mood and energy

Keep the description that is no more than one paragraph long. Use concise, clear language. 
DO NOT mention "YouTube"
Start with "This style is a" and then describe the style.

You MUST call the extract_style_info function with your analysis.`

    const toolDefinition = {
      name: 'extract_style_info',
      description: 'Extract structured style information from the image analysis',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'A catchy, memorable style name (2-4 words) like "Neon Cyberpunk", "Vintage Film Noir", "Bold Pop Art"',
          },
          description: {
            type: 'string',
            description: 'A brief 1-2 sentence description of what makes this style distinctive',
          },
          prompt: {
            type: 'string',
            description: 'A detailed generation prompt (100-200 words) describing the visual style for AI image generation, including colors, lighting, effects, composition, and mood',
          },
        },
        required: ['name', 'description', 'prompt'],
      },
    }

    // Call AI core service (returns { functionName, functionCallResult, groundingMetadata? })
    let raw
    try {
      raw = await callGeminiWithFunctionCalling(
        null, // No system prompt for style analysis
        userPrompt,
        imageData,
        toolDefinition,
        'extract_style_info',
        'gemini-2.5-flash'
      )
    } catch (error) {
      return aiServiceErrorResponse(
        error,
        'Failed to analyze style',
        { route: 'POST /api/analyze-style', userId: user.id }
      )
    }

    // Structured output is in functionCallResult (args from Gemini)
    const result = (raw as { functionCallResult?: { name?: string; description?: string; prompt?: string } })
      .functionCallResult ?? {}
    return NextResponse.json({
      name: result.name ?? '',
      description: result.description ?? '',
      prompt: result.prompt ?? '',
    })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to analyze style', {
      route: 'POST /api/analyze-style',
    })
  }
}
