/**
 * Style Preview Generation API Route
 * 
 * Handles style preview generation using Google Gemini API.
 * Generates preview image and uploads result to storage.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { callGeminiImageGenerationSimple } from '@/lib/services/ai-core'
import { fetchImageAsBase64 } from '@/lib/utils/ai-helpers'
import { sanitizeErrorForClient } from '@/lib/utils/error-sanitizer'
import { logWarn } from '@/lib/server/utils/logger'
import { requireAuth } from '@/lib/server/utils/auth'
import { serverErrorResponse } from '@/lib/server/utils/error-handler'

export interface GenerateStylePreviewRequest {
  prompt: string
  referenceImageUrl?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse request body
    const body: GenerateStylePreviewRequest = await request.json()
    
    // Validate required fields
    if (!body.prompt || !body.prompt.trim()) {
      return NextResponse.json(
        { error: 'Style prompt is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Check if AI service is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured', code: 'CONFIG_ERROR' },
        { status: 500 }
      )
    }

    // Build prompt inline (server-side only - prompts never exposed to frontend)
    // Note: body.prompt comes from user-created styles, but we wrap it in our template
    const userPrompt = `Generate a thumbnail preview image with the following style: ${body.prompt.trim()}. 
The image should be in 16:9 aspect ratio, ultra high quality, professional thumbnail aesthetic.
Remove any text from the image. (if there is text, remove it. DO NOT ADD TEXT.)
Make a different version of it and not the same image if given a reference image.
Make it eye-catching, representative of this visual style.`

    let referenceImage: { data: string; mimeType: string } | null = null
    if (body.referenceImageUrl) {
      referenceImage = await fetchImageAsBase64(body.referenceImageUrl)
    }

    // Call AI core service
    let aiResult
    try {
      aiResult = await callGeminiImageGenerationSimple(
        userPrompt,
        referenceImage,
        'gemini-3-pro-image-preview'
      )
    } catch (error) {
      return NextResponse.json(
        { 
          error: sanitizeErrorForClient(error, 'generate-style-preview-ai', 'Failed to generate style preview'),
          code: 'AI_SERVICE_ERROR'
        },
        { status: 500 }
      )
    }

    if (!aiResult) {
      return NextResponse.json(
        { 
          error: 'Failed to generate style preview',
          code: 'AI_SERVICE_ERROR'
        },
        { status: 500 }
      )
    }

    // Convert base64 to blob and upload to storage
    const imageBuffer = Buffer.from(aiResult.imageData, 'base64')
    const imageBlob = new Blob([imageBuffer], { type: aiResult.mimeType })
    
    const tempId = crypto.randomUUID()
    const fileExtension = aiResult.mimeType.includes('jpeg') || aiResult.mimeType.includes('jpg') ? 'jpg' : 'png'
    const storagePath = `${user.id}/${tempId}/preview.${fileExtension}`
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('style-previews')
      .upload(storagePath, imageBlob, {
        cacheControl: '3600',
        upsert: true,
        contentType: aiResult.mimeType,
      })

    let finalImageUrl: string

    if (uploadError || !uploadData) {
      // Return base64 data URL as fallback
      logWarn('Failed to upload preview to storage, returning base64', {
        route: 'POST /api/generate-style-preview',
        userId: user.id,
        operation: 'upload-preview-fallback',
      })
      finalImageUrl = `data:${aiResult.mimeType};base64,${aiResult.imageData}`
    } else {
      // Get signed URL for style-previews bucket (check if it's private or public)
      const { data: urlData } = supabase.storage
        .from('style-previews')
        .getPublicUrl(storagePath)
      
      if (urlData?.publicUrl) {
        finalImageUrl = urlData.publicUrl
      } else {
        // If bucket is private, create signed URL
        const { data: signedUrlData } = await supabase.storage
          .from('style-previews')
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365) // 1 year
        
        finalImageUrl = signedUrlData?.signedUrl || `data:${aiResult.mimeType};base64,${aiResult.imageData}`
      }
    }

    return NextResponse.json({
      imageUrl: finalImageUrl,
    })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return serverErrorResponse(error, 'Failed to generate style preview', {
      route: 'POST /api/generate-style-preview',
      userId: user?.id,
    })
  }
}
