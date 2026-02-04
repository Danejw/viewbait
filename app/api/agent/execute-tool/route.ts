/**
 * POST /api/agent/execute-tool
 *
 * Executes an agent tool (YouTube Data/Analytics, connection check) on behalf of the
 * authenticated user. Uses a single registry: allowlist + Zod validation.
 * Pro + YouTube connected required for YouTube tools (except check_youtube_connection).
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/server/utils/auth'
import { getTierNameForUser } from '@/lib/server/utils/tier'
import { validationErrorResponse } from '@/lib/server/utils/error-handler'
import { handleApiError } from '@/lib/server/utils/api-helpers'
import { logError, logInfo } from '@/lib/server/utils/logger'
import { NextResponse } from 'next/server'
import {
  AGENT_TOOL_REGISTRY,
  AGENT_TOOL_NAMES,
  type AgentToolContext,
} from '@/lib/server/agent/tool-registry'
import { isYouTubeConnected } from '@/lib/services/youtube'

const BODY_SCHEMA = {
  tool: (v: unknown) => typeof v === 'string' && v.length > 0,
  params: (v: unknown) => v === null || (typeof v === 'object' && !Array.isArray(v)),
}

export async function POST(request: Request) {
  const start = Date.now()
  try {
    const supabase = await createClient()
    const user = await requireAuth(supabase)

    const body = await request.json()
    if (!BODY_SCHEMA.tool(body.tool) || !BODY_SCHEMA.params(body.params)) {
      return validationErrorResponse(
        'Request body must include tool (string) and params (object).'
      )
    }

    const toolName = body.tool as string
    const rawParams = body.params ?? {}

    if (!AGENT_TOOL_NAMES.includes(toolName)) {
      return validationErrorResponse(
        `Unknown tool: ${toolName}. Allowed: ${AGENT_TOOL_NAMES.join(', ')}`
      )
    }

    const tierName = await getTierNameForUser(supabase, user.id)
    const connected = await isYouTubeConnected(user.id)
    const context: AgentToolContext = { tier: tierName, connected }

    const entry = AGENT_TOOL_REGISTRY[toolName]
    if (entry.requiresYouTube) {
      if (tierName !== 'pro') {
        return NextResponse.json(
          {
            success: false,
            error: 'This action requires a Pro subscription.',
            code: 'TIER_REQUIRED',
          },
          { status: 403 }
        )
      }
      if (!connected) {
        return NextResponse.json(
          {
            success: false,
            error: 'YouTube is not connected. Please connect your channel in settings.',
            code: 'NOT_CONNECTED',
          },
          { status: 403 }
        )
      }
    }

    const parsed = entry.schema.safeParse(rawParams)
    if (!parsed.success) {
      const first = parsed.error.flatten().fieldErrors
      const msg = Object.entries(first)
        .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
        .join('; ')
      return validationErrorResponse(`Invalid params: ${msg}`)
    }

    const result = await entry.handler(user.id, parsed.data, context)

    logInfo('Agent execute-tool success', {
      route: 'POST /api/agent/execute-tool',
      tool: toolName,
      userId: user.id,
      latencyMs: Date.now() - start,
    })

    return NextResponse.json({ success: true, result })
  } catch (error) {
    if (error instanceof NextResponse) return error

    const message = error instanceof Error ? error.message : 'Tool execution failed'
    logError(error, {
      route: 'POST /api/agent/execute-tool',
      operation: 'execute-tool',
      latencyMs: Date.now() - start,
    })

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: 'TOOL_ERROR',
      },
      { status: 500 }
    )
  }
}
