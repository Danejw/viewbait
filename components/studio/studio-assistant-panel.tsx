'use client'

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SubscriptionModal from '@/components/subscription-modal'
import { ChatMessage } from '@/components/studio/chat-message'
import { track } from '@/lib/analytics/track'
import { DynamicUIRenderer, type UIComponentName } from '@/components/studio/dynamic-ui-renderer'
import { useStudio } from '@/components/studio/studio-provider'
import { useStyles } from '@/lib/hooks/useStyles'
import { usePalettes } from '@/lib/hooks/usePalettes'
import { getItemSafe, setItemWithCap } from '@/lib/utils/safe-storage'
import { cn } from '@/lib/utils'
import type { TierName } from '@/lib/constants/subscription-tiers'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
  toolResults?: Array<{ tool: string; result: unknown }>
  /** Thumbnail-help UI sections to show below the message (from thumbnail_assistant_response) */
  uiComponents?: string[]
  /** Suggestion chips for follow-up (e.g. "3 variations", "Use 16:9") */
  suggestions?: string[]
  /** Show "Upgrade to Pro" chip when true */
  offerUpgrade?: boolean
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
      const uiComponents = Array.isArray(m.uiComponents)
        ? (m.uiComponents as string[]).slice(0, 20)
        : undefined
      const suggestions = Array.isArray(m.suggestions)
        ? (m.suggestions as string[]).slice(0, 10)
        : undefined
      const offerUpgrade = typeof m.offerUpgrade === 'boolean' ? m.offerUpgrade : undefined
      messages.push({ role, content, toolResults, uiComponents, suggestions, offerUpgrade })
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
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function StudioAssistantPanel({ tier, productId, className }: StudioAssistantPanelProps) {
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([WELCOME_MESSAGE])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasHydratedRef = useRef(false)
  const pulseRequestedRef = useRef(false)
  const studio = useStudio()
  const { styles: stylesList, defaultStyles } = useStyles({ autoFetch: true })
  const { palettes: palettesList, defaultPalettes } = usePalettes({ includeDefaults: true, autoFetch: true })

  const availableStyles = useMemo(() => {
    const all = [...(defaultStyles ?? []), ...(stylesList ?? [])].filter(Boolean)
    return all.map((s) => ({ id: s.id, name: s.name ?? '' }))
  }, [stylesList, defaultStyles])

  const availablePalettes = useMemo(() => {
    const all = [...(defaultPalettes ?? []), ...(palettesList ?? [])].filter(Boolean)
    return all.map((p) => ({ id: p.id, name: p.name ?? '' }))
  }, [palettesList, defaultPalettes])

  const formState = useMemo(() => {
    if (!studio?.state) return null
    const s = studio.state
    return {
      thumbnailText: s.thumbnailText ?? '',
      includeFace: s.includeFaces ?? false,
      selectedFaces: s.selectedFaces ?? [],
      expression: s.faceExpression !== 'None' ? s.faceExpression : null,
      pose: s.facePose !== 'None' ? s.facePose : null,
      includeStyleReferences: s.includeStyleReferences ?? false,
      styleReferences: s.styleReferences ?? [],
      selectedStyle: s.selectedStyle ?? null,
      selectedColor: s.selectedPalette ?? null,
      selectedAspectRatio: s.selectedAspectRatio ?? '16:9',
      selectedResolution: s.selectedResolution ?? '1K',
      variations: s.variations ?? 1,
      customInstructions: s.customInstructions ?? '',
    }
  }, [studio?.state])

  /** Resolve style/palette name to ID when API returns a name instead of UUID */
  const resolveFormStateUpdates = useCallback(
    (updates: Record<string, unknown>) => {
      const out = { ...updates }
      if (out.selectedStyle != null && !UUID_LIKE.test(String(out.selectedStyle))) {
        const byName = availableStyles.find(
          (s) => s.name?.toLowerCase() === String(out.selectedStyle).toLowerCase()
        )
        if (byName) out.selectedStyle = byName.id
      }
      if (out.selectedColor != null && !UUID_LIKE.test(String(out.selectedColor))) {
        const byName = availablePalettes.find(
          (p) => p.name?.toLowerCase() === String(out.selectedColor).toLowerCase()
        )
        if (byName) out.selectedColor = byName.id
      }
      return out
    },
    [availableStyles, availablePalettes]
  )

  // Restore from sessionStorage on mount; then mark hydrated so save effect can run.
  useEffect(() => {
    const stored = loadFromStorage()
    if (stored) {
      setMessages(stored.messages)
      setInputValue(stored.draft ?? '')
    }
    hasHydratedRef.current = true
  }, [])

  // Optional: run channel pulse once when assistant is opened with only welcome message
  useEffect(() => {
    if (!hasHydratedRef.current || pulseRequestedRef.current || !studio) return
    const isOnlyWelcome =
      messages.length === 1 &&
      messages[0].role === 'assistant' &&
      messages[0].content === WELCOME
    if (!isOnlyWelcome) return
    pulseRequestedRef.current = true
    setIsLoading(true)
    fetch('/api/agent/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [],
        runChannelPulse: true,
        focusedVideoId: studio.state.focusedVideoId ?? undefined,
        focusedVideoTitle: studio.state.focusedVideoTitle ?? undefined,
      }),
    })
      .then((res) => res.json())
      .then((data: { success?: boolean; message?: string; toolResults?: Array<{ tool: string; result: unknown }>; error?: string; code?: string }) => {
        if (data.code === 'TIER_REQUIRED') {
          setSubscriptionModalOpen(true)
          return
        }
        if (data.success && data.message) {
          setMessages([
            {
              role: 'assistant',
              content: data.message,
              toolResults: data.toolResults,
            },
          ])
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [messages.length, messages[0]?.content, studio])

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
    track('assistant_message_sent')
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
        body: JSON.stringify({
          messages: history,
          focusedVideoId: studio?.state?.focusedVideoId ?? undefined,
          focusedVideoTitle: studio?.state?.focusedVideoTitle ?? undefined,
          formState: formState ?? undefined,
          availableStyles,
          availablePalettes,
        }),
      })
      const data = (await res.json()) as {
        success?: boolean
        message?: string
        toolResults?: Array<{ tool: string; result: unknown }>
        form_state_updates?: Record<string, unknown>
        ui_components?: string[]
        suggestions?: string[]
        offer_upgrade?: boolean
        error?: string
        code?: string
      }

      if (!res.ok) {
        track('error', { context: 'assistant', message: 'agent_failed' })
        if (data.code === 'TIER_REQUIRED') {
          setSubscriptionModalOpen(true)
        } else {
          setError(data.error || data.message || 'Something went wrong')
        }
        setIsLoading(false)
        return
      }

      track('assistant_response_received')
      if (data.form_state_updates && studio?.actions?.applyFormStateUpdates) {
        const resolved = resolveFormStateUpdates(data.form_state_updates)
        studio.actions.applyFormStateUpdates(resolved as Record<string, any>)
      }

      const assistantMessage: AssistantMessage = {
        role: 'assistant',
        content: data.message ?? "I couldn't generate a response.",
        toolResults: data.toolResults,
        uiComponents: Array.isArray(data.ui_components) ? data.ui_components : undefined,
        suggestions: Array.isArray(data.suggestions) ? data.suggestions : undefined,
        offerUpgrade: !!data.offer_upgrade,
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setIsLoading(false)
    }
  }, [
    inputValue,
    isLoading,
    messages,
    formState,
    availableStyles,
    availablePalettes,
    resolveFormStateUpdates,
    studio,
  ])

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputValue(suggestion)
  }, [])

  return (
    <>
      <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
        <div className="min-h-0 flex-1 overflow-y-auto hide-scrollbar">
          <div className="mx-auto max-w-2xl space-y-4 p-4 pb-2">
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
                      <AssistantDataCard
                        key={`${tr.tool}-${j}`}
                        tool={tr.tool}
                        result={tr.result}
                        onGenerateThumbnail={studio?.actions?.openGeneratorForVideo}
                        onFocusVideo={studio?.actions?.setFocusedVideo}
                        focusedVideoId={studio?.state?.focusedVideoId ?? undefined}
                      />
                    ))}
                  </div>
                )}
                {msg.role === 'assistant' && ((msg.suggestions?.length ?? 0) > 0 || msg.offerUpgrade) && (
                  <div className="mt-2 ml-6 flex flex-wrap gap-1">
                    {(msg.suggestions ?? []).map((s, i) => (
                      <Button
                        key={`sug-${i}`}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleSuggestionClick(s)}
                      >
                        {s}
                      </Button>
                    ))}
                    {msg.offerUpgrade && (
                      <Button
                        variant="default"
                        size="sm"
                        className="text-xs"
                        onClick={() => setSubscriptionModalOpen(true)}
                      >
                        Upgrade to Pro
                      </Button>
                    )}
                  </div>
                )}
                {msg.role === 'assistant' && msg.uiComponents && msg.uiComponents.length > 0 && (
                  <div className="mt-2 ml-6">
                    <DynamicUIRenderer
                      components={msg.uiComponents as UIComponentName[]}
                    />
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

        <div className="shrink-0 border-t border-border bg-card px-4 py-3">
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

/** Video row with optional handoff actions (Generate thumbnail, Focus). */
function VideoRow({
  video,
  onGenerateThumbnail,
  onFocusVideo,
  isFocused,
}: {
  video: { videoId?: string; title?: string; thumbnailUrl?: string; viewCount?: number; channelTitle?: string }
  onGenerateThumbnail?: (v: { videoId: string; title?: string; thumbnailUrl?: string }) => void
  onFocusVideo?: (v: { videoId: string; title?: string } | null) => void
  isFocused?: boolean
}) {
  const id = video.videoId ?? ''
  const title = video.title ?? id
  return (
    <li className="flex flex-col gap-1.5 text-sm">
      <div className="flex gap-2">
        {video.thumbnailUrl && (
          <img
            src={video.thumbnailUrl}
            alt=""
            className="h-12 w-20 shrink-0 rounded object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{title}</p>
          {video.viewCount != null && (
            <p className="text-xs text-muted-foreground">
              {video.viewCount.toLocaleString()} views
            </p>
          )}
          {video.channelTitle && (
            <p className="text-xs text-muted-foreground">{video.channelTitle}</p>
          )}
        </div>
      </div>
      {(onGenerateThumbnail || onFocusVideo) && id && (
        <div className="flex flex-wrap gap-1">
          {onGenerateThumbnail && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => onGenerateThumbnail({ videoId: id, title, thumbnailUrl: video.thumbnailUrl })}
            >
              Generate thumbnail
            </Button>
          )}
          {onFocusVideo && (
            <Button
              variant={isFocused ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => onFocusVideo(isFocused ? null : { videoId: id, title })}
            >
              {isFocused ? 'Unfocus' : 'Focus on this video'}
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

/**
 * Renders a single tool result as a data card (videos list, analytics, search results, etc.).
 * Optional handoff: onGenerateThumbnail, onFocusVideo, focusedVideoId for sub-agent integration.
 */
export function AssistantDataCard({
  tool,
  result,
  onGenerateThumbnail,
  onFocusVideo,
  focusedVideoId,
}: {
  tool: string
  result: unknown
  onGenerateThumbnail?: (v: { videoId: string; title?: string; thumbnailUrl?: string }) => void
  onFocusVideo?: (v: { videoId: string; title?: string } | null) => void
  focusedVideoId?: string | null
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
        <ul className="space-y-3">
          {videos.slice(0, 10).map((v, i) => (
            <VideoRow
              key={i}
              video={v}
              onGenerateThumbnail={onGenerateThumbnail}
              onFocusVideo={onFocusVideo}
              isFocused={v.videoId === focusedVideoId}
            />
          ))}
          {(r.videos as unknown[]).length > 10 && (
            <p className="text-xs text-muted-foreground">
              + {(r.videos as unknown[]).length - 10} more
            </p>
          )}
        </ul>
      </div>
    )
  }

  if (tool === 'get_underperforming_videos' && Array.isArray(r.videos)) {
    const videos = r.videos as Array<{
      videoId?: string
      title?: string
      thumbnailUrl?: string
      views?: number
    }>
    return (
      <div className="rounded-md border border-border bg-muted/50 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Underperforming videos (below average views)
        </p>
        {r.averageViews != null && (
          <p className="mb-2 text-xs text-muted-foreground">
            Channel average: {Number(r.averageViews).toLocaleString()} views
          </p>
        )}
        <ul className="space-y-3">
          {videos.slice(0, 10).map((v, i) => (
            <VideoRow
              key={i}
              video={{ ...v, viewCount: v.views }}
              onGenerateThumbnail={onGenerateThumbnail}
              onFocusVideo={onFocusVideo}
              isFocused={v.videoId === focusedVideoId}
            />
          ))}
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
        <ul className="space-y-3">
          {items.slice(0, 5).map((v, i) => (
            <VideoRow
              key={i}
              video={v}
              onGenerateThumbnail={onGenerateThumbnail}
              onFocusVideo={onFocusVideo}
              isFocused={v.videoId === focusedVideoId}
            />
          ))}
        </ul>
      </div>
    )
  }

  if (tool === 'get_channel_pulse' && (r.channel != null || r.recentVideos != null)) {
    const recentVideos = (r.recentVideos as Array<{ videoId?: string; title?: string; thumbnailUrl?: string; viewCount?: number }>) ?? []
    return (
      <div className="rounded-md border border-border bg-muted/50 p-3">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Channel pulse
        </p>
        {r.channel != null && (
          <p className="mb-1 text-sm">
            {(r.channel as { title?: string }).title}
            {(r.channel as { subscriberCount?: number }).subscriberCount != null && (
              <span className="text-muted-foreground ml-1">
                ({(r.channel as { subscriberCount: number }).subscriberCount.toLocaleString()} subs)
              </span>
            )}
          </p>
        )}
        {r.analytics != null && (
          <div className="mb-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {(r.analytics as { views?: number }).views != null && (
              <span><strong>{(r.analytics as { views: number }).views?.toLocaleString()}</strong> views</span>
            )}
            {(r.analytics as { watchTimeMinutes?: number }).watchTimeMinutes != null && (
              <span><strong>{(r.analytics as { watchTimeMinutes: number }).watchTimeMinutes?.toLocaleString()}</strong> min watch time</span>
            )}
          </div>
        )}
        {recentVideos.length > 0 && (
          <ul className="mt-2 space-y-2">
            {recentVideos.slice(0, 5).map((v, i) => (
              <VideoRow
                key={i}
                video={v}
                onGenerateThumbnail={onGenerateThumbnail}
                onFocusVideo={onFocusVideo}
                isFocused={v.videoId === focusedVideoId}
              />
            ))}
          </ul>
        )}
      </div>
    )
  }

  if (tool === 'get_upload_rhythm' && Array.isArray(r.uploadDates)) {
    const uploadDates = r.uploadDates as Array<{ videoId?: string; title?: string; publishedAt?: string }>
    return (
      <div className="rounded-md border border-border bg-muted/50 p-3 text-sm">
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Upload rhythm
        </p>
        {typeof r.summary === 'string' && <p className="text-muted-foreground">{r.summary}</p>}
        {uploadDates.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {uploadDates.slice(0, 7).map((d, i) => (
              <li key={i}>
                {d.publishedAt ? new Date(d.publishedAt).toLocaleDateString() : ''} — {d.title ?? d.videoId}
              </li>
            ))}
          </ul>
        )}
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
