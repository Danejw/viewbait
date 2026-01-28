# Gemini API Routes Migration Guide

This document provides a comprehensive breakdown of how Google Gemini API is implemented in this application. Use this guide to replicate the same prompt engineering and API patterns in another client-side application that connects to the same backend.

## Table of Contents

1. [Overview](#overview)
2. [Core AI Service](#core-ai-service)
3. [API Routes](#api-routes)
   - [POST /api/generate](#post-apigenerate)
   - [POST /api/edit](#post-apiedit)
   - [POST /api/enhance-title](#post-apienhance-title)
   - [POST /api/assistant/chat](#post-apiassistantchat)
   - [POST /api/generate-style-preview](#post-apigenerate-style-preview)
   - [POST /api/analyze-style](#post-apianalyze-style)
   - [POST /api/analyze-palette](#post-apianalyze-palette)

---

## Overview

### Gemini API Integration Architecture

The application uses Google Gemini API for:
- **Image Generation**: Creating YouTube thumbnails from text prompts and reference images
- **Image Editing**: Modifying existing thumbnails based on edit prompts
- **Text Generation**: Enhancing video titles and generating AI assistant responses
- **Vision Analysis**: Analyzing images to extract style information and color palettes
- **Function Calling**: Structured output for AI assistant chat interface

### Key Principles

1. **Server-Side Prompt Engineering**: All prompts are constructed server-side and never exposed to the client
2. **Structured JSON Prompts**: Complex prompts use structured JSON format for better AI understanding
3. **Image Handling**: All images are converted to base64 format before sending to Gemini API
4. **Error Handling**: Comprehensive error handling with retry logic and exponential backoff
5. **Credit System**: All AI operations deduct credits from user accounts

### Environment Variables

- `GEMINI_API_KEY`: Required server-side environment variable for Gemini API authentication

---

## Core AI Service

**Location**: `lib/services/ai-core.ts`

The core AI service provides low-level functions for calling Gemini API. These functions handle API communication but do NOT contain prompts - prompts are built in API routes.

### Available Functions

#### 1. `callGeminiImageGeneration()`
- **Purpose**: Generate images using Gemini API
- **Model**: `gemini-3-pro-image-preview`
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`
- **Parameters**:
  - `prompt: string` - Text prompt for image generation
  - `referenceImages: string[]` - Array of image URLs (style references)
  - `faceImages: string[]` - Array of face image URLs
  - `resolution: '1K' | '2K' | '4K'` - Output resolution
  - `aspectRatio: string` - Aspect ratio (e.g., "16:9")
- **Returns**: `{ imageData: string, mimeType: string }` (base64 image data)

#### 2. `callGeminiImageEdit()`
- **Purpose**: Edit existing images using Gemini API
- **Model**: `gemini-3-pro-image-preview`
- **Parameters**:
  - `editPrompt: string` - Instructions for editing
  - `originalImage: { data: string, mimeType: string }` - Original image as base64
  - `referenceImages?: Array<{ data: string, mimeType: string }>` - Optional reference images
- **Returns**: `{ imageData: string, mimeType: string }` (base64 image data)

#### 3. `callGeminiTextGeneration()`
- **Purpose**: Generate text using Gemini API
- **Model**: `gemini-2.5-flash` (default) or `gemini-3-pro-preview`
- **Parameters**:
  - `systemPrompt: string` - System instructions
  - `userPrompt: string` - User input
  - `model?: string` - Model override (default: `gemini-2.5-flash`)
- **Returns**: `string` (generated text)

#### 4. `callGeminiWithFunctionCalling()`
- **Purpose**: Get structured output using function calling
- **Model**: `gemini-2.5-flash` (default)
- **Parameters**:
  - `systemPrompt: string | null` - System instructions
  - `userPrompt: string` - User input
  - `imageData: { data: string, mimeType: string } | null` - Optional image
  - `toolDefinition: unknown` - Function schema definition
  - `toolName: string` - Function name
  - `model?: string` - Model override
  - `enableGoogleSearch?: boolean` - Enable Google Search (default: true)
- **Returns**: Function call arguments as structured object

#### 5. `callGeminiImageGenerationSimple()`
- **Purpose**: Simple image generation (for style previews)
- **Model**: `gemini-2.5-flash-image-preview` (default) or `gemini-3-pro-image-preview`
- **Parameters**:
  - `prompt: string` - Text prompt
  - `referenceImage: { data: string, mimeType: string } | null` - Optional reference image
  - `model?: string` - Model override
- **Returns**: `{ imageData: string, mimeType: string }` (base64 image data)

### Common Configuration

All Gemini API calls use:
- **Temperature**: 0.7
- **TopK**: 40
- **TopP**: 0.95
- **Max Output Tokens**: 8192
- **Authentication**: `x-goog-api-key` header with `GEMINI_API_KEY`

---

## API Routes

### POST /api/generate

**Purpose**: Generate YouTube thumbnails using AI

**Authentication**: Required (user must be authenticated)

**Request Body**:
```typescript
{
  title: string                    // Required: Thumbnail title/text
  emotion?: string                 // Optional: Facial expression (e.g., "excited", "happy")
  pose?: string                    // Optional: Body pose (e.g., "pointing", "thumbs-up")
  style?: string                   // Optional: Style ID or name
  palette?: string                 // Optional: Color palette ID or name
  resolution?: '1K' | '2K' | '4K'  // Optional: Output resolution (default: '1K')
  aspectRatio?: string             // Optional: Aspect ratio (default: '16:9')
  referenceImages?: string[]        // Optional: Style reference image URLs
  faceImages?: string[]             // DEPRECATED: Use faceCharacters instead
  faceCharacters?: Array<{          // NEW: Grouped face images by character
    images: string[]
  }>
  customStyle?: string              // Optional: Custom style description
  thumbnailText?: string            // Optional: Additional text overlay
  variations?: number               // Optional: Number of variations (1-4, default: 1)
}
```

**Response** (Single Variation):
```typescript
{
  imageUrl: string           // Signed URL to generated thumbnail
  thumbnailId: string       // Database ID of thumbnail record
  creditsUsed: number       // Credits deducted
  creditsRemaining: number  // Remaining credits
}
```

**Response** (Multiple Variations):
```typescript
{
  results: Array<{
    success: boolean
    thumbnailId: string
    imageUrl?: string
    error?: string
  }>
  creditsUsed: number
  creditsRemaining: number
  totalRequested: number
  totalSucceeded: number
  totalFailed: number
  refundFailureWarning?: {  // Only present if refund failed
    amount: number
    reason: string
    requestId: string
  }
}
```

**How It Works**:

1. **Validation**: Validates title, variations count, user subscription, credits
2. **Style Lookup**: If style is provided, looks up style description from database
3. **Prompt Construction**: Builds structured JSON prompt with:
   - Image reference markers (order of images)
   - Task specification (thumbnail_generation)
   - Title structure (main_title, subtext)
   - Style requirements (style, color palette, custom notes)
   - Character instructions (face images, emotions, poses)
   - Technical specs (aspect ratio, resolution, quality)
   - Reference image metadata
4. **Image Processing**: Fetches all reference and face images, converts to base64
5. **AI Generation**: Calls `callGeminiImageGeneration()` with constructed prompt
6. **Storage**: Uploads generated image to Supabase storage
7. **Variants**: Generates 400w and 800w thumbnail variants
8. **Database**: Creates/updates thumbnail records
9. **Credits**: Deducts credits (upfront for batch, after generation for single)

**Prompt Engineering**:

The prompt uses a structured JSON format:

```json
{
  "task": "thumbnail_generation",
  "title": {
    "main_title": "Main Title Text",
    "subtext": "Subtitle Text (if colon present)",
    "instructions": "Use the title text EXACTLY as provided..."
  },
  "style_requirements": {
    "style": "Style description",
    "additional_notes": "Custom style notes",
    "color_palette": "Palette name"
  },
  "characters": {
    "count": 2,
    "facial_references_provided": true,
    "reference_images_per_character": [3, 2],
    "emotional_tone": "excited and enthusiastic",
    "pose": "pointing at something",
    "instructions": "Character instructions..."
  },
  "technical_specs": {
    "aspect_ratio": "16:9",
    "resolution": "2K",
    "quality": "ultra high quality, professional..."
  },
  "reference_images": {
    "style_references": {
      "count": 2,
      "purpose": "Match visual style..."
    },
    "facial_references": {
      "total_images": 5,
      "characters": [...]
    }
  }
}
```

The prompt also includes image reference markers:
```
REFERENCE IMAGES ORDER:
- Images 1-2: Style references (match visual style, color grading, composition)
- Images 3-5: Character 1 facial references (3 images of the same person)
- Images 6-7: Character 2 facial references (2 images of the same person)
```

**Client-Side Usage**:

```typescript
// Service function: lib/services/thumbnails.ts
const response = await fetch('/api/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'My Video Title',
    style: 'style-id-or-name',
    palette: 'palette-id-or-name',
    resolution: '2K',
    aspectRatio: '16:9',
    faceCharacters: [
      { images: ['face1.jpg', 'face2.jpg'] },
      { images: ['face3.jpg'] }
    ],
    referenceImages: ['style1.jpg', 'style2.jpg'],
    variations: 2
  })
})

const data = await response.json()
// Handle response...
```

**Gemini Model**: `gemini-3-pro-image-preview`

---

### POST /api/edit

**Purpose**: Edit an existing thumbnail using AI

**Authentication**: Required

**Request Body**:
```typescript
{
  thumbnailId: string         // Required: ID of thumbnail to edit
  editPrompt: string          // Required: Edit instructions (max 500 chars)
  referenceImages?: string[]  // Optional: Reference images for editing
}
```

**Response**:
```typescript
{
  imageUrl: string           // Signed URL to edited thumbnail
  thumbnailId: string       // NEW thumbnail ID (creates new version)
  originalThumbnailId: string  // Original thumbnail ID
  creditsUsed: number       // Credits deducted (2 credits)
  creditsRemaining: number  // Remaining credits
}
```

**How It Works**:

1. **Validation**: Validates thumbnail ownership, edit prompt length
2. **Image Fetching**: Fetches original thumbnail image and refreshes signed URL
3. **Reference Processing**: Fetches and converts reference images to base64
4. **Prompt Construction**: Builds structured edit prompt:
   ```
   Generate a new thumbnail image based on the provided reference image. 
   Apply the following modifications: {editPrompt}
   
   Requirements:
   - Maintain the same aspect ratio and composition style
   - Keep the core visual elements and layout
   - Apply the requested modifications while preserving the overall thumbnail aesthetic
   - Generate a high-quality thumbnail image that matches the style and quality of the reference
   ```
5. **AI Generation**: Calls `callGeminiImageEdit()` with edit prompt and original image
6. **Storage**: Uploads edited image as new thumbnail version
7. **Database**: Creates new thumbnail record (preserves original)
8. **Credits**: Deducts 2 credits upfront, refunds on failure

**Client-Side Usage**:

```typescript
// Service function: lib/services/thumbnails.ts
const response = await fetch('/api/edit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    thumbnailId: 'thumbnail-id',
    editPrompt: 'Make it more dramatic and add a glowing effect',
    referenceImages: ['ref1.jpg'] // Optional
  })
})

const data = await response.json()
// data.imageUrl contains the edited thumbnail
```

**Gemini Model**: `gemini-3-pro-image-preview`

---

### POST /api/enhance-title

**Purpose**: Generate enhanced title suggestions using AI

**Authentication**: Required

**Tier Requirement**: Starter tier or above (`has_enhance: true`)

**Request Body**:
```typescript
{
  title: string      // Required: Original title to enhance
  style?: string     // Optional: Style name (for context)
  emotion?: string   // Optional: Emotion/expression (for context)
}
```

**Response**:
```typescript
{
  suggestions: string[]  // Array of 3 enhanced title suggestions
}
```

**How It Works**:

1. **Validation**: Validates title, checks subscription tier
2. **Prompt Construction**: Uses two-part prompt system:

   **System Prompt**:
   ```
   You are an expert YouTube title optimizer. Your job is to transform video 
   topics into compelling, click-worthy titles that maximize curiosity while 
   maintaining integrity.
   
   ## Core Principles
   1. Make one clear promise: What is the payoff if someone clicks?
   2. Maximize curiosity: Open a loop that only the video closes
   3. Avoid betrayal: The title must match the real content
   
   ## Title Optimization Rules
   - Be specific and concrete
   - Frame around outcome or conflict
   - Use proven patterns (e.g., "You're Doing X Wrong", "Why X Is So Hard")
   
   ## Output Format
   Return EXACTLY 3 enhanced title variations, one per line. Each should be:
   - Under 60 characters
   - Capitalizing key words for emphasis
   - Creating curiosity without being misleading
   - Different approaches (one emotional, one specific/outcome-based, one pattern-based)
   
   Do not include numbers, bullets, or any other formatting. Just three titles, one per line.
   ```

   **User Prompt**:
   ```
   Optimize this video topic/title for maximum clicks while staying honest to the content:
   
   "{title}"
   ```

3. **AI Generation**: Calls `callGeminiTextGeneration()` with prompts
4. **Response Parsing**: Splits response by newlines, filters empty lines, takes first 3

**Client-Side Usage**:

```typescript
// Service function: lib/services/thumbnails.ts
const response = await fetch('/api/enhance-title', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'How to Build a Website',
    style: 'minimalist',  // Optional
    emotion: 'excited'     // Optional
  })
})

const data = await response.json()
// data.suggestions contains array of 3 enhanced titles
```

**Gemini Model**: `gemini-3-pro-preview`

---

### POST /api/assistant/chat

**Purpose**: AI assistant chat interface for thumbnail generation guidance

**Authentication**: Required (but uses `getOptionalAuth` - may allow unauthenticated in future)

**Request Body**:
```typescript
{
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
```

**Query Parameters**:
- `stream=true` - Enable Server-Sent Events (SSE) streaming

**Response** (Non-streaming):
```typescript
{
  human_readable_message: string
  ui_components: Array<
    | 'IncludeFaceSection'
    | 'StyleSelectionSection'
    | 'ColorPaletteSection'
    | 'StyleReferencesSection'
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
```

**Response** (Streaming - SSE):
- Events: `status`, `tool_call`, `text_chunk`, `complete`, `error`
- Final event contains same structure as non-streaming response

**How It Works**:

1. **Two-Phase Approach**: Since Gemini API doesn't support Google Search + Function Calling together:
   - **Phase 1**: Make search call with `googleSearch` tool to get context
   - **Phase 2**: Make function calling call with search results in context

2. **System Prompt Construction**: Comprehensive system prompt includes:
   - Role definition (expert thumbnail creator)
   - Available UI components list
   - Thumbnail generation requirements
   - Current form state
   - Available options (styles, palettes, expressions, poses)
   - Instructions for extracting structured data

3. **Function Calling**: Uses structured function definition:
   ```typescript
   {
     name: 'generate_assistant_response',
     description: 'Generate a response for the thumbnail generation assistant...',
     parameters: {
       type: 'object',
       properties: {
         human_readable_message: { type: 'string', ... },
         ui_components: { type: 'array', items: { enum: [...] } },
         form_state_updates: { type: 'object', properties: {...} },
         suggestions: { type: 'array', items: { type: 'string' } }
       },
       required: ['human_readable_message', 'ui_components']
     }
   }
   ```

4. **Citation Processing**: If grounding metadata is present, processes citations and inserts them into message

5. **Streaming**: For streaming mode, emits SSE events for status updates and text chunks

**System Prompt Structure**:

```
You are an expert an creating viral thumbnails with perfect, catchy simple titles. 
Your role is to guide users through the thumbnail creation process by reasoning 
about their intent from the conversation and surfacing appropriate UI components.

AVAILABLE UI COMPONENTS:
- IncludeFaceSection: For configuring face integration...
- StyleSelectionSection: For selecting a visual style...
[... full list of components ...]

THUMBNAIL GENERATION REQUIREMENTS:
To generate a thumbnail, the following information is typically needed:
1. Thumbnail text/title
2. Style selection (optional but recommended)
3. Color palette (optional but recommended)
4. Aspect ratio and resolution
5. Number of variations

CURRENT FORM STATE:
- Thumbnail Text: {current value}
- Include Face: {current value}
[... all form state fields ...]

AVAILABLE OPTIONS:
Available Styles: {list}
Available Palettes: {list}
Available Expressions: {list}
Available Poses: {list}

INSTRUCTIONS:
1. Analyze the conversation history to understand user intent
2. When the user explicitly states preferences, extract those values
3. Determine what information is missing
4. Surface relevant UI components
5. Only include GenerateThumbnailButton when sufficient information is gathered
6. Write a natural, conversational message
7. Generate 2-3 relevant suggestions
```

**Client-Side Usage**:

```typescript
// Streaming mode (preferred)
const response = await fetch('/api/assistant/chat?stream=true', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    conversationHistory: [
      { role: 'user', content: 'I want to create a thumbnail for my video' },
      { role: 'assistant', content: 'Great! What is your video about?' }
    ],
    formState: {
      thumbnailText: '',
      includeFace: false,
      selectedFaces: [],
      expression: null,
      pose: null,
      styleReferences: [],
      selectedStyle: null,
      selectedColor: null,
      selectedAspectRatio: '16:9',
      selectedResolution: '1K',
      variations: 1,
      customInstructions: ''
    },
    availableStyles: [{ id: 'style1', name: 'Minimalist' }],
    availablePalettes: [{ id: 'palette1', name: 'Vibrant' }]
  })
})

// Handle SSE stream
const reader = response.body?.getReader()
const decoder = new TextDecoder()
let buffer = ''

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  
  buffer += decoder.decode(value, { stream: true })
  const lines = buffer.split('\n')
  buffer = lines.pop() || ''
  
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      const eventType = line.substring(7)
    } else if (line.startsWith('data: ')) {
      const data = JSON.parse(line.substring(6))
      // Handle event data
    }
  }
}
```

**Gemini Model**: `gemini-2.5-flash`

---

### POST /api/generate-style-preview

**Purpose**: Generate a preview image for a style

**Authentication**: Required

**Request Body**:
```typescript
{
  prompt: string              // Required: Style description/prompt
  referenceImageUrl?: string  // Optional: Reference image URL
}
```

**Response**:
```typescript
{
  imageUrl: string  // URL to generated preview image
}
```

**How It Works**:

1. **Validation**: Validates prompt
2. **Prompt Construction**: Wraps user prompt in template:
   ```
   Generate a thumbnail preview image with the following style: {prompt}. 
   The image should be in 16:9 aspect ratio, ultra high quality, professional 
   thumbnail aesthetic.
   Remove any text from the image. (if there is text, remove it. DO NOT ADD TEXT.)
   Make a different version of it and not the same image if given a reference image.
   Make it eye-catching, representative of this visual style.
   ```
3. **Reference Processing**: Fetches reference image if provided
4. **AI Generation**: Calls `callGeminiImageGenerationSimple()` with prompt
5. **Storage**: Uploads to `style-previews` bucket
6. **Response**: Returns signed URL or public URL

**Client-Side Usage**:

```typescript
const response = await fetch('/api/generate-style-preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Neon cyberpunk aesthetic with vibrant colors and glowing effects',
    referenceImageUrl: 'https://example.com/ref.jpg' // Optional
  })
})

const data = await response.json()
// data.imageUrl contains preview image URL
```

**Gemini Model**: `gemini-3-pro-image-preview`

---

### POST /api/analyze-style

**Purpose**: Analyze an image to extract style information (name, description, prompt)

**Authentication**: Required

**Request Body** (JSON):
```typescript
{
  imageUrls: string[]  // Required: Array of image URLs
}
```

**Request Body** (FormData):
```
images: File[]  // Required: Array of image files
```

**Response**:
```typescript
{
  name: string        // Style name (2-4 words)
  description: string // Brief description (1-2 sentences)
  prompt: string     // Detailed generation prompt (100-200 words)
}
```

**How It Works**:

1. **Image Upload**: If FormData, uploads images to `style-references` bucket
2. **Image Processing**: Fetches first image and converts to base64
3. **Prompt Construction**:
   ```
   You are an expert visual style analyst for thumbnails. Analyze this image 
   and extract its visual style characteristics.
   
   Your task is to:
   1. Identify the key visual elements: colors, lighting, composition, 
      typography style, effects (glow, shadows, gradients), mood/emotion
   2. Create a catchy, memorable style name (2 words max) that captures the essence
   3. Write a brief description (1 sentence) explaining what makes this style distinctive
   4. Write a detailed generation prompt (100-200 words) that would allow an AI 
      to recreate this exact visual style for YouTube thumbnails
   
   Focus on:
   - Color palette and color grading
   - Lighting style (dramatic, soft, neon, natural)
   - Composition techniques
   - Text/typography treatment if visible (but do not include the actual text 
     in the description. Can you describe its styling)
   - Special effects (blur, glow, grain, etc.)
   - Overall mood and energy
   
   Keep the description that is no more than one paragraph long. Use concise, 
   clear language. 
   DO NOT mention "YouTube"
   Start with "This style is a" and then describe the style.
   
   You MUST call the extract_style_info function with your analysis.
   ```
4. **Function Calling**: Uses structured function:
   ```typescript
   {
     name: 'extract_style_info',
     description: 'Extract structured style information from the image analysis',
     parameters: {
       type: 'object',
       properties: {
         name: { type: 'string', description: 'Style name (2-4 words)' },
         description: { type: 'string', description: 'Brief description' },
         prompt: { type: 'string', description: 'Detailed generation prompt' }
       },
       required: ['name', 'description', 'prompt']
     }
   }
   ```
5. **AI Analysis**: Calls `callGeminiWithFunctionCalling()` with image and function definition
6. **Response**: Returns extracted style information

**Client-Side Usage**:

```typescript
// Using FormData (file upload)
const formData = new FormData()
formData.append('images', imageFile1)
formData.append('images', imageFile2)

const response = await fetch('/api/analyze-style', {
  method: 'POST',
  body: formData
})

const data = await response.json()
// data.name, data.description, data.prompt

// Using JSON (URLs)
const response = await fetch('/api/analyze-style', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageUrls: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg']
  })
})
```

**Gemini Model**: `gemini-2.5-flash`

---

### POST /api/analyze-palette

**Purpose**: Analyze an image to extract color palette

**Authentication**: Required

**Request Body** (JSON):
```typescript
{
  imageUrl: string  // Required: Image URL
}
```

**Request Body** (FormData):
```
image: File  // Required: Image file
```

**Response**:
```typescript
{
  name: string        // Palette name (2-4 words)
  colors: string[]    // Array of hex color codes (3-6 colors)
  description?: string // Optional: Brief description of color mood/theme
}
```

**How It Works**:

1. **Image Upload**: If FormData, uploads image to `style-references` bucket
2. **Image Processing**: Fetches image and converts to base64
3. **Prompt Construction**:
   - **System Prompt**:
     ```
     You are an expert color analyst and designer. When given an image, you 
     extract the most visually important and harmonious colors to create a 
     cohesive color palette. Focus on:
     - Dominant colors that define the image's mood
     - Accent colors that add visual interest
     - Colors that work well together as a palette
     Return 3-6 hex color codes ordered by visual importance or harmony.
     ```
   - **User Prompt**:
     ```
     Analyze this image and extract a color palette. Provide a creative, 
     descriptive name for the palette based on the mood, theme, or subject 
     of the image (2-4 words). Also provide a brief description of the 
     color theme.
     ```
4. **Function Calling**: Uses structured function:
   ```typescript
   {
     name: 'extract_color_palette',
     description: 'Extract a color palette from an image with a name and colors',
     parameters: {
       type: 'object',
       properties: {
         name: { type: 'string', description: 'Palette name (2-4 words)' },
         colors: { 
           type: 'array', 
           items: { type: 'string' },
           description: 'Array of 3-6 hex color codes'
         },
         description: { type: 'string', description: 'Brief description' }
       },
       required: ['name', 'colors']
     }
   }
   ```
5. **AI Analysis**: Calls `callGeminiWithFunctionCalling()` with image and function definition
6. **Response**: Returns extracted palette information

**Client-Side Usage**:

```typescript
// Using FormData (file upload)
const formData = new FormData()
formData.append('image', imageFile)

const response = await fetch('/api/analyze-palette', {
  method: 'POST',
  body: formData
})

const data = await response.json()
// data.name, data.colors (array of hex codes), data.description

// Using JSON (URL)
const response = await fetch('/api/analyze-palette', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    imageUrl: 'https://example.com/image.jpg'
  })
})
```

**Gemini Model**: `gemini-2.5-flash`

---

## Client-Side Service Layer

The application uses a service layer pattern for API calls. Key service files:

### `lib/services/thumbnails.ts`

Provides typed functions for thumbnail operations:

- `generateThumbnail(options)` - Calls `/api/generate`
- `editThumbnail(thumbnailId, editPrompt, referenceImages?)` - Calls `/api/edit`
- `enhanceTitle(options)` - Calls `/api/enhance-title`

### Usage Pattern

```typescript
import { generateThumbnail, editThumbnail, enhanceTitle } from '@/lib/services/thumbnails'

// Generate thumbnail
const { result, error } = await generateThumbnail({
  title: 'My Video Title',
  style: 'minimalist',
  resolution: '2K',
  variations: 2
})

// Edit thumbnail
const { result, error } = await editThumbnail(
  'thumbnail-id',
  'Make it more dramatic',
  ['ref-image.jpg']
)

// Enhance title
const { suggestions, error } = await enhanceTitle({
  title: 'How to Build a Website'
})
```

---

## Error Handling

All routes use consistent error response format:

```typescript
{
  error: string      // Human-readable error message
  code: string       // Error code (e.g., 'VALIDATION_ERROR', 'INSUFFICIENT_CREDITS')
  refundFailureWarning?: {  // Only for generation/edit routes
    amount: number
    reason: string
    requestId: string
  }
}
```

Common error codes:
- `VALIDATION_ERROR` - Invalid request data
- `UNAUTHORIZED` - Authentication required
- `TIER_LIMIT` - Feature not available for subscription tier
- `INSUFFICIENT_CREDITS` - Not enough credits
- `AI_SERVICE_ERROR` - Gemini API error
- `CONFIG_ERROR` - Missing configuration (e.g., GEMINI_API_KEY)
- `DATABASE_ERROR` - Database operation failed
- `STORAGE_ERROR` - Storage operation failed
- `TIMEOUT_ERROR` - Request timed out

---

## Credit System

All AI operations deduct credits:

- **Generate (1K)**: 1 credit per variation
- **Generate (2K)**: 2 credits per variation
- **Generate (4K)**: 4 credits per variation
- **Edit**: 2 credits

Credits are deducted:
- **Batch generation** (variations > 1): Upfront, refunded for failures
- **Single generation** (variations = 1): After successful generation
- **Edit**: Upfront, refunded on failure

---

## Image Handling

### Image Format

All images sent to Gemini API are converted to base64 format:

```typescript
{
  data: string      // Base64-encoded image data
  mimeType: string  // MIME type (e.g., 'image/png', 'image/jpeg')
}
```

### Image Sources

Images can come from:
1. **URLs**: Fetched and converted to base64 using `fetchImageAsBase64()`
2. **Data URLs**: Already base64-encoded, extracted directly
3. **File Uploads**: Uploaded to Supabase storage first, then fetched as URLs

### Helper Function

`lib/utils/ai-helpers.ts` provides `fetchImageAsBase64()`:
- Handles both regular URLs and data URLs
- Converts to base64 format
- Determines MIME type from response headers or URL
- Returns `{ data: string, mimeType: string } | null`

---

## Retry Logic

All Gemini API calls use exponential backoff retry logic:

- **Location**: `lib/utils/retry-with-backoff.ts`
- **Max Retries**: 3
- **Initial Delay**: 1 second
- **Max Delay**: 10 seconds
- **Timeout**: 60 seconds

Retries on:
- Network errors
- 429 (Rate Limit) errors
- 500-599 (Server errors)

Throws `TimeoutError` if request exceeds timeout.

---

## Summary

### Routes Summary

| Route | Method | Purpose | Model | Credits |
|-------|--------|---------|-------|---------|
| `/api/generate` | POST | Generate thumbnails | `gemini-3-pro-image-preview` | 1-4 per variation |
| `/api/edit` | POST | Edit thumbnails | `gemini-3-pro-image-preview` | 2 |
| `/api/enhance-title` | POST | Enhance titles | `gemini-3-pro-preview` | 0 |
| `/api/assistant/chat` | POST | AI assistant chat | `gemini-2.5-flash` | 0 |
| `/api/generate-style-preview` | POST | Style preview | `gemini-3-pro-image-preview` | 0 |
| `/api/analyze-style` | POST | Analyze style | `gemini-2.5-flash` | 0 |
| `/api/analyze-palette` | POST | Analyze palette | `gemini-2.5-flash` | 0 |

### Key Takeaways

1. **Prompts are server-side only** - Never exposed to client
2. **Structured JSON prompts** - Used for complex generation tasks
3. **Function calling** - Used for structured output (assistant, style analysis, palette analysis)
4. **Image base64 conversion** - All images converted before API calls
5. **Credit system** - All generation/edit operations deduct credits
6. **Error handling** - Consistent error format with retry logic
7. **Streaming support** - Assistant chat supports SSE streaming

### Migration Checklist

When implementing in another application:

- [ ] Set up `GEMINI_API_KEY` environment variable
- [ ] Implement core AI service functions (`lib/services/ai-core.ts`)
- [ ] Implement image helper functions (`lib/utils/ai-helpers.ts`)
- [ ] Implement retry logic (`lib/utils/retry-with-backoff.ts`)
- [ ] Replicate prompt engineering for each route
- [ ] Implement client-side service layer
- [ ] Handle error responses consistently
- [ ] Implement credit checking (if using same backend)
- [ ] Handle image uploads and base64 conversion
- [ ] Implement SSE streaming for assistant chat (if needed)
