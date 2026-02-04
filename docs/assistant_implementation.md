# YouTube AI Assistant Implementation

This document describes the Pro-only YouTube AI assistant: text chat (MVP), execute-tool API, optional live-token for voice, and how they fit together.

---

## 1. Overview

The assistant lets Pro users ask questions about their YouTube channel, videos, and analytics via natural language. The MVP is **text-only** at `/studio/assistant`: the user types messages, the backend calls Gemini with a set of YouTube tools, runs tool calls server-side, and returns a final message plus optional **data cards** (e.g. video list, channel analytics).

**Planned extension:** Real-time voice via Gemini Live API using an ephemeral token from `POST /api/agent/live-token`. The client would open a WebSocket to the Live API with that token; when the model requests a tool call, the client would call `POST /api/agent/execute-tool` and send the result back. Until that flow is verified and wired in the UI, the assistant remains text-only.

---

## 2. Architecture

- **Text flow (MVP):**  
  `Client (Assistant tab)` → `POST /api/agent/chat` with `{ messages }` → Server runs a loop: Gemini `generateContent` with tool definitions; if the model returns a function call, the server runs the handler from the **tool registry** and appends the result to the conversation, then calls Gemini again; when the model returns text, the server responds with `{ message, toolResults? }`. The client renders the message and data cards from `toolResults`.

- **Voice flow (future):**  
  Client gets an ephemeral token from `POST /api/agent/live-token`, opens a WebSocket to the Gemini Live API, and streams voice. When the Live API sends a tool call, the client calls `POST /api/agent/execute-tool` with `{ tool, params }`, then sends the JSON result back on the WebSocket.

- **Tool execution:**  
  All tools are defined in a single **registry** ([lib/server/agent/tool-registry.ts](viewbait/lib/server/agent/tool-registry.ts)): each entry has a Zod schema and a handler. `POST /api/agent/execute-tool` looks up the tool by name, validates `params` with the schema, and runs the handler with the authenticated user id and optional context (`tier`, `connected`). This keeps allowlist and validation in one place.

---

## 3. APIs

### POST /api/agent/chat

- **Auth:** Required. **Tier:** Pro only (403 `TIER_REQUIRED` otherwise).
- **Body:** `{ messages: Array<{ role: 'user' | 'assistant', content: string }> }`.
- **Response:** `{ success: true, message: string, toolResults?: Array<{ tool: string, result: unknown }> }` or `{ success: false, error?, message?, code? }`.
- **Behavior:** Builds a system instruction with user context (tier, YouTube connected). Sends conversation to Gemini with agent tool declarations. On model function call, runs the corresponding registry handler and continues the conversation until the model returns text or max rounds. Returns the last text and any tool results for the client to render as data cards.

### POST /api/agent/execute-tool

- **Auth:** Required.
- **Body:** `{ tool: string, params: Record<string, unknown> }`.
- **Response:** `{ success: true, result: unknown }` or `{ success: false, error: string, code?: string }`.
- **Codes:** `TIER_REQUIRED`, `NOT_CONNECTED`, `VALIDATION_ERROR`, `TOOL_ERROR` (see [lib/server/utils/error-handler.ts](viewbait/lib/server/utils/error-handler.ts)).
- **Behavior:** Resolves tier and YouTube connection; for tools with `requiresYouTube`, enforces Pro and connected. Looks up the tool in the registry, validates `params` with the tool’s Zod schema, runs the handler with the user id and context, and returns the result.

### POST /api/agent/live-token

- **Auth:** Required. **Tier:** Pro only.
- **Response:** `{ success: true, token: string, expiresIn: number }` or error with `code` (e.g. `TIER_REQUIRED`, `CONFIG_ERROR`, `TOKEN_ERROR`).
- **Behavior:** Uses `@google/genai` to create an ephemeral token for the Live API. The client uses this token to open a WebSocket to Gemini Live. Requires `GEMINI_API_KEY` server-side.

---

## 4. Tool Registry

- **File:** [lib/server/agent/tool-registry.ts](viewbait/lib/server/agent/tool-registry.ts).
- **Shape:** `Record<string, { schema: ZodSchema, handler: ToolHandler, requiresYouTube: boolean }>`.
- **Handlers:** Receive `(userId, params, context?)` and return JSON-serializable data. YouTube tools use [lib/services/youtube.ts](viewbait/lib/services/youtube.ts) (e.g. `fetchMyChannelVideos`, `fetchYouTubeAnalytics`, `searchVideos`, `fetchVideoComments`).
- **Tools:**  
  `check_youtube_connection`, `list_my_videos`, `get_video_details`, `search_videos`, `get_playlist_videos`, `get_video_comments`, `get_channel_analytics`, `get_video_analytics`, `get_my_channel_info`.

Adding a new tool: add an entry to the registry (schema + handler + `requiresYouTube`), and add the corresponding declaration to the agent chat route’s `agentToolDeclarations` (and to the Live API client config when voice is implemented).

---

## 5. Pro and YouTube Gating

- **Server:** All three routes (`/api/agent/chat`, `/api/agent/execute-tool`, `/api/agent/live-token`) use `getTierNameForUser(supabase, user.id)`. For chat and live-token, Pro is required to call the route. For execute-tool, tools with `requiresYouTube` require `tierName === 'pro'` and `isYouTubeConnected(user.id)`; otherwise 403 with `TIER_REQUIRED` or `NOT_CONNECTED`.
- **Client:** The Assistant tab (StudioViewAssistant in [components/studio/studio-views.tsx](viewbait/components/studio/studio-views.tsx)) gates with `useSubscription().tier === 'pro'`. If not Pro, it shows an upgrade CTA and opens the existing **SubscriptionModal**. Tier is not checked in middleware; it is enforced in the page and in the API routes.
- **Single rule:** “YouTube = Pro” is implemented as `tierName === 'pro'` everywhere; no separate capability flag.

---

## 6. UI

- **Route:** The assistant is a **tab** on `/studio` (no separate page). `/studio/assistant` redirects to `/studio` for backwards compatibility. Middleware protects `/studio` (auth); no tier check in middleware.
- **Entry:** Sidebar nav has an “Assistant” item (Pro-only; locked otherwise, click opens SubscriptionModal). Clicking it sets `currentView` to `"assistant"` and shows the assistant in the **center** panel between the two sidebars.
- **Center content:** When the Assistant tab is active, the center shows either the Pro CTA (upgrade prompt) or the reusable assistant panel: message list, text input, optional data cards per message (videos list, search results, channel/video analytics). Connection/error state and “Connect YouTube” or “Upgrade to Pro” when the API returns `NOT_CONNECTED` or `TIER_REQUIRED`.

---

## 7. File Reference

| Area        | File | Purpose |
|------------|------|--------|
| Registry   | [lib/server/agent/tool-registry.ts](viewbait/lib/server/agent/tool-registry.ts) | Tool allowlist, Zod schemas, handlers |
| Execute-tool | [app/api/agent/execute-tool/route.ts](viewbait/app/api/agent/execute-tool/route.ts) | POST execute-tool; auth, validation, dispatch |
| Chat       | [app/api/agent/chat/route.ts](viewbait/app/api/agent/chat/route.ts) | POST agent chat; Gemini loop + tool execution |
| Live token | [app/api/agent/live-token/route.ts](viewbait/app/api/agent/live-token/route.ts) | POST ephemeral token for Live API (Pro) |
| Assistant tab | [components/studio/studio-views.tsx](viewbait/components/studio/studio-views.tsx) (StudioViewAssistant) | Pro CTA or center panel |
| Assistant panel | [components/studio/studio-assistant-panel.tsx](viewbait/components/studio/studio-assistant-panel.tsx) | Reusable chat UI, data cards, SubscriptionModal on TIER_REQUIRED |
| Redirect | [app/studio/assistant/page.tsx](viewbait/app/studio/assistant/page.tsx) | Redirects to /studio |
| Sidebar    | [components/studio/studio-sidebar.tsx](viewbait/components/studio/studio-sidebar.tsx) | Assistant nav item (view: assistant, Pro gating) |
| YouTube    | [lib/services/youtube.ts](viewbait/lib/services/youtube.ts) | searchVideos, fetchVideoComments, fetchMyChannelVideos, etc. |

---

## 8. Metrics and Logging

- **Backend:** Log (no PII) when a live token is issued, when execute-tool or agent chat is called (tool name, success/failure, latency). Use [lib/server/utils/logger](viewbait/lib/server/utils/logger).
- **Client:** Optional: track assistant opened, message sent, tool result cards shown.

---

## 9. Summary

- **Text MVP:** Pro users open the Assistant tab on `/studio`, send messages to `POST /api/agent/chat`; the server runs Gemini with agent tools and returns a message plus optional tool results for data cards. The assistant interaction area is a reusable component used in the studio center panel.
- **Execute-tool:** Single registry (name → schema + handler); used by the chat route internally and by the future Live API client for each tool call.
- **Live token:** Pro-only endpoint that returns an ephemeral token for the Gemini Live API; voice UI and WebSocket handling are not yet implemented.
- **Gating:** Pro and “YouTube connected” are enforced in the API and in the Assistant tab (StudioViewAssistant) via `useSubscription().tier === 'pro'` and existing SubscriptionModal.
