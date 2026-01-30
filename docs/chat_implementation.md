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
│  │  actions: applyFormStateUpdates, resetChat, setMode, generate...)    │   │
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
│  • Two tools: generate_assistant_response (message, ui_components,           │
│    form_state_updates, suggestions); create_feedback (message, category)     │
│    — route executes create_feedback insert and returns synthetic message      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Current Implementation

### 3.1 Entry Points & UI Placement

- **Generator left sidebar**: `StudioGenerator` switches on `mode` (`"manual"` | `"chat"`). In chat mode it renders `StudioGeneratorChat`, which wraps `StudioChatPanel`.
- **Mode switch**: `StudioGeneratorTabs` (Manual / Chat) and the right sidebar collapsed view both call `setMode("manual")` or `setMode("chat")`. Chat mode can be opened via `openChatAssistant()` from the right sidebar.
- **Legacy**: `StudioChatAssistant` (floating panel) and `StudioChatToggle` use `chatAssistant` state and `sendChatMessage`; the main in-sidebar experience is `StudioChatPanel`.

### 3.2 Client: StudioChatPanel (`components/studio/studio-chat.tsx`)

- **State**: `messages` (user/assistant with optional `uiComponents`, `suggestions`), `inputValue`, `isLoading`, `error`, `thinkingState` (status, toolCalls, streamedText).
- **Persistence**: Messages saved to `localStorage` under `thumbnail-assistant-chat-history`; loaded on mount; reset clears storage and optionally form via `resetChat(true)`.
- **Form state for API**: Built from `useStudio()` state (thumbnailText, includeFaces, selectedFaces, faceExpression, facePose, styleReferences, selectedStyle, selectedPalette, aspect ratio, resolution, variations, customInstructions). Also sends `availableStyles` and `availablePalettes` from `useStyles()` / `usePalettes()`.
- **Request**: `POST /api/assistant/chat?stream=true` with `{ conversationHistory, formState, availableStyles, availablePalettes }`.
- **Stream handling**: Parses SSE events:
  - `status` → update thinking message (e.g. "Analyzing conversation...", "Searching for context...", "Generating response...").
  - `tool_call` → update tool call list (calling/complete).
  - `text_chunk` → append to streamed text in thinking UI.
  - `complete` → build assistant message with `human_readable_message`, `ui_components`, `suggestions`; apply `form_state_updates` (with style/palette name→id resolution) via `applyFormStateUpdates`; append message and clear thinking.
  - `error` → show error and optional fallback message.
- **UI**: Message list (user/assistant), suggestion chips, `DynamicUIRenderer` for each assistant message’s `uiComponents`, `ThinkingMessage` while loading, input + send, Reset button.

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
- **resetChat(clearForm?)**: Clears `chatAssistant.conversationHistory` and, if `clearForm` is true, resets all form fields to defaults. Used by chat panel Reset.

### 3.7 API Route: `app/api/assistant/chat/route.ts`

- **Auth**: `getOptionalAuth(supabase)`; returns 401 if no user.
- **Input**: `AssistantChatRequest`: `conversationHistory[]`, `formState` (all current form fields), optional `availableStyles`, `availablePalettes`, optional `attachedImages` (base64 + mimeType for the current message).
- **Modes**: `stream=true` → SSE response; otherwise JSON.
- **Attached images → style references**: If the user attaches image(s) and asks to add them to style references (e.g. "add this to my style references"), the agent sets `add_attached_images_to_style_references: true` and surfaces `StyleReferencesSection`. The route then uploads each attached image to the `style-references` bucket, creates signed URLs, and merges them into `form_state_updates.styleReferences` (capped at 10 total). The client applies these via `applyFormStateUpdates`; no client change required.
- **System prompt**: Defines the assistant’s role (guide users through thumbnail creation), lists all allowed UI component names and when to use them, thumbnail generation requirements, current form state, available styles/palettes, expressions/poses from `lib/constants/face-options.ts`, rules for pre-fill, and **FEEDBACK FOR REQUESTS WE CAN'T DO**: when the user asks for something the app cannot do, the agent first offers to submit feedback (using `generate_assistant_response`), then on user confirmation calls `create_feedback` so the route inserts into the feedback table and returns a synthetic success message.
- **Two tools**: (1) `generate_assistant_response` — `human_readable_message`, `ui_components[]`, `form_state_updates`, `suggestions[]`. (2) `create_feedback` — `message`, `category` (bug, feature request, other, just a message), optional `email`, optional `user_addition`. The route executes the insert when Gemini returns `create_feedback` and returns the same response shape with a synthetic message; no client changes required.
- **Two-step flow (optional grounding)**:
  1. **Search step**: Call Gemini with `googleSearch` tool (no function calling) to get search context and grounding metadata. If search fails, continue without it.
  2. **Function-calling step**: Call `callGeminiWithFunctionCalling` with both tool definitions and allowed names. Gemini returns one of the two; if `create_feedback`, the route calls `submitFeedbackFromServer` (`lib/server/feedback.ts`), then returns a synthetic `complete`/JSON with empty `ui_components` and success/error message.
- **Response**: `human_readable_message` (or synthetic message after feedback submit), `ui_components` (filtered or empty), `form_state_updates`, `suggestions`.
- **Streaming**: Emits SSE events (`status`, `tool_call`, `text_chunk`, `complete`, `error`); `complete` carries the same shape as the JSON response.

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
5. Panel on `complete`: applies `form_state_updates` (with style/palette name→id resolution) via `applyFormStateUpdates`, appends assistant message with `uiComponents` and `suggestions`, clears thinking.
6. UI re-renders: new assistant bubble, suggestion chips, and `DynamicUIRenderer` for the new `uiComponents`. User can edit in the surfaced sections and click Generate (or say something else).

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

---

## 6. File Reference

| Area | File | Purpose |
|------|------|--------|
| API | `app/api/assistant/chat/route.ts` | Chat endpoint, prompts, two-step search + function calling, create_feedback execution, SSE or JSON response |
| API | `app/api/feedback/route.ts` | Public POST-only feedback endpoint (uses shared server helper) |
| Server | `lib/server/feedback.ts` | `submitFeedbackFromServer`: shared validation and insert for feedback table |
| AI | `lib/services/ai-core.ts` | `callGeminiWithFunctionCalling` (multi-tool), `FunctionCallingResult` |
| Citations | `lib/utils/citation-processor.ts` | Merge grounding metadata into message text |
| Face options | `lib/constants/face-options.ts` | Expression/pose enums for tool schema and prompts |
| Chat UI | `components/studio/studio-chat.tsx` | `StudioChatPanel`, `StudioChatAssistant`, `StudioChatToggle` |
| Message | `components/studio/chat-message.tsx` | User/assistant bubble, Markdown for assistant |
| Thinking | `components/studio/thinking-message.tsx` | Loading status, tool calls, streamed text |
| Dynamic UI | `components/studio/dynamic-ui-renderer.tsx` | Map `ui_components` to generator sections |
| Generator | `components/studio/studio-generator.tsx` | Manual/Chat tabs, form sections, `StudioGeneratorChat` |
| State | `components/studio/studio-provider.tsx` | Form state, `applyFormStateUpdates`, `resetChat`, mode, `chatAssistant` |
| Sidebar | `components/studio/studio-settings-sidebar.tsx` | Manual/Chat mode switch, open chat |

---

## 7. Summary

- **Chat** is an in-sidebar panel (and an optional floating panel) that sends conversation + current form state to `POST /api/assistant/chat`.
- The **agent** uses two Gemini function-call tools: `generate_assistant_response` (message, 1–2 UI component names, form state updates, suggestions) and `create_feedback` (message, category; used when the user confirms submission of feedback for requests the app cannot fulfill). Optional search/grounding runs in a separate Gemini call. When the agent calls `create_feedback`, the route inserts into the feedback table and returns a synthetic message; no client change.
- **Form state** is shared: updates from the agent are applied via `applyFormStateUpdates`, and the same generator sections are rendered by `DynamicUIRenderer` so the user can edit and generate without leaving chat.
- **Extending** is done by updating the API tool and prompt, the allowed component list, `applyFormStateUpdates`, and `DynamicUIRenderer`/generator sections in sync.
