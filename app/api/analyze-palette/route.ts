/**
 * Palette Analysis API Route
 * 
 * Handles palette analysis using Google Gemini API.
 * Handles image upload to storage and analyzes image with AI.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { callGeminiWithFunctionCalling } from '@/lib/services/ai-core'
import { fetchImageAsBase64 } from '@/lib/utils/ai-helpers'
import { sanitizeErrorForClient } from '@/lib/utils/error-sanitizer'
import { requireAuth } from '@/lib/server/utils/auth'
import { serverErrorResponse, tierLimitResponse } from '@/lib/server/utils/error-handler'
import { getTierForUser } from '@/lib/server/utils/tier'

export interface AnalyzePaletteRequest {
  imageUrl?: string
  // If imageUrl is not provided, we expect FormData with 'image' file
}

interface PaletteAnalysisResult {
  name: string
  colors: string[]
  description?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const tier = await getTierForUser(supabase, user.id)
    if (!tier.can_create_custom) {
      return tierLimitResponse('Custom styles, palettes, and faces require Starter or higher.')
    }

    let imageUrl: string

    // Check if request is FormData (file upload) or JSON (URL)
    const contentType = request.headers.get('content-type') || ''
    
    if (contentType.includes('multipart/form-data')) {
      // Handle file upload
      const formData = await request.formData()
      const imageFile = formData.get('image') as File | null

      if (!imageFile) {
        return NextResponse.json(
          { error: 'Image file is required', code: 'VALIDATION_ERROR' },
          { status: 400 }
        )
      }

      // Validate file type
      if (!imageFile.type.startsWith('image/')) {
        return NextResponse.json(
          { error: 'File must be an image', code: 'VALIDATION_ERROR' },
          { status: 400 }
        )
      }

      // Validate file size (max 10MB)
      if (imageFile.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'Image size must be less than 10MB', code: 'VALIDATION_ERROR' },
          { status: 400 }
        )
      }

      // Upload to temporary location (we'll use style-references bucket as temporary storage)
      // In production, you might want a dedicated temp bucket
      const tempId = crypto.randomUUID()
      const storagePath = `${user.id}/${tempId}.${imageFile.name.split('.').pop() || 'png'}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('style-references')
        .upload(storagePath, imageFile, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError || !uploadData) {
        return NextResponse.json(
          { error: 'Failed to upload image', code: 'UPLOAD_ERROR' },
          { status: 500 }
        )
      }

      // Get signed URL for the uploaded file
      const { data: urlData } = await supabase.storage
        .from('style-references')
        .createSignedUrl(storagePath, 3600)

      imageUrl = urlData?.signedUrl || ''
    } else {
      // Handle JSON with imageUrl
      const body: AnalyzePaletteRequest = await request.json()
      
      if (!body.imageUrl) {
        return NextResponse.json(
          { error: 'Image URL is required', code: 'VALIDATION_ERROR' },
          { status: 400 }
        )
      }

      imageUrl = body.imageUrl
    }

    // Check if AI service is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured', code: 'CONFIG_ERROR' },
        { status: 500 }
      )
    }

    // Fetch and convert image to base64
    const imageData = await fetchImageAsBase64(imageUrl)
    if (!imageData) {
      return NextResponse.json(
        { 
          error: 'Failed to fetch or process image',
          code: 'AI_SERVICE_ERROR'
        },
        { status: 500 }
      )
    }

    // Build prompts inline (server-side only - prompts never exposed to frontend)
    const systemPrompt = `You are an expert color analyst and designer. When given an image, you extract the most visually important and harmonious colors to create a cohesive color palette. Focus on:
- Dominant colors that define the image's mood
- Accent colors that add visual interest
- Colors that work well together as a palette
Return 3-6 hex color codes ordered by visual importance or harmony.`

    const userPrompt = `Analyze this image and extract a color palette. Provide a creative, descriptive name for the palette based on the mood, theme, or subject of the image (2-4 words). Also provide a brief description of the color theme.`

    const toolDefinition = {
      name: 'extract_color_palette',
      description: 'Extract a color palette from an image with a name and colors',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'A creative, descriptive palette name (2-4 words) based on the image mood or theme, e.g., "Sunset Beach", "Forest Meadow", "Urban Concrete", "Vintage Rose"',
          },
          colors: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of 3-6 hex color codes extracted from the image, ordered by visual importance',
          },
          description: {
            type: 'string',
            description: 'Brief description of the color mood/theme (1-2 sentences)',
          },
        },
        required: ['name', 'colors'],
      },
    }

    // Call AI core service
    let apiResult: unknown
    try {
      apiResult = await callGeminiWithFunctionCalling(
        systemPrompt,
        userPrompt,
        imageData,
        toolDefinition,
        'extract_color_palette',
        'gemini-2.5-flash'
      )
    } catch (error) {
      return NextResponse.json(
        { 
          error: sanitizeErrorForClient(error, 'analyze-palette-ai', 'Failed to analyze palette'),
          code: 'AI_SERVICE_ERROR'
        },
        { status: 500 }
      )
    }

    // Handle both old format (just function call args) and new format (with grounding metadata)
    let result: PaletteAnalysisResult
    if (apiResult && typeof apiResult === 'object' && 'functionCallResult' in apiResult) {
      // New format with grounding metadata
      result = apiResult.functionCallResult as PaletteAnalysisResult
    } else {
      // Old format (backward compatibility)
      result = apiResult as PaletteAnalysisResult
    }

    return NextResponse.json({
      colors: result.colors || [],
      name: result.name,
      description: result.description,
    })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to analyze palette', {
      route: 'POST /api/analyze-palette',
      userId: user?.id,
    })
  }
}
