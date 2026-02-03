# Chat Interface & Agent Implementation for Thumbnail Creation

This document describes how the ViewBait chat interface and AI agent are implemented to help users create thumbnails, and how the system can be extended when needed.

---

## 1. Overview

The thumbnail creation flow offers two modes:

- **Manual mode**: User fills form sections (thumbnail text, style, palette, face, aspect ratio, etc.) and clicks Generate.
- **Chat mode**: User converses with an AI assistant; the assistant interprets intent, surfaces 1–2 relevant UI sections per turn, and can pre-fill form state. Both interfaces share the same underlying form state.

The agent does **not** call external tools (e.g. generate image). It returns **structured output** (a human-readable message, a list of UI component names, optional form state updates, and suggestions). The client renders the message, shows the suggested sections via `DynamicUIRenderer`, and applies form state updates so the user can refine and then trigger generation from the same form.

---

## 2. Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CLIENT (Studio)                                                            │
│  ┌─────────────────┐   ┌──────────────────┐   ┌─────────────────────────┐  │
│  │ StudioChatPanel │   │ ChatMessage      │   │ DynamicUIRenderer        │  │
│  │ (messages,      │   │ (user/assistant  │   │ (maps API component     │  │
│  │  input, reset)  │   │  bubbles,        │   │  names → StudioGenerator │  │
│  │                 │   │  Markdown)       │   │  sections)               │  │
│  └────────┬────────┘   └──────────────────┘   └───────────┬─────────────┘  │
│           │                                                 │                │
│           │  POST /api/assistant/chat?stream=true           │                │
│           │  { conversationHistory, formState,               │  applyFormState│
│           │    availableStyles, availablePalettes }         │  Updates()    │
│           ▼                                                 ▼                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ StudioProvider (state: form fields, mode, chatAssistant;             │   │
│  │  actions: applyFormStateUpdates, openVideoAnalyticsWithResult,       │   │
│  │   resetChat, setMode, generate...)                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SERVER                                                                     │
│  app/api/assistant/chat/route.ts                                            │
│  • getOptionalAuth()                                                        │
│  • Build system prompt (form state, UI components, instructions)            │
│  • Optional: 1) Gemini + googleSearch → grounding; 2) Gemini + function     │
│    calling → structured response                                             │
│  • processGroundingCitations() if grounding metadata present                 │
│  • Return: human_readable_message, ui_components[], form_state_updates?,    │
│    suggestions[] (JSON or SSE stream)                                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  AI CORE (lib/services/ai-core.ts)                                           │
│  callGeminiWithFunctionCalling(systemPrompt, userPrompt, imageData,          │
│    toolDefinitions[], allowedNames[], model, enableGoogleSearch)              │
│  • Tools: generate_assistant_response; create_feedback;                      │
│    youtube_analyze_video (video_id); youtube_extract_style (video_ids[])     │
│    — route executes create_feedback insert; runs analyze/extract+create      │
│    for Pro users and returns youtube_analytics or form_state_updates         │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Current Implementation

### 3.1 Entry Points & UI Placement

- **Generator left sidebar**: `StudioGenerator` switches on `mode` (`"manual"` | `"chat"`). In chat mode it renders `StudioGeneratorChat`, which wraps `StudioChatPanel`.
- **Mode switch**: `StudioGeneratorTabs` (Manual / Chat) and the right sidebar collapsed view both call `setMode("manual")` or `setMode("chat")`. Chat mode can be opened via `openChatAssistant()` from the right sidebar.
- **Legacy**: `StudioChatAssistant` (floating panel) and `StudioChatToggle` use `chatAssistant` state and `sendChatMessage`; the main in-sidebar experience is `StudioChatPanel`.

### 3.2 Client: StudioChatPanel (`components/studio/studio-chat.tsx`)

- **State**: `messages` (user/assistant with optional `uiComponents`, `suggestions`, `offerUpgrade`), `inputValue`, `isLoading`, `error`, `thinkingState` (status, toolCalls, streamedText), `subscriptionModalOpen`.
- **Persistence**: Messages saved to `localStorage` under `thumbnail-assistant-chat-history`; loaded on mount; saved fields include `role`, `content`, `timestamp`, `uiComponents`, `suggestions`, `offerUpgrade` so the upgrade chip survives reload. Reset clears storage and optionally form via `resetChat(true)`.
- **Form state for API**: Built from `useStudio()` state (thumbnailText, includeFaces, selectedFaces, faceExpression, facePose, styleReferences, selectedStyle, selectedPalette, aspect ratio, resolution, variations, customInstructions). Also sends `availableStyles` and `availablePalettes` from `useStyles()` / `usePalettes()`.
- **Request**: `POST /api/assistant/chat?stream=true` with `{ conversationHistory, formState, availableStyles, availablePalettes }`.
- **Stream handling**: Parses SSE events:
  - `status` → update thinking message (e.g. "Analyzing conversation...", "Searching for context...", "Generating response...").
  - `tool_call` → update tool call list (calling/complete).
  - `text_chunk` → append to streamed text in thinking UI.
  - `complete` → build assistant message with `human_readable_message`, `ui_components`, `suggestions`, `offerUpgrade` (from `offer_upgrade`); apply `form_state_updates` (with style/palette name→id resolution) via `applyFormStateUpdates`; append message and clear thinking.
  - `error` → show error and optional fallback message.
- **UI**: Message list (user/assistant), suggestion chips, optional “Upgrade to Pro” chip when `message.offerUpgrade` is true (opens `SubscriptionModal` on click), `DynamicUIRenderer` for each assistant message’s `uiComponents`, `ThinkingMessage` while loading, input + send, Reset button. `SubscriptionModal` is rendered in the panel with local state; `tier` and `productId` from `useSubscription()`.

### 3.3 Client: ChatMessage (`components/studio/chat-message.tsx`)

- Renders a single bubble: user as plain text, assistant as Markdown via `ReactMarkdown` (with code block styling). Optional timestamp.

### 3.4 Client: ThinkingMessage (`components/studio/thinking-message.tsx`)

- Shows status line, optional expandable “Tool calls” list, and optional streamed text preview while the assistant is responding.

### 3.5 Client: DynamicUIRenderer (`components/studio/dynamic-ui-renderer.tsx`)

- **Role**: Maps API response `ui_components` (e.g. `ThumbnailTextSection`, `IncludeFaceSection`) to the same sections used in manual mode so chat “surfaces” the right part of the form.
- **COMPONENT_MAP**: Each name maps to a component from `studio-generator.tsx` (e.g. `StudioGeneratorThumbnailText`, `StudioGeneratorFaces`, `StudioGeneratorPalette`, `StudioGeneratorSubmit`, or compact “Register” cards that switch view to faces/styles/palettes).
- **Usage**: For each assistant message, `StudioChatPanel` renders `<DynamicUIRenderer components={msg.uiComponents} />` so the user can edit and then generate.

### 3.6 Client: StudioProvider form state and actions

- **applyFormStateUpdates(updates)**: Updates studio state for thumbnailText, includeFaces, selectedStyle, selectedPalette, selectedAspectRatio, selectedResolution, variations, customInstructions, expression, pose, includeStyleReferences, styleReferences, etc. Keeps chat and manual form in sync.
- **openVideoAnalyticsWithResult(video, analytics)**: Opens the YouTube Video Analytics modal with pre-fetched data (no loading, no extra API call). Used when the chat completes a `youtube_analyze_video` tool call and the response includes `youtube_analytics`; the panel calls this so the modal shows immediately.
- **resetChat(clearForm?)**: Clears `chatAssistant.conversationHistory` and, if `clearForm` is true, resets all form fields to defaults. Used by chat panel Reset.

### 3.7 API Route: `app/api/assistant/chat/route.ts`

- **Auth**: `getOptionalAuth(supabase)`; returns 401 if no user.
- **Input**: `AssistantChatRequest`: `conversationHistory[]`, `formState` (all current form fields), optional `availableStyles`, `availablePalettes`, optional `attachedImages` (base64 + mimeType for the current message).
- **Modes**: `stream=true` → SSE response; otherwise JSON.
- **Tier and capabilities**: The route resolves the user’s tier via `getTierNameForUser(supabase, user.id)` (stable TierName, e.g. `'free'` | `'pro'`). It injects a **USER CAPABILITIES** block into the system prompt (e.g. “Tier: pro. YouTube integration: available.” or “Tier: free. YouTube integration: not available; suggest upgrade to Pro.”). This allows the agent to tailor responses and set `offer_upgrade` when the user asks for YouTube-related actions (connect/disconnect, channel, set thumbnail, update title, analytics, extract style) and their tier is not Pro.
- **Attached images → style references**: If the user attaches image(s) and asks to add them to style references (e.g. "add this to my style references"), the agent sets `add_attached_images_to_style_references: true` and surfaces `StyleReferencesSection`. The route then uploads each attached image to the `style-references` bucket, creates signed URLs, and merges them into `form_state_updates.styleReferences` (capped at 10 total). The client applies these via `applyFormStateUpdates`; no client change required.
- **System prompt**: Defines the assistant’s role (guide users through thumbnail creation), lists all allowed UI component names and when to use them, thumbnail generation requirements, current form state, available styles/palettes, expressions/poses from `lib/constants/face-options.ts`, rules for pre-fill, **USER CAPABILITIES** (tier and YouTube availability), **YOUTUBE**: when the user asks for YouTube features and tier is not Pro, respond with a helpful message and set `offer_upgrade: true` and `required_tier: "pro"`, and **FEEDBACK FOR REQUESTS WE CAN'T DO**: when the user asks for something the app cannot do, the agent first offers to submit feedback (using `generate_assistant_response`), then on user confirmation calls `create_feedback` so the route inserts into the feedback table and returns a synthetic success message.
- **Tools**: (1) `generate_assistant_response` — `human_readable_message`, `ui_components[]`, `form_state_updates`, `suggestions[]`, optional `offer_upgrade` (boolean), optional `required_tier` (string). When `offer_upgrade` is true, the client shows an “Upgrade to Pro” chip and can open the subscription modal. (2) `create_feedback` — `message`, `category` (bug, feature request, other, just a message), optional `email`, optional `user_addition`. The route executes the insert when Gemini returns `create_feedback` and returns the same response shape with a synthetic message. (3) **`youtube_analyze_video`** — parameter `video_id` (string, required; URL or raw ID). Only when user tier is Pro. Route resolves video ID (via `parseYouTubeVideoId`), calls the same logic as `/api/youtube/videos/analyze`, and returns a `complete` payload with **`youtube_analytics`**: `{ videoId, title?, thumbnailUrl?, analytics }`. Client calls **`openVideoAnalyticsWithResult(video, analytics)`** to open the existing Video Analytics modal with that data. (4) **`youtube_extract_style`** — parameter `video_ids` (string[], required, 2–10; URLs or IDs). Only when tier is Pro and `can_create_custom`. Route resolves IDs, builds thumbnail URLs (`maxresdefault.jpg`), runs shared extract-style-from-images logic, inserts the new style into `styles`, and returns **`form_state_updates.selectedStyle`** (new style id) and optional **`youtube_extract_style`**: `{ styleId, styleName }`. Client applies form state and optionally refetches styles so the new style appears in the list.
- **Two-step flow (optional grounding)**:
  1. **Search step**: Call Gemini with `googleSearch` tool (no function calling) to get search context and grounding metadata. If search fails, continue without it.
  2. **Function-calling step**: Call `callGeminiWithFunctionCalling` with all tool definitions and allowed names. Gemini returns one of them; if `create_feedback`, the route calls `submitFeedbackFromServer`; if `youtube_analyze_video` or `youtube_extract_style`, the route runs the tool (Pro only) and returns the appropriate payload; otherwise `generate_assistant_response` is handled as today.
- **Response**: `human_readable_message` (or synthetic message after feedback submit), `ui_components` (filtered or empty), `form_state_updates`, `suggestions`, optional `offer_upgrade`, optional `required_tier`, optional **`youtube_analytics`** (when `youtube_analyze_video` ran successfully), optional **`youtube_extract_style`** (when `youtube_extract_style` ran successfully; `{ styleId, styleName }`).
- **Streaming**: Emits SSE events (`status`, `tool_call`, `text_chunk`, `complete`, `error`); `complete` carries the same shape as the JSON response. Both streaming and non-streaming modes branch on `functionName` and execute the YouTube tools server-side for Pro users; non-Pro users receive a normal message with `offer_upgrade: true` instead of running the tool.

### 3.8 AI Core: `lib/services/ai-core.ts`

- **callGeminiWithFunctionCalling**: Sends one user turn (system + user prompt, optional image). Accepts an array of tool definitions and allowed function names; Gemini returns one function call; the API returns `{ functionName, functionCallResult, groundingMetadata? }`. The chat route branches on `functionName`: for `generate_assistant_response` it parses args into message, `ui_components`, `form_state_updates`, `suggestions`; for `create_feedback` it executes the feedback insert and returns a synthetic response.
- **Grounding**: Chat route performs grounding in a separate search call; citations are merged into the message in the route via `processGroundingCitations` (`lib/utils/citation-processor.ts`).

### 3.9 Allowed UI component names (contract)

These must match between API tool definition, API response filter, and `DynamicUIRenderer`:

- ThumbnailTextSection  
- IncludeFaceSection  
- StyleSelectionSection  
- ColorPaletteSection  
- StyleReferencesSection  
- AspectRatioSection  
- ResolutionSection  
- AspectRatioResolutionSection  
- VariationsSection  
- CustomInstructionsSection  
- GenerateThumbnailButton  
- RegisterNewFaceCard  
- RegisterNewStyleCard  
- RegisterNewPaletteCard  

---

## 4. Data Flow (Single User Message)

1. User types and sends in `StudioChatPanel`.
2. Panel appends user message to local `messages`, sets `thinkingState`, and `POST /api/assistant/chat?stream=true` with full `conversationHistory` and current `formState` (and styles/palettes).
3. Route builds system + user prompt; optionally runs search+grounding; then calls Gemini with `generate_assistant_response` tool.
4. Route streams: status → tool_call → text_chunk (simulated from full message) → complete { human_readable_message, ui_components, form_state_updates, suggestions }.
5. Panel on `complete`: applies `form_state_updates` (with style/palette name→id resolution) via `applyFormStateUpdates`, appends assistant message with `uiComponents`, `suggestions`, and `offerUpgrade` (from `offer_upgrade`), clears thinking.
6. UI re-renders: new assistant bubble, suggestion chips, optional “Upgrade to Pro” chip if `offerUpgrade`, and `DynamicUIRenderer` for the new `uiComponents`. User can edit in the surfaced sections, click Generate, or click “Upgrade to Pro” to open the subscription modal.

---

## 5. How to Expand the Implementation

### 5.1 Adding a new UI section (e.g. “WatermarkSection”)

1. **API contract**: Add `'WatermarkSection'` to the tool definition `parameters.ui_components.items.enum` in `app/api/assistant/chat/route.ts`, and to the response filter array.
2. **System prompt**: In the same route, add a bullet describing when to surface `WatermarkSection` and which `form_state_updates` to set (e.g. `watermarkEnabled`, `watermarkText`).
3. **Tool schema**: Add any new fields to `form_state_updates` in the tool definition (and document in system prompt).
4. **StudioProvider**: In `applyFormStateUpdates`, handle the new keys and update state (and ensure initial state exists).
5. **DynamicUIRenderer**: Add `WatermarkSection` to `UIComponentName` and `COMPONENT_MAP`, mapping to a component (e.g. `StudioGeneratorWatermark` in `studio-generator.tsx`).
6. **Studio generator**: Implement the section component (or reuse an existing one) so it reads/writes the same state that `applyFormStateUpdates` sets.

### 5.2 Adding a new suggestion type or message format

- **Suggestions**: Already an array of strings in the tool; extend the system prompt to ask for different or additional suggestion templates; no client change if still rendering `msg.suggestions` as chips.
- **Rich messages**: If the agent should return structured blocks (e.g. bullet list, image placeholder), extend the tool with an optional field (e.g. `message_blocks`) and render it in `ChatMessage` or a new component.

### 5.3 Changing the model or enabling search per request

- **Model**: Pass a different `model` argument to `callGeminiWithFunctionCalling` (and to the search call if used). Keep a single place (e.g. route or env) for the default model name.
- **Search**: The route already conditionally runs the search step; you can skip it for certain requests or add a request flag (e.g. `?grounding=false`) to avoid the extra call.

### 5.4 Multi-turn tools (e.g. “generate and then edit”)

- **Current**: The agent only returns UI component names and form updates; it does not trigger generation. Generation is always user-driven (button in the surfaced form).
- **Extension**: To let the agent “trigger” generation, you could:
  - Add a tool that the backend interprets as “run generation with current form state” and call your existing generate API from the route, then return a summary in the next assistant message; or
  - Keep generation out of the agent and add a dedicated “Agent: Generate now” suggestion that focuses the user on the Generate button. The current design avoids the agent calling write/charge operations directly.

### 5.5 Persistence and history

- **Current**: Chat history is stored in `localStorage` per device; no server-side history.
- **Extension**: Add an API to save/load conversation threads (e.g. by session or user), and optionally link a thread to a “project” or thumbnail set. `StudioChatPanel` would then load a thread by id and send a thread id with each request so the backend can append to the same thread.

### 5.6 Floating vs in-sidebar chat

- **Current**: Primary UX is in-sidebar `StudioChatPanel`; floating `StudioChatAssistant` uses older `sendChatMessage` and provider `chatAssistant` state.
- **Extension**: To unify, you could make the floating panel render the same `StudioChatPanel` (or a thin wrapper) and feed it from the same message source (e.g. context or a shared store) so both sidebar and floating views show the same conversation.

### 5.7 Rate limits and abuse

- **Current**: Auth required; no explicit rate limit on `POST /api/assistant/chat`.
- **Extension**: Add rate limiting (e.g. by user id or IP) in the route or in middleware, and optionally cap conversation length or token count per request to control cost.

### 5.8 Agent-initiated feedback (create_feedback)

- **Flow**: When the user asks for something the application cannot do (e.g. export to Figma, a feature that doesn't exist), the agent first responds with `generate_assistant_response`: it explains the limitation, offers to submit feedback for the team, summarizes what it would send (message + category), and asks if the user wants to add anything or to submit. When the user confirms (e.g. "submit", "yes", "send it") or provides additions, the agent calls `create_feedback` with the full message and category. The route then calls `submitFeedbackFromServer` (see `lib/server/feedback.ts`), inserts a row into the `feedback` table (with `page_url`, `app_version`, `user_agent` from the request, and optional user email from auth), and returns the same response shape with a synthetic `human_readable_message` (e.g. "I've submitted your feedback to the team") and empty `ui_components`. No client changes are required; the panel already renders the message and suggestions.
- **Contract**: `create_feedback` parameters are `message` (required), `category` (required: bug, feature request, other, just a message), `email` (optional), `user_addition` (optional; appended to message). The route fills `page_url`, `app_version`, and `user_agent` from the request.

### 5.9 YouTube intents and in-chat upgrade

- **YouTube capabilities**: The chat assistant understands YouTube-related intents (connect/disconnect, view channel or videos, set thumbnail, update title, video analytics, extract style from thumbnails). The server injects the user’s tier (via `getTierNameForUser`) and YouTube availability (Pro only) into the system prompt. If the user asks for YouTube features and their tier is not Pro, the agent responds with a helpful message and sets `offer_upgrade: true` and `required_tier: "pro"`.
- **In-chat upgrade**: When the API returns `offer_upgrade: true`, the client stores it on the assistant message as `offerUpgrade` and renders an “Upgrade to Pro” suggestion chip. Clicking the chip opens `SubscriptionModal` (same component used elsewhere; the chat panel holds local modal state and uses `useSubscription()` for `tier` and `productId`). `offerUpgrade` is persisted in chat history (save/load in `studio-chat.tsx`) so the chip survives reload.
- **Optional YouTube UI component**: If you add a “surface YouTube” component (e.g. `OpenYouTubeTabCard`) to the allowed `ui_components` and `DynamicUIRenderer`, it should call `setView('youtube')` from `useStudio()` to switch to the YouTube tab. If the user is not Pro, the component should open the subscription modal (e.g. via an `onUpgradeClick` callback from the parent or local modal state). YouTube write APIs (set-thumbnail, update-title, connect, disconnect, videos/analyze) enforce Pro tier server-side and return 403 with `code: 'TIER_REQUIRED'` when the user’s tier is not Pro.
- **Chat-triggered YouTube actions (Pro)**: When the user (Pro) asks in chat to analyze a video or create a style from videos, the agent calls `youtube_analyze_video` or `youtube_extract_style` with parsed video ID(s). The route enforces Pro (and for style, `can_create_custom`); if not allowed, it returns a normal message with `offer_upgrade: true`. For **analyze**: route calls the same analyze API, then includes `youtube_analytics` in the `complete` payload; the chat panel calls `openVideoAnalyticsWithResult(video, analytics)` so the Video Analytics modal opens with that result. For **extract style**: route builds thumbnail URLs from video IDs, runs shared extract-style-from-images logic (`lib/server/styles/extract-style-from-images.ts`), inserts the new style into `styles`, and returns `form_state_updates.selectedStyle` and `youtube_extract_style`; the client applies form state and optionally refetches styles. Video ID parsing uses `parseYouTubeVideoId` / `parseYouTubeVideoIds` (`lib/utils/youtube.ts`) for URLs or raw IDs.

---

## 6. File Reference

| Area | File | Purpose |
|------|------|--------|
| API | `app/api/assistant/chat/route.ts` | Chat endpoint, prompts, two-step search + function calling, create_feedback execution, SSE or JSON response |
| API | `app/api/feedback/route.ts` | Public POST-only feedback endpoint (uses shared server helper) |
| Server | `lib/server/feedback.ts` | `submitFeedbackFromServer`: shared validation and insert for feedback table |
| Server | `lib/server/utils/tier.ts` | `getTierForUser`, `getTierNameForUser`: resolve user tier for capability checks |
| AI | `lib/services/ai-core.ts` | `callGeminiWithFunctionCalling` (multi-tool), `FunctionCallingResult` |
| Citations | `lib/utils/citation-processor.ts` | Merge grounding metadata into message text |
| Face options | `lib/constants/face-options.ts` | Expression/pose enums for tool schema and prompts |
| Chat UI | `components/studio/studio-chat.tsx` | `StudioChatPanel`, `StudioChatAssistant`, `StudioChatToggle` |
| Message | `components/studio/chat-message.tsx` | User/assistant bubble, Markdown for assistant |
| Thinking | `components/studio/thinking-message.tsx` | Loading status, tool calls, streamed text |
| Dynamic UI | `components/studio/dynamic-ui-renderer.tsx` | Map `ui_components` to generator sections |
| Generator | `components/studio/studio-generator.tsx` | Manual/Chat tabs, form sections, `StudioGeneratorChat` |
| State | `components/studio/studio-provider.tsx` | Form state, `applyFormStateUpdates`, `openVideoAnalyticsWithResult`, `resetChat`, mode, `chatAssistant` |
| Server | `lib/server/styles/extract-style-from-images.ts` | Shared style extraction from image URLs (used by extract-from-youtube and chat `youtube_extract_style`) |
| Utils | `lib/utils/youtube.ts` | `parseYouTubeVideoId`, `parseYouTubeVideoIds` for URLs or raw IDs |
| Sidebar | `components/studio/studio-settings-sidebar.tsx` | Manual/Chat mode switch, open chat |

---

## 7. Summary

- **Chat** is an in-sidebar panel (and an optional floating panel) that sends conversation + current form state to `POST /api/assistant/chat`.
- The **agent** uses four Gemini function-call tools: `generate_assistant_response` (message, 1–2 UI component names, form state updates, suggestions, optional `offer_upgrade`/`required_tier`); `create_feedback` (message, category; used when the user confirms submission of feedback); **`youtube_analyze_video`** (video_id; Pro only—route runs analyze and returns `youtube_analytics`; client opens Video Analytics modal via `openVideoAnalyticsWithResult`); **`youtube_extract_style`** (video_ids 2–10; Pro + can_create_custom—route extracts style from thumbnails, creates style, returns `form_state_updates.selectedStyle` and `youtube_extract_style`; client applies form state and can refetch styles). The route injects **USER CAPABILITIES** (tier and YouTube availability) into the system prompt so the agent can offer an in-chat upgrade when the user asks for YouTube features and their tier is not Pro, or run the YouTube tools when they are Pro. Optional search/grounding runs in a separate Gemini call. When the agent calls `create_feedback`, the route inserts into the feedback table and returns a synthetic message; no client change.
- **Form state** is shared: updates from the agent are applied via `applyFormStateUpdates`, and the same generator sections are rendered by `DynamicUIRenderer` so the user can edit and generate without leaving chat.
- **In-chat upgrade**: When the response includes `offer_upgrade: true`, the panel shows an “Upgrade to Pro” chip and renders `SubscriptionModal` on click; `offerUpgrade` is persisted in chat history.
- **Extending** is done by updating the API tool and prompt, the allowed component list, `applyFormStateUpdates`, and `DynamicUIRenderer`/generator sections in sync.
