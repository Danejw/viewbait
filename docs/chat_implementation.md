# Chat Implementation — Thumbnail Creation Assistant

This document describes how the in-app chat interface is implemented to guide users through creating thumbnails. Use it to replicate or migrate this behavior into another version of the application.

---

## Table of Contents

1. [Overview](#overview)
2. [What the Chat Can Do](#what-the-chat-can-do)
3. [Architecture and Data Flow](#architecture-and-data-flow)
4. [Component Map](#component-map)
5. [API Contract](#api-contract)
6. [Streaming (SSE) Behavior](#streaming-sse-behavior)
7. [State and Persistence](#state-and-persistence)
8. [Integration Points](#integration-points)
9. [Migration Checklist](#migration-checklist)

---

## Overview

The chat is an **assistant mode** alongside a **manual mode** on the thumbnail generator. Users can switch between:

- **Manual**: Traditional form (title, style, palette, aspect ratio, etc.) plus a generate button.
- **Chat**: Conversational UI where the user types messages and the AI responds with:
  - A natural-language message
  - Optional **suggestions** (clickable short phrases that fill the input)
  - Optional **inline UI components** (the same form sections as manual mode, rendered under the message)
  - Optional **form state updates** (title, style, palette, aspect ratio, resolution, variations, face, expression, pose, custom instructions) applied automatically so chat and manual stay in sync.

The backend uses **Google Gemini** (e.g. `gemini-2.5-flash`) with **function calling** to get structured output: message, list of UI component names, and optional form updates. Optional **Google Search** grounding is used (separate call) to add context; citations can be injected into the message via `processGroundingCitations`.

---

## What the Chat Can Do

| Capability | Description |
|------------|-------------|
| **Conversation** | User sends messages; assistant replies with a human-readable message (Markdown supported for assistant messages). |
| **Context awareness** | API receives full conversation history + current form state (title, style, palette, aspect ratio, resolution, variations, face, expression, pose, style refs, custom instructions). |
| **Dynamic UI** | Assistant returns a list of UI component names; the client renders the corresponding form sections (or buttons) inline under that message. |
| **Form state updates** | Assistant can return `form_state_updates`; client applies them (set title, style, palette, aspect ratio, resolution, variations, includeFace, expression, pose, customInstructions). Style/palette can be set by ID or by name (resolved against `effectiveStyles` / `effectivePalettes`). |
| **Suggestions** | Assistant can return 2–3 short suggestion strings; rendered as buttons that set the input value and focus the input. |
| **Streaming (optional)** | Client can request `?stream=true` and receive Server-Sent Events: status, tool_call, text_chunk, complete, error. |
| **Thinking state** | While waiting, client shows a “thinking” card with status, tool call progress, and (when streaming) streamed text preview. |
| **Persistence** | Chat history (and welcome message) is stored in `localStorage` under `thumbnail-assistant-chat-history` and restored on load. |
| **Reset** | “Reset chat” clears history and re-initializes with the welcome message only. |

---

## Architecture and Data Flow

### High-level flow

```
User types message
    → AssistantChatInterface adds user message to state
    → POST /api/assistant/chat (with conversationHistory + formState + availableStyles + availablePalettes)
    → API: optional Google Search call (grounding)
    → API: callGeminiWithFunctionCalling(systemPrompt, userPrompt, …, assistantToolDefinition, 'generate_assistant_response', …)
    → API: parse function call → human_readable_message, ui_components, form_state_updates, suggestions
    → (Streaming) SSE: status → tool_call → text_chunk (simulated) → complete
    → Client: append assistant message; apply form_state_updates; render suggestions + DynamicUIRenderer(ui_components)
```

### File roles

| File | Role |
|------|------|
| `app/components/AssistantChatInterface.tsx` | Chat UI: message list, input, send; builds request; handles SSE; applies form_state_updates; persists to localStorage; exposes `resetChat` via ref. |
| `app/components/ChatMessage.tsx` | Renders a single message: user (plain text + link parsing) or assistant (Markdown via react-markdown, code blocks via react-syntax-highlighter). Props: `role`, `content`, `timestamp`. |
| `app/components/ThinkingMessage.tsx` | “Thinking” state: status line, expandable tool calls + streamed text preview. Props: `thinkingState`, `isExpanded`, `onToggleExpanded`. |
| `app/components/DynamicUIRenderer.tsx` | Maps UI component names to React components; receives full form state + setters + data (faces, styles, palettes, etc.) and renders the list of components for one message. |
| `app/api/assistant/chat/route.ts` | POST handler: auth, validate body, build system prompt, optional search call, function-calling call, optional citation processing, return JSON or SSE stream. |
| `lib/services/ai-core.ts` | `callGeminiWithFunctionCalling(systemPrompt, userPrompt, imageData, toolDefinition, toolName, model, enableGoogleSearch)`. |
| `lib/utils/citation-processor.ts` | `processGroundingCitations(groundingMetadata, message)` — inserts citation links into message text. |
| `lib/constants/face-options.ts` | `getExpressionValues()`, `getPoseValues()`, `formatExpressionsForPrompt()`, `formatPosesForPrompt()` used in API tool definition and system prompt. |
| `lib/hooks/useGeneratorMode.ts` | Holds `mode: 'manual' | 'chat'`, `chatInterfaceRef`, `resetChat` (calls ref + optional callback). |
| `app/components/GeneratorModeSwitcher.tsx` | UI to switch Manual/Chat and (in chat mode) reset chat; collapses/expands sidebar. |
| `app/components/GeneratorLayout.tsx` | Layout: left = ModeSwitcher + (Manual form or AssistantChatInterface), right = preview/gallery; passes all props into AssistantChatInterface. |
| `app/components/GeneratorTab.tsx` | Tab that owns generator state and modals; renders GeneratorLayout with that state. |

---

## Component Map

### Where chat is shown

- **GeneratorTab** renders **GeneratorLayout**.
- **GeneratorLayout** renders **GeneratorModeSwitcher** with two children:
  - **Manual**: GeneratorForm + GeneratorSettings + GeneratorControls.
  - **Chat**: **AssistantChatInterface** (with ref from `useGeneratorMode`).
- **GeneratorModeSwitcher** shows Manual/Chat buttons and, in chat mode, a “Reset” that calls `mode.resetChat(settings.reset)`.

### AssistantChatInterface

- **State**: `messages`, `inputValue`, `isLoading`, `error`, `thinkingState`, `isThinkingExpanded`.
- **Refs**: `messagesEndRef` (scroll-into-view), `chatContainerRef`, `inputRef`, `isInitializedRef`.
- **Effects**: Load from localStorage on mount (or set welcome message); save to localStorage when messages change; scroll to bottom when messages change.
- **Imperative**: `resetChat()` via `useImperativeHandle`: clear messages, set welcome message, clear input/error, persist to localStorage.
- **Send**: On submit, append user message, POST `/api/assistant/chat?stream=true` with `conversationHistory`, `formState`, `availableStyles`, `availablePalettes`. Parse SSE or JSON; apply `form_state_updates`; append assistant message with `human_readable_message`, `ui_components`, `suggestions`.
- **Rendering**: For each message, render `ChatMessage`; for assistant messages, render suggestion buttons and then `DynamicUIRenderer` with that message’s `uiComponents`. While loading, render `ThinkingMessage`. At bottom, input + send button.

### DynamicUIRenderer

- **Input**: `components: UIComponentName[]` plus all form state, setters, data (effectiveFaces, effectiveStyles, effectivePalettes, favorites, capability flags), modal openers, `onGenerate`, `isGenerating`, expanded state, and optional “Register” props (face/style/palette registration).
- **Logic**: A single `componentMap` maps each `UIComponentName` to a React node (section or button). RegisterNew* cards are rendered only if the required props are present; otherwise they render `null` (and optional client warning).
- **Output**: Renders the list of components in order in a simple wrapper (e.g. `space-y-1`).

Allowed **UIComponentName** values:

- `IncludeFaceSection`, `StyleSelectionSection`, `ColorPaletteSection`, `StyleReferencesSection`
- `AspectRatioResolutionSection`, `VariationsSection`, `CustomInstructionsSection`
- `GenerateThumbnailButton`
- `RegisterNewFaceCard`, `RegisterNewStyleCard`, `RegisterNewPaletteCard`

---

## API Contract

### Request

- **Method**: POST  
- **URL**: `/api/assistant/chat` or `/api/assistant/chat?stream=true`  
- **Auth**: Required (e.g. `getOptionalAuth`; 401 if no user).  
- **Body** (JSON):

```ts
{
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
  formState: {
    thumbnailText: string,
    includeFace: boolean,
    selectedFaces: string[],
    expression: string | null,
    pose: string | null,
    styleReferences: string[],
    selectedStyle: string | null,
    selectedColor: string | null,
    selectedAspectRatio: string,
    selectedResolution: string,
    variations: number,
    customInstructions: string,
  },
  availableStyles?: Array<{ id: string; name: string }>,
  availablePalettes?: Array<{ id: string; name: string }>,
}
```

### Response (non-streaming)

- **200**: JSON

```ts
{
  human_readable_message: string,
  ui_components: UIComponentName[],
  form_state_updates?: {
    thumbnailText?: string,
    selectedStyle?: string | null,
    selectedColor?: string | null,
    selectedAspectRatio?: string,
    selectedResolution?: string,
    variations?: number,
    includeFace?: boolean,
    expression?: string | null,
    pose?: string | null,
    customInstructions?: string,
  },
  suggestions?: string[],
}
```

- **400**: validation error; **401**: unauthorized; **500**: server error with `error` and `code`.

### Response (streaming)

- **200**: `Content-Type: text/event-stream`. Events (each `event: <type>\ndata: <JSON>\n\n`):

| Event     | Data | Meaning |
|----------|------|--------|
| `status` | `{ type?, message }` | Progress (e.g. “Analyzing conversation…”, “Searching for context…”, “Generating response…”). |
| `tool_call` | `{ function, status: 'calling' \| 'complete' }` | Function call progress. |
| `text_chunk` | `{ chunk: string }` | Simulated streaming: message split into small chunks. |
| `complete` | Full response object (same shape as non-streaming 200 body) | Final payload. |
| `error`   | `{ error, code }` | Fatal error. |

Client should accumulate status/tool_call/text_chunk for the thinking UI, then on `complete` apply `form_state_updates`, append the assistant message with `human_readable_message`, `ui_components`, `suggestions`, and clear thinking state.

---

## Streaming (SSE) Behavior

1. Client sends `POST /api/assistant/chat?stream=true`.
2. Server opens a ReadableStream and:
   - Emits `status` (e.g. analyzing, searching, function_calling, streaming).
   - Optionally runs a Gemini call with Google Search; then runs `callGeminiWithFunctionCalling` with search context and **no** search.
   - Emits `tool_call` calling → complete.
   - Optionally processes citations on `human_readable_message`.
   - Simulates streaming by emitting `text_chunk` for small slices of the final message (e.g. 5 chars, 20 ms apart).
   - Emits `complete` with the full response object.
3. Client:
   - Sets `thinkingState` from status and tool_call; appends streamed text to `thinkingState.streamedText` from text_chunk.
   - On `complete`, sets `thinkingState = null`, builds assistant message from `human_readable_message`, `ui_components`, `suggestions`, applies `form_state_updates`, appends to messages.

---

## State and Persistence

- **Conversation**: Kept in React state in `AssistantChatInterface`; persisted to `localStorage` key `thumbnail-assistant-chat-history`. Stored shape: array of `{ role, content, timestamp: ISO string, uiComponents?, suggestions? }`. On load, timestamps are parsed back to `Date`.
- **Welcome message**: If no history, a single assistant message is set and saved (e.g. “Hi! I’m here to help you create amazing thumbnails…”).
- **Form state**: Lives in the parent (GeneratorTab / GeneratorLayout); not stored by the chat. Chat only sends current form state to the API and applies returned `form_state_updates` via the provided setters. So “sync” between manual and chat is same state in parent.

---

## Integration Points

### Parent must provide (to GeneratorLayout → AssistantChatInterface)

- All form fields and setters: thumbnailText, includeFace, selectedFaces, expression, pose, styleReferences, selectedStyle, selectedColor, selectedAspectRatio, selectedResolution, variations, customInstructions.
- Data: effectiveFaces, effectiveStyles, effectivePalettes, faceFavoriteIds, styleFavoriteIds, paletteFavoriteIds.
- Capabilities: canCreateCustomAssets(), canUseResolution(), getMaxVariations().
- Modal openers: onOpenAddFaceModal, onOpenAddStyleModal, onOpenAddPaletteModal, onOpenExpressionModal, onOpenPoseModal, onOpenSubscriptionModal.
- Generation: onGenerate, isGenerating.
- Expanded state for sections: styleRefsExpanded, styleExpanded, colorExpanded and setters.
- Optional “Register” state and handlers for face/style/palette (for RegisterNew* cards in DynamicUIRenderer).

### Mode and reset

- `useGeneratorMode()` provides: `mode`, `setMode`, `chatInterfaceRef`, `resetChat`, `isControlsExpanded`, `setIsControlsExpanded`.
- `resetChat(onResetSettings?)` calls `chatInterfaceRef.current?.resetChat()` then `onResetSettings?.()`. Typically `onResetSettings` is `settings.reset` to reset generator form state when starting a new chat.

### Auth and env

- API uses `getOptionalAuth(supabase)`; unauthenticated requests get 401.
- API uses `GEMINI_API_KEY` for Gemini and (if used) Google Search.

---

## Migration Checklist

To port this chat implementation to another app:

1. **API**
   - Add POST route (e.g. `/api/assistant/chat`) with auth, body validation, system prompt, and optional streaming.
   - Implement or reuse `callGeminiWithFunctionCalling` and the same tool definition (human_readable_message, ui_components, form_state_updates, suggestions).
   - Optionally: separate Google Search call + citation processing; then function call with that context.
   - Return same JSON shape or same SSE event set (status, tool_call, text_chunk, complete, error).

2. **Types**
   - Mirror `AssistantChatRequest`, `AssistantChatResponse`, and `UIComponentName` (and form_state_updates shape). Keep enums in sync with DynamicUIRenderer and API filter list.

3. **AssistantChatInterface**
   - Same state and refs; same localStorage key and serialization; same send flow (build conversationHistory + formState, call API with stream=true), same SSE parsing and form_state_update application; same suggestion/UI rendering per message.
   - Ensure all props the current implementation expects (form state, data, modals, generation, expanded state, optional Register props) are passed from the new parent.

4. **ChatMessage**
   - Same props: role, content, timestamp. User: plain text + link parsing; assistant: Markdown (and optional code highlighting). Can reuse or reimplement with same UX.

5. **ThinkingMessage**
   - Same props: thinkingState (status, toolCalls, streamedText), isExpanded, onToggleExpanded. Reuse or replicate for streaming UX.

6. **DynamicUIRenderer**
   - Same list of UIComponentName and same componentMap. In the new app, either reuse the same section components or map names to the new app’s equivalents; keep the same prop surface (form state, setters, data, modals, onGenerate, isGenerating, expanded, Register props) so the chat can drive the same (or analogous) form.

7. **Generator mode**
   - Provide a way to switch Manual vs Chat (e.g. GeneratorModeSwitcher) and to reset chat (and optionally form). Wire `useGeneratorMode` (or equivalent) so chat ref and reset are available.

8. **Layout**
   - In the new app, render AssistantChatInterface in place of the manual form when mode is “chat”, with the same props and ref. Ensure GeneratorLayout (or equivalent) receives all state/handlers from the tab/page that owns form state and modals.

9. **Constants**
   - If you use expression/pose in form_state_updates, bring over `face-options` (or equivalent) and use the same enums in the API tool definition and prompt.

10. **Testing**
    - Test: send message → receive message + components + optional form updates; apply updates and confirm manual form reflects them; suggestions fill input; reset clears history and welcome message; streaming shows thinking then final message; 401 when unauthenticated.

This document and the referenced files (AssistantChatInterface, ChatMessage, ThinkingMessage, DynamicUIRenderer, assistant chat route, useGeneratorMode, GeneratorModeSwitcher, GeneratorLayout) are the single source of truth for “how the chat works” for migration.
