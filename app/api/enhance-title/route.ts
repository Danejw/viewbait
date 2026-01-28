/**
 * Title Enhancement API Route
 * 
 * Handles title enhancement using Google Gemini API.
 * Validates subscription tier (Starter+) and returns title suggestions.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getTierByProductId } from '@/lib/server/data/subscription-tiers'
import { callGeminiTextGeneration } from '@/lib/services/ai-core'
import { sanitizeErrorForClient } from '@/lib/utils/error-sanitizer'
import { requireAuth } from '@/lib/server/utils/auth'

export interface EnhanceTitleRequest {
  title: string
  style?: string
  emotion?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    // Parse request body
    const body: EnhanceTitleRequest = await request.json()
    
    // Validate required fields
    if (!body.title || !body.title.trim()) {
      return NextResponse.json(
        { error: 'Title is required', code: 'VALIDATION_ERROR' },
        { status: 400 }
      )
    }

    // Get user subscription
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (subError && subError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Failed to fetch subscription', code: 'SUBSCRIPTION_ERROR' },
        { status: 500 }
      )
    }

    // Check subscription tier (Starter+ required)
    const tier = subscription 
      ? await getTierByProductId(subscription.product_id)
      : await getTierByProductId(null)

    if (!tier.has_enhance) {
      return NextResponse.json(
        { 
          error: 'Title enhancement is only available for Starter tier and above',
          code: 'TIER_LIMIT'
        },
        { status: 403 }
      )
    }

    // Check if AI service is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'AI service not configured', code: 'CONFIG_ERROR' },
        { status: 500 }
      )
    }

    // Build prompts inline (server-side only - prompts never exposed to frontend)
    const systemPrompt = `You are an expert YouTube title optimizer. Your job is to transform video topics into compelling, click-worthy titles that maximize curiosity while maintaining integrity.

## Core Principles

1. **Make one clear promise**: What is the payoff if someone clicks? (learn X, see Y, feel Z)

2. **Maximize curiosity**: Open a loop (mystery, tension, surprise) that only the video closes. Do NOT answer the question in the title.

3. **Avoid betrayal**: The title must match the real content. If someone watches the first 30-60 seconds and feels misled, the title was bad clickbait.

## Title Optimization Rules

- **Be specific and concrete**: "This Idea Broke Math" beats "Interesting Math Problem" because it implies consequences and surprise
- **Frame around outcome or conflict**: "I Tried the Most Addictive App" or "This Trick Beat a Chess Grandmaster" instead of neutral descriptions
- **Use proven patterns**:
  - "You're Doing X Wrong"
  - "Why X Is So Hard"
  - "X Is More Powerful Than You Think"
  - "This Simple Idea Changed Y"
  - "The Truth About X"
  - "How X Actually Works"

## For AI/Dev/Tech Content

- Anchor in concrete wins or failures: "This Tiny Model Beat GPT-4 On My Task" or "The Prompt That Destroyed My App"
- Use dramatic before/after implications
- Keep content honest; use packaging as the "on-ramp" to hard ideas

## Output Format

Return EXACTLY 3 enhanced title variations, one per line. Each should be:
- Under 60 characters (optimal for YouTube display)
- Capitalizing key words for emphasis
- Creating curiosity without being misleading
- Different approaches (one emotional, one specific/outcome-based, one pattern-based)

Do not include numbers, bullets, or any other formatting. Just three titles, one per line.`

    const userPrompt = `Optimize this video topic/title for maximum clicks while staying honest to the content:

"${body.title.trim()}"`

    // Call AI core service
    let response
    try {
      response = await callGeminiTextGeneration(systemPrompt, userPrompt, 'gemini-3-pro-preview')
    } catch (error) {
      return NextResponse.json(
        { 
          error: sanitizeErrorForClient(error, 'enhance-title-ai', 'Failed to enhance title'),
          code: 'AI_SERVICE_ERROR'
        },
        { status: 500 }
      )
    }
    
    // Parse response: split by newlines, filter empty lines, take first 3
    const suggestions = response
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, 3)

    return NextResponse.json({
      suggestions: suggestions || [],
    })
  } catch (error) {
    // requireAuth throws NextResponse, so check if it's already a response
    if (error instanceof NextResponse) {
      return error
    }
    return NextResponse.json(
      { 
        error: sanitizeErrorForClient(error, 'enhance-title-route', 'Internal server error'),
        code: 'INTERNAL_ERROR'
      },
      { status: 500 }
    )
  }
}
