/**
 * AI Core Service
 * 
 * Low-level functions for calling Google Gemini API.
 * NO PROMPTS - prompts are built in API routes (server-side only).
 */

import { fetchImageAsBase64, getResolutionDimensions, type GenerateThumbnailResult } from '@/lib/utils/ai-helpers'
import { sanitizeApiErrorResponse } from '@/lib/utils/error-sanitizer'
import { logError } from '@/lib/server/utils/logger'
import { retryWithBackoff, TimeoutError } from '@/lib/utils/retry-with-backoff'

/**
 * Call Google Gemini API for image generation
 */
export async function callGeminiImageGeneration(
  prompt: string,
  referenceImages: string[],
  faceImages: string[],
  resolution: '1K' | '2K' | '4K',
  aspectRatio: string
): Promise<GenerateThumbnailResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  // Build content array with text and images
  const contentParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []

  // Add text prompt
  contentParts.push({ text: prompt })

  // Fetch and add reference images
  for (const imageUrl of referenceImages) {
    const imageData = await fetchImageAsBase64(imageUrl)
    if (imageData) {
      contentParts.push({
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data,
        },
      })
    }
  }

  // Fetch and add face images
  for (const imageUrl of faceImages) {
    const imageData = await fetchImageAsBase64(imageUrl)
    if (imageData) {
      contentParts.push({
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data,
        },
      })
    }
  }

  // Get resolution dimensions (not used in request but kept for potential future use)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { width, height } = getResolutionDimensions(resolution, aspectRatio)

  // Call Gemini API
  const model = 'gemini-3-pro-image-preview'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: contentParts,
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  }

  try {
    const response = await retryWithBackoff(
      () =>
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
      const sanitizedError = sanitizeApiErrorResponse(errorText)
      logError(new Error(`Gemini API error: ${response.status} - ${sanitizedError}`), {
        operation: 'call-gemini-image-generation',
        route: 'ai-core',
        statusCode: response.status,
      })
      throw new Error(`Gemini API error: ${response.status} - ${sanitizedError}`)
    }

    const data = await response.json()

    // Extract image data from response
    if (data.candidates && data.candidates[0]?.content?.parts) {
      const imagePart = data.candidates[0].content.parts.find(
        (part: { inlineData?: { data: string; mimeType: string } }) => part.inlineData
      )

      if (imagePart?.inlineData) {
        return {
          imageData: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType || 'image/png',
        }
      }
    }

    // Fallback: check for base64 image in text response
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const text = data.candidates[0].content.parts[0].text
      // Try to extract base64 image from text (if API returns it that way)
      const base64Match = text.match(/data:image\/([^;]+);base64,([^\s]+)/)
      if (base64Match) {
        return {
          imageData: base64Match[2],
          mimeType: `image/${base64Match[1]}`,
        }
      }
    }

    throw new Error('No image data found in Gemini API response')
  } catch (error) {
    // Handle timeout errors specifically
    if (error instanceof TimeoutError) {
      logError(error, {
        operation: 'call-gemini-image-generation',
        route: 'ai-core',
        errorType: 'timeout',
      })
      throw error
    }

    logError(error, {
      operation: 'call-gemini-image-generation',
      route: 'ai-core',
    })
    throw error
  }
}

/**
 * Call Google Gemini API for text generation
 */
export async function callGeminiTextGeneration(
  systemPrompt: string,
  userPrompt: string,
  model: string = 'gemini-2.5-flash' //'gemini-3-pro-preview'
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: systemPrompt },
          { text: userPrompt },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  }

  const response = await retryWithBackoff(
    () =>
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
    const sanitizedError = sanitizeApiErrorResponse(errorText)
    throw new Error(`Gemini API error: ${response.status} - ${sanitizedError}`)
  }

  const data = await response.json()

  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text
  }

  throw new Error('No text response found in Gemini API response')
}

/**
 * Grounding metadata structure from Gemini API
 */
export interface GroundingMetadata {
  webSearchQueries?: string[]
  searchEntryPoint?: {
    renderedContent: string
  }
  groundingChunks?: Array<{
    web: {
      uri: string
      title: string
    }
  }>
  groundingSupports?: Array<{
    segment: {
      startIndex: number
      endIndex: number
      text: string
    }
    groundingChunkIndices: number[]
  }>
}

/**
 * Response structure for function calling with grounding metadata
 */
export interface FunctionCallingWithGroundingResult {
  functionCallResult: unknown
  groundingMetadata?: GroundingMetadata
}

/**
 * Call Google Gemini API with function calling (structured output)
 */
export async function callGeminiWithFunctionCalling(
  systemPrompt: string | null,
  userPrompt: string,
  imageData: { data: string; mimeType: string } | null,
  toolDefinition: unknown,
  toolName: string,
  model: string = 'gemini-2.5-flash',
  enableGoogleSearch: boolean = true
): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []
  
  if (systemPrompt) {
    parts.push({ text: systemPrompt })
  }
  
  parts.push({ text: userPrompt })
  
  if (imageData) {
    parts.push({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.data,
      },
    })
  }

  // Note: Gemini API does not support using googleSearch tool with function calling in the same request
  // When Google Search is enabled, we must choose: either use googleSearch OR function calling, not both
  // For now, we'll prioritize function calling and disable search when function calling is needed
  // The caller can decide to use search-only mode by not providing a toolDefinition
  
  // If Google Search is enabled but we also need function calling, we'll disable search
  // because they cannot be used together. The caller should handle this decision.
  const useGoogleSearch = enableGoogleSearch && !toolDefinition
  
  type RequestBody = {
    contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>
    tools?: Array<{ googleSearch?: Record<string, never>; functionDeclarations?: unknown[] }>
    toolConfig?: {
      functionCallingConfig: {
        mode: string
        allowedFunctionNames: string[]
      }
    }
    generationConfig: {
      temperature: number
      topK: number
      topP: number
      maxOutputTokens: number
    }
  }
  
  let requestBody: RequestBody
  
  if (useGoogleSearch) {
    // Use googleSearch tool only (no function calling)
    requestBody = {
      contents: [
        {
          role: 'user',
          parts,
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
  } else {
    // Use function calling (no googleSearch)
    requestBody = {
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      tools: [
        {
          functionDeclarations: [toolDefinition],
        },
      ],
      toolConfig: {
        functionCallingConfig: {
          mode: 'ANY',
          allowedFunctionNames: [toolName],
        },
      },
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      },
    }
  }

  const response = await retryWithBackoff(
    () =>
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
    const sanitizedError = sanitizeApiErrorResponse(errorText)
    throw new Error(`Gemini API error: ${response.status} - ${sanitizedError}`)
  }

  const data = await response.json()

  if (useGoogleSearch) {
    // When using googleSearch only, return the text response with grounding metadata
    const textResponse = data.candidates?.[0]?.content?.parts?.find(
      (part: { text?: string }) => part.text
    )?.text

    const groundingMetadata: GroundingMetadata | undefined = data.candidates?.[0]?.groundingMetadata

    if (!textResponse) {
      throw new Error('No text response found in Gemini API response')
    }

    // Return text response with grounding metadata
    // Note: This mode doesn't provide structured function call output
    return {
      textResponse,
      groundingMetadata,
    }
  } else {
    // Extract function call result
    const functionCall = data.candidates?.[0]?.content?.parts?.find(
      (part: { functionCall?: { name: string; args: unknown } }) => part.functionCall
    )

    if (functionCall?.functionCall?.name === toolName) {
      const args = functionCall.functionCall.args
      
      // Check if this response has grounding metadata (unlikely with function calling alone)
      const groundingMetadata: GroundingMetadata | undefined = data.candidates?.[0]?.groundingMetadata

      // Return both function call result and grounding metadata
      if (groundingMetadata) {
        return {
          functionCallResult: args,
          groundingMetadata,
        }
      }

      // Return just function call result for backward compatibility
      return args
    }

    throw new Error('No function call found in Gemini API response')
  }
}

/**
 * Call Google Gemini API for image generation (simpler version for style preview)
 */
export async function callGeminiImageGenerationSimple(
  prompt: string,
  referenceImage: { data: string; mimeType: string } | null,
  model: string = 'gemini-2.5-flash-image-preview'
): Promise<GenerateThumbnailResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const contentParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: prompt },
  ]

  if (referenceImage) {
    contentParts.push({
      inlineData: {
        mimeType: referenceImage.mimeType,
        data: referenceImage.data,
      },
    })
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: contentParts,
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  }

  const response = await retryWithBackoff(
    () =>
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
    const sanitizedError = sanitizeApiErrorResponse(errorText)
    throw new Error(`Gemini API error: ${response.status} - ${sanitizedError}`)
  }

  const data = await response.json()

  // Extract image data from response
  if (data.candidates && data.candidates[0]?.content?.parts) {
    const imagePart = data.candidates[0].content.parts.find(
      (part: { inlineData?: { data: string; mimeType: string } }) => part.inlineData
    )

    if (imagePart?.inlineData) {
      return {
        imageData: imagePart.inlineData.data,
        mimeType: imagePart.inlineData.mimeType || 'image/png',
      }
    }
  }

  throw new Error('No image data found in Gemini API response')
}

/**
 * Call Google Gemini API for image editing (with prompt and original image)
 */
export async function callGeminiImageEdit(
  editPrompt: string,
  originalImage: { data: string; mimeType: string },
  referenceImages?: Array<{ data: string; mimeType: string }>,
  model: string = 'gemini-3-pro-image-preview'
): Promise<GenerateThumbnailResult | null> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set')
  }

  const contentParts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [
    { text: editPrompt },
    {
      inlineData: {
        mimeType: originalImage.mimeType,
        data: originalImage.data,
      },
    },
  ]

  // Add reference images if provided
  if (referenceImages && referenceImages.length > 0) {
    for (const refImage of referenceImages) {
      contentParts.push({
        inlineData: {
          mimeType: refImage.mimeType,
          data: refImage.data,
        },
      })
    }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const requestBody = {
    contents: [
      {
        role: 'user',
        parts: contentParts,
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
    },
  }

  try {
    const response = await retryWithBackoff(
      () =>
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
      const sanitizedError = sanitizeApiErrorResponse(errorText)
      logError(new Error(`Gemini API error: ${response.status} - ${sanitizedError}`), {
        operation: 'call-gemini-image-edit',
        route: 'ai-core',
        statusCode: response.status,
      })
      throw new Error(`Gemini API error: ${response.status} - ${sanitizedError}`)
    }

    const data = await response.json()

    // Log response structure for debugging (without sensitive data)
    if (!data.candidates || !data.candidates[0]) {
      logError(new Error('Invalid response structure from Gemini API'), {
        operation: 'call-gemini-image-edit',
        route: 'ai-core',
        responseKeys: Object.keys(data),
      })
    }

    // Extract image data from response
    if (data.candidates && data.candidates[0]?.content?.parts) {
      const imagePart = data.candidates[0].content.parts.find(
        (part: { inlineData?: { data: string; mimeType: string } }) => part.inlineData
      )

      if (imagePart?.inlineData) {
        return {
          imageData: imagePart.inlineData.data,
          mimeType: imagePart.inlineData.mimeType || 'image/png',
        }
      }
    }

    // Fallback: check for base64 image in text response
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const text = data.candidates[0].content.parts[0].text
      // Try to extract base64 image from text (if API returns it that way)
      const base64Match = text.match(/data:image\/([^;]+);base64,([^\s]+)/)
      if (base64Match) {
        return {
          imageData: base64Match[2],
          mimeType: `image/${base64Match[1]}`,
        }
      }
      
      // Log text response for debugging (might contain error message)
      logError(new Error('Gemini API returned text instead of image'), {
        operation: 'call-gemini-image-edit',
        route: 'ai-core',
        textPreview: text.substring(0, 200), // First 200 chars for debugging
      })
    }

    // Log full response structure for debugging (without sensitive base64 data)
    const responseForLogging = {
      hasCandidates: !!data.candidates,
      candidatesCount: data.candidates?.length || 0,
      firstCandidateHasContent: !!data.candidates?.[0]?.content,
      firstCandidatePartsCount: data.candidates?.[0]?.content?.parts?.length || 0,
      partsTypes: data.candidates?.[0]?.content?.parts?.map((p: unknown) => Object.keys(p as object)) || [],
    }
    
    logError(new Error('No image data found in Gemini API response'), {
      operation: 'call-gemini-image-edit',
      route: 'ai-core',
      responseStructure: responseForLogging,
    })

    throw new Error('No image data found in Gemini API response')
  } catch (error) {
    // Handle timeout errors specifically
    if (error instanceof TimeoutError) {
      logError(error, {
        operation: 'call-gemini-image-edit',
        route: 'ai-core',
        errorType: 'timeout',
      })
      throw error
    }

    logError(error, {
      operation: 'call-gemini-image-edit',
      route: 'ai-core',
    })
    throw error
  }
}
