'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SubscriptionModal from '@/components/subscription-modal'
import { ChatMessage } from '@/components/studio/chat-message'
import { getItemSafe, setItemWithCap } from '@/lib/utils/safe-storage'
import { cn } from '@/lib/utils'
import type { TierName } from '@/lib/constants/subscription-tiers'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
  toolResults?: Array<{ tool: string; result: unknown }>
}

const WELCOME = `I'm your YouTube assistant. Ask me about your channel, videos, or analytics—for example:
• "What are my top 3 videos from last week?"
• "Show my channel analytics for the last 28 days"
• "Search for trending videos about productivity"`

const ASSISTANT_CHAT_STORAGE_KEY = 'studio-assistant-chat'
const MAX_ASSISTANT_MESSAGES = 50
const MAX_ASSISTANT_PAYLOAD_BYTES = 2 * 1024 * 1024 // 2 MB
const MAX_MESSAGE_CONTENT_LENGTH = 100_000

const WELCOME_MESSAGE: AssistantMessage = { role: 'assistant', content: WELCOME }

/** Stored shape: one key for messages + draft. */
interface StoredAssistantChat {
  messages: AssistantMessage[]
  draft?: string
}

/**
 * Load and validate assistant chat from sessionStorage. Returns null if missing or invalid.
 */
function loadFromStorage(): StoredAssistantChat | null {
  if (typeof window === 'undefined') return null
  const raw = getItemSafe(ASSISTANT_CHAT_STORAGE_KEY, { storage: sessionStorage })
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as StoredAssistantChat).messages))
      return null
    const { messages: rawMessages, draft } = parsed as StoredAssistantChat
    const messages: AssistantMessage[] = []
    for (const m of rawMessages) {
      if (!m || typeof m !== 'object') continue
      const role = m.role === 'user' || m.role === 'assistant' ? m.role : 'assistant'
      const content = typeof m.content === 'string'
        ? m.content.slice(0, MAX_MESSAGE_CONTENT_LENGTH)
        : ''
      const toolResults = Array.isArray(m.toolResults)
        ? (m.toolResults as Array<{ tool: string; result: unknown }>).slice(0, 20).filter(
            (tr) => tr && typeof tr.tool === 'string'
          )
        : undefined
      messages.push({ role, content, toolResults })
    }
    if (messages.length === 0) return null
    return {
      messages,
      draft: typeof draft === 'string' ? draft.slice(0, 10000) : '',
    }
  } catch {
    return null
  }
}

/**
 * Deduplicate tool results by tool name (keep last). The agent can call the same tool
 * multiple times across rounds, which would otherwise show duplicate cards (e.g. "Your videos" 3x).
 */
function dedupeToolResults(
  arr: Array<{ tool: string; result: unknown }>
): Array<{ tool: string; result: unknown }> {
  const byTool = new Map<string, { tool: string; result: unknown }>()
  for (const tr of arr) {
    byTool.set(tr.tool, tr)
  }
  return Array.from(byTool.values())
}

/**
 * Trim payload to stay under cap: drop oldest message; same shape { messages, draft } in and out.
 */
function trimAssistantPayload(payload: string): string {
  try {
    const obj = JSON.parse(payload) as StoredAssistantChat
    if (!obj || typeof obj !== 'object' || !Array.isArray(obj.messages)) {
      return JSON.stringify({ messages: [WELCOME_MESSAGE], draft: '' })
    }
    if (obj.messages.length > 1) {
      obj.messages.shift()
      return JSON.stringify(obj)
    }
    return JSON.stringify({ messages: [WELCOME_MESSAGE], draft: '' })
  } catch {
    return JSON.stringify({ messages: [WELCOME_MESSAGE], draft: '' })
  }
}

function saveToStorage(messages: AssistantMessage[], draft: string): void {
  if (typeof window === 'undefined') return
  const toSave: StoredAssistantChat = {
    messages: messages.slice(-MAX_ASSISTANT_MESSAGES),
    draft,
  }
  const payload = JSON.stringify(toSave)
  setItemWithCap(ASSISTANT_CHAT_STORAGE_KEY, payload, {
    storage: sessionStorage,
    maxBytes: MAX_ASSISTANT_PAYLOAD_BYTES,
    trim: trimAssistantPayload,
  })
}

export interface StudioAssistantPanelProps {
  /** Current tier for SubscriptionModal when TIER_REQUIRED is returned */
  tier: TierName
  /** Current product ID for SubscriptionModal */
  productId: string | null
  className?: string
}

/**
 * Reusable YouTube AI assistant interaction area: message list, input, send, loading/error, data cards.
 * Renders only the chat UI; parent is responsible for Pro gating (show CTA vs this panel).
 * On TIER_REQUIRED from API, opens SubscriptionModal (uses tier/productId props).
 */
export function StudioAssistantPanel({ tier, productId, className }: StudioAssistantPanelProps) {
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasHydratedRef = useRef(false)

  // Restore from sessionStorage on mount; then mark hydrated so save effect can run.
  useEffect(() => {
    const stored = loadFromStorage()
    if (stored) {
      setMessages(stored.messages)
      setInputValue(stored.draft ?? '')
    }
    hasHydratedRef.current = true
  }, [])

  // Persist when messages or draft change; skip until after hydration to avoid overwriting stored data.
  useEffect(() => {
    if (!hasHydratedRef.current) return
    saveToStorage(messages, inputValue)
  }, [messages, inputValue])

  const sendMessage = useCallback(async () => {
    const text = inputValue.trim()
    if (!text || isLoading) return

    setInputValue('')
    setError(null)
    const userMessage: AssistantMessage = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const history = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }))
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })
      const data = (await res.json()) as {
        success?: boolean
        message?: string
        toolResults?: Array<{ tool: string; result: unknown }>
        error?: string
        code?: string
      }

      if (!res.ok) {
        if (data.code === 'TIER_REQUIRED') {
          setSubscriptionModalOpen(true)
        } else {
          setError(data.error || data.message || 'Something went wrong')
        }
        setIsLoading(false)
        return
      }

      const assistantMessage: AssistantMessage = {
        role: 'assistant',
        content: data.message ?? "I couldn't generate a response.",
        toolResults: data.toolResults,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setIsLoading(false)
    }
  }, [inputValue, isLoading, messages])

  return (
    <>
      <div className={cn('flex h-full flex-col overflow-hidden', className)}>
        <div className="flex-1 overflow-y-auto hide-scrollbar">
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.map((msg, i) => (
              <div key={i}>
                <ChatMessage
                  role={msg.role}
                  content={msg.content}
                  timestamp={undefined}
                />
                {msg.toolResults && msg.toolResults.length > 0 && (
                  <div className="mt-2 ml-6 space-y-2">
                    {dedupeToolResults(msg.toolResults).map((tr, j) => (
                      <AssistantDataCard key={`${tr.tool}-${j}`} tool={tr.tool} result={tr.result} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
                Thinking…
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-card px-4 py-2">
          <div className="flex w-full gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Ask about your channel, videos, or analytics…"
              disabled={isLoading}
              className="min-w-0"
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !inputValue.trim()}
              size="icon"
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        currentTier={tier}
        currentProductId={productId}
      />
    </>
  )
}

/**
 * Renders a single tool result as a data card (videos list, analytics, search results, etc.).
 */
export function AssistantDataCard({
  tool,
  result,
}: {
  tool: string
  result: unknown
}) {
  const r = result as Record<string, unknown>
  if (!r || typeof r !== 'object') return null

  if (r.error && typeof r.error === 'string') {
    return (
      <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        {tool}: {r.error}
      </div>
    )
  }

  if (tool === 'list_my_videos' && Array.isArray(r.videos)) {
    const videos = r.videos as Array<{
      videoId?: string
      title?: string
      thumbnailUrl?: string
      viewCount?: number
    }>
    return (
      <div className="rounded-md border border-border bg-muted/50 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Your videos
        </p>
        <ul className="space-y-2">
          {videos.slice(0, 5).map((v, i) => (
            <li key={i} className="flex gap-2 text-sm">
              {v.thumbnailUrl && (
                <img
                  src={v.thumbnailUrl}
                  alt=""
                  className="h-12 w-20 shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="truncate font-medium">{v.title || v.videoId}</p>
                {v.viewCount != null && (
                  <p className="text-xs text-muted-foreground">
                    {v.viewCount.toLocaleString()} views
                  </p>
                )}
              </div>
            </li>
          ))}
          {(r.videos as unknown[]).length > 5 && (
            <p className="text-xs text-muted-foreground">
              + {(r.videos as unknown[]).length - 5} more
            </p>
          )}
        </ul>
      </div>
    )
  }

  if (tool === 'search_videos' && Array.isArray(r.items)) {
    const items = r.items as Array<{
      videoId?: string
      title?: string
      thumbnailUrl?: string
      channelTitle?: string
    }>
    return (
      <div className="rounded-md border border-border bg-muted/50 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Search results
        </p>
        <ul className="space-y-2">
          {items.slice(0, 5).map((v, i) => (
            <li key={i} className="flex gap-2 text-sm">
              {v.thumbnailUrl && (
                <img
                  src={v.thumbnailUrl}
                  alt=""
                  className="h-12 w-20 shrink-0 rounded object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="truncate font-medium">{v.title || v.videoId}</p>
                {v.channelTitle && (
                  <p className="text-xs text-muted-foreground">{v.channelTitle}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (tool === 'get_channel_analytics' && (r.views != null || r.watchTimeMinutes != null)) {
    return (
      <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Channel analytics
        </p>
        <div className="flex flex-wrap gap-4">
          {r.views != null && (
            <span>
              <strong>{Number(r.views).toLocaleString()}</strong> views
            </span>
          )}
          {r.watchTimeMinutes != null && (
            <span>
              <strong>{Number(r.watchTimeMinutes).toLocaleString()}</strong> min watch time
            </span>
          )}
          {r.likes != null && (
            <span>
              <strong>{Number(r.likes).toLocaleString()}</strong> likes
            </span>
          )}
          {r.comments != null && (
            <span>
              <strong>{Number(r.comments).toLocaleString()}</strong> comments
            </span>
          )}
        </div>
      </div>
    )
  }

  if (tool === 'get_video_analytics' && (r.views != null || r.watchTimeMinutes != null)) {
    return (
      <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Video analytics
        </p>
        <div className="flex flex-wrap gap-4">
          {r.views != null && (
            <span>
              <strong>{Number(r.views).toLocaleString()}</strong> views
            </span>
          )}
          {r.watchTimeMinutes != null && (
            <span>
              <strong>{Number(r.watchTimeMinutes).toLocaleString()}</strong> min watch time
            </span>
          )}
          {r.averageViewDurationSeconds != null && (
            <span>
              <strong>{Number(r.averageViewDurationSeconds).toFixed(0)}s</strong> avg view
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
      <span className="font-medium">{tool}</span>: data returned
    </div>
  )
}
