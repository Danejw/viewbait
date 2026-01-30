# Prompt Exposure Audit

**Date:** Thursday, January 29, 2025

This audit used `docs/system_understanding.md` to understand the architecture. The codebase was scanned for places where LLM prompts, system messages, tool instructions, or proprietary logic could be exposed to clients (API responses, streaming, errors, logs, analytics) and for correct server-side construction of AI requests and protection of environment keys.

---

## Overview

The application keeps AI prompts and keys server-side: **GEMINI_API_KEY** is only read in server code (`lib/services/ai-core.ts` and API routes), and all Gemini requests are built in API route handlers or ai-core (no NEXT_PUBLIC_ AI keys). Prompts for thumbnail generation, style analysis, title enhancement, style preview, and assistant chat are built only in route handlers or ai-core; the client sends minimal inputs (title, form state, conversation history, style prompt for preview) and receives structured or sanitized responses. Error handling uses **sanitizeErrorForClient** and **sanitizeApiErrorResponse** so prompts and raw API responses are not sent to the client. Public views (e.g. public styles) omit the `prompt` field. Remaining risks are **server-side**: debug **console.log** in the assistant chat route (which can log function-call results to stdout), and the **logger** not explicitly redacting a `prompt` key when logging arbitrary context. Recommended improvements: remove or gate debug logging in production, add explicit redaction of prompt-like keys in the logger, and centralize prompt templates in a server-only folder (e.g. `lib/server/prompts/`) so all prompt text lives in one place and is never imported by client code.

---

## 1. Where prompts are found

### 1.1 Server-only (must remain server-only)

| Location | Content | Exposure risk |
|----------|---------|----------------|
| **viewbait/app/api/generate/route.ts** | Thumbnail generation prompt: `promptData` (task, title, style_requirements, characters, technical_specs, reference_images), `imageMarkers`, final `prompt` string. Built from user input (title, style, palette, emotion, pose, etc.) and sent to `callGeminiImageGeneration`. | ✅ Not returned to client; response is `imageUrl`, `thumbnailId`, `creditsUsed`, etc. |
| **viewbait/app/api/edit/route.ts** | Edit prompt built from user’s edit instruction and image context; sent to ai-core. | ✅ Not returned; response is image/thumbnail only. |
| **viewbait/app/api/assistant/chat/route.ts** | `systemPrompt` (full assistant instructions, UI component list, form state summary, instructions), `userPrompt` (conversation + form state), `assistantToolDefinition` (tool schema). Sent to Gemini (with optional search then function-calling). | ✅ System prompt and tool definition never sent to client. Client receives only `human_readable_message`, `ui_components`, `form_state_updates`, `suggestions`. |
| **viewbait/app/api/analyze-style/route.ts** | Inline prompt for style extraction (instructions + “Write a detailed generation prompt (100-200 words)…”); tool definition `extract_style_info`. | ✅ Response is only extracted `{ name, description, prompt }` (the AI-generated style description for the user to save). Template not exposed. |
| **viewbait/app/api/analyze-palette/route.ts** | Inline prompt for palette analysis. | ✅ Response is extracted palette info only. |
| **viewbait/app/api/enhance-title/route.ts** | Long `systemPrompt` (YouTube title optimizer rules) and `userPrompt` (user’s title). | ✅ Response is only the 3 enhanced titles (text lines). |
| **viewbait/app/api/generate-style-preview/route.ts** | `userPrompt` template wrapping `body.prompt` (user’s style prompt). | ✅ Request uses user’s style text; response is preview image URL. Template not sent to client. |
| **viewbait/lib/services/ai-core.ts** | No prompt text; receives prompt strings from callers. Uses **process.env.GEMINI_API_KEY** only. | ✅ Server-only module; not imported by client. |

### 1.2 Client-sent inputs (minimal and intentional)

| API | Client sends | Server uses it as |
|-----|--------------|-------------------|
| **POST /api/generate** | title, emotion, pose, style, palette, resolution, aspectRatio, referenceImages, faceCharacters/faceImages, customStyle, thumbnailText, variations | User input only; full generation prompt is built server-side. |
| **POST /api/edit** | thumbnailId, editPrompt (user’s instruction) | User’s edit instruction; edit prompt template is server-side. |
| **POST /api/assistant/chat** | conversationHistory, formState, availableStyles, availablePalettes | Conversation and form state; system prompt and tool definition are server-side. |
| **POST /api/analyze-style** | image URLs (reference images) | Image refs only; analysis prompt is server-side. |
| **POST /api/generate-style-preview** | prompt (user’s style prompt), referenceImageUrl? | User’s style text; server wraps it in a template. |
| **POST /api/enhance-title** | title, style?, emotion? | User input; system prompt is server-side. |

✅ **Good:** Frontend never sends or contains full system prompts; it only sends minimal user inputs and structured state.

### 1.3 Environment keys

| Variable | Where used | In browser? |
|----------|------------|-------------|
| **GEMINI_API_KEY** | `lib/services/ai-core.ts`, `app/api/assistant/chat/route.ts`, `app/api/enhance-title/route.ts`, `app/api/analyze-style/route.ts`, `app/api/analyze-palette/route.ts`, `app/api/generate-style-preview/route.ts`, `app/api/generate/route.ts`, `app/api/edit/route.ts` | ❌ No. Only process.env in server/API code. |
| **NEXT_PUBLIC_*** | Supabase URL/anon key, etc. | Used in client; no AI keys are NEXT_PUBLIC_. ✅ |

✅ **Good:** AI provider requests are built server-side and environment keys are never exposed in the browser.

---

## 2. API responses, streaming, and errors

### 2.1 API responses

- **Generate:** Returns `imageUrl`, `thumbnailId`, `creditsUsed`, (batch) `results`. No prompt or template. ✅  
- **Edit:** Returns image/thumbnail data. No prompt. ✅  
- **Assistant chat (JSON):** Returns `human_readable_message`, `ui_components`, `form_state_updates`, `suggestions`. No system prompt or tool definition. ✅  
- **Analyze-style:** Returns `{ name, description, prompt }` where `prompt` is the **AI-extracted style description** (user-facing, for saving as their style). Not the server’s analysis prompt template. ✅  
- **Enhance-title:** Returns enhanced titles (3 lines). No system prompt. ✅  
- **Generate-style-preview:** Returns preview image URL. No template. ✅  

### 2.2 Streaming (assistant chat)

- **SSE events:** `status`, `tool_call`, `text_chunk` (chunks of `human_readable_message`), then final event with full structured response (`human_readable_message`, `ui_components`, `form_state_updates`, `suggestions`).  
- No raw model output, no system prompt, no tool definition in the stream. ✅  

### 2.3 Error handling and redaction

- **viewbait/lib/utils/error-sanitizer.ts:**  
  - **sanitizeErrorForClient:** Returns generic messages; maps known safe strings (e.g. api key, unauthorized, credits, rate limit) to fixed messages; otherwise returns `defaultMessage`. Prevents prompt/API response leakage. ✅  
  - **sanitizeApiErrorResponse:** Redacts long instruction-like text, long alphanumeric strings (keys), base64 image data. Used before logging and before rethrowing Gemini errors. ✅  
- **viewbait/lib/server/utils/error-handler.ts:** Uses sanitizeErrorForClient for serverErrorResponse, aiServiceErrorResponse, etc. ✅  

✅ **Good:** Clients only see generic or safe error messages; prompts and raw API responses are not sent to the client.

---

## 3. Logs and analytics

### 3.1 Server logger (viewbait/lib/server/utils/logger.ts)

- **redactPII:** Redacts email, long strings (API keys), JWT, base64 image, password-like patterns. Does **not** explicitly redact a key named `prompt`, `systemPrompt`, or `userPrompt`. If context passed to logError/logInfo contains `{ prompt: "..." }`, that value is only redacted if it matches PII patterns (e.g. long key-like string).  
⚠️ **Caution:** Long prompt text might appear in server logs if someone logs an object with a `prompt` key.

### 3.2 Assistant chat route (viewbait/app/api/assistant/chat/route.ts)

- **console.log:** Lines ~513–515 log `functionCallResult` and `form_state_updates` to stdout.  
⚠️ **Caution:** In production, stdout may be collected by a logging/monitoring system; this can include user-facing message and form state. Not prompt exposure, but unnecessary PII/behavioral data in logs. Prefer removing or gating behind development, or using the logger with redaction.

### 3.3 Client logger (viewbait/lib/utils/client-logger.ts)

- **extractSafeErrorInfo:** Truncates message length, redacts email and long tokens.  
- API errors that reach the client have already been sanitized by the server (sanitizeErrorForClient), so client logs should not contain raw prompts. ✅  

### 3.4 Analytics / crash reports

- No evidence of prompt or full request/response being sent to analytics or crash reporting. ✅  

---

## 4. Public and shared data

### 4.1 Public styles / thumbnails

- **viewbait/lib/types/database.ts:**  
  - **mapPublicStyleToStyle:** Sets `prompt: ''` with comment “Not available in public view for security.” ✅  
  - **PublicThumbnailData** and mapping omit full prompt; public thumbnail view uses minimal fields. ✅  

### 4.2 User’s own styles

- GET /api/styles (user’s styles) can return rows that include a `prompt` field (user-created style prompt). This is intentional: the user is viewing their own style. ✅  

---

## 5. Where redaction is necessary

| Place | What to redact | Current state |
|-------|----------------|---------------|
| **API error response body** | Prompt text, API keys, raw Gemini response body | ✅ Handled by sanitizeErrorForClient and sanitizeApiErrorResponse. |
| **Server log context** | Keys named `prompt`, `systemPrompt`, `userPrompt`, or long instruction-like values | ⚠️ redactPII does not explicitly treat `prompt`; recommend adding. |
| **Assistant chat stdout** | Full function-call result and form_state_updates | ⚠️ console.log in route; recommend remove or gate. |
| **Client error messages** | Any server leak (prompts, keys) | ✅ Server sanitizes before sending; client logger truncates/redacts. |

---

## 6. Recommended folder structure for prompt templates

Centralizing prompt text in a **server-only** area keeps a single source of truth and makes it obvious that prompts never belong in client code.

**Option A – Dedicated prompts directory**

```
viewbait/lib/server/prompts/
  index.ts          # Re-exports; no prompt strings in client-importable path
  thumbnail-gen.ts  # Thumbnail generation prompt building (or constants)
  assistant.ts      # Assistant system prompt + tool definition
  enhance-title.ts  # Title enhancement system prompt
  analyze-style.ts  # Style analysis prompt + tool definition
  analyze-palette.ts
  style-preview.ts  # Style preview wrapper template
  edit.ts           # Edit prompt template
```

- **Rule:** Only `app/api/*` and `lib/server/*` (and other server-only modules) may import from `lib/server/prompts/`.  
- **Build:** Ensure `lib/server/prompts/` is not imported by any client bundle (e.g. no `import ... from '@/lib/server/prompts'` in components or client-only hooks).

**Option B – Co-locate in API routes**

- Keep prompts inline in each route file but add a single **comment header** in each route: “PROMPTS IN THIS FILE ARE SERVER-ONLY. Do not return them to the client or log them raw.”  
- Optionally extract long strings into constants at the top of the same file.

**Recommendation:** Prefer **Option A** for long or reusable prompts (assistant, enhance-title, thumbnail-gen) so they can be versioned and reviewed in one place; keep very short templates (e.g. one-line wrappers) in the route if preferred.

---

## 7. Summary table

| Area | Status | Note |
|------|--------|------|
| GEMINI_API_KEY in client | ✅ | Only server; no NEXT_PUBLIC_ AI keys. |
| Prompts built server-side | ✅ | All in API routes or ai-core. |
| Client sends minimal input | ✅ | No system prompts from frontend. |
| API responses free of prompts | ✅ | Structured/sanitized only. |
| Streaming free of prompts | ✅ | SSE has message/components/state only. |
| Error responses sanitized | ✅ | sanitizeErrorForClient + sanitizeApiErrorResponse. |
| Public views omit prompt | ✅ | mapPublicStyleToStyle sets prompt ''. |
| Logger redacts prompt key | ⚠️ | Recommend explicit redaction of prompt/systemPrompt/userPrompt. |
| Assistant route console.log | ⚠️ | Recommend remove or gate in production. |
| Prompt template location | ⚠️ | Scattered in routes; recommend lib/server/prompts/. |

---

## 8. Actionable prompts for an AI coding agent

---

### 8.1 Remove or gate debug console.log in assistant chat route

**The Problem:** The assistant chat API route logs the full function-call result and form_state_updates with console.log. In production, stdout may be ingested by log aggregation; this can expose user messages and form state unnecessarily.

**The Current State:** In viewbait/app/api/assistant/chat/route.ts (around lines 513–515), after building the response object, there are:

- `console.log('[API] Function call result:', JSON.stringify(functionCallResult, null, 2));`
- `console.log('[API] form_state_updates from AI:', functionCallResult.form_state_updates);`
- `console.log('[API] customInstructions in form_state_updates:', functionCallResult.form_state_updates?.customInstructions);`

**The Goal State:** No console.log of function call result or form_state_updates in production. Either remove these three lines or guard them with `process.env.NODE_ENV === 'development'` so they run only in development.

**Unit Test (or validation):**  
- In production build (NODE_ENV=production), invoke POST /api/assistant/chat with a valid body and confirm stdout (or test double of console.log) does not contain the function call result or form_state_updates.  
- In development, optional: ensure debug logs still appear when NODE_ENV is development.

**Implementation Prompt:**

```
In viewbait/app/api/assistant/chat/route.ts, remove or gate the three console.log calls that log '[API] Function call result:', '[API] form_state_updates from AI:', and '[API] customInstructions in form_state_updates:'. Prefer removing them entirely; if debug logging is required for development, wrap them in a condition so they run only when process.env.NODE_ENV === 'development'. Do not log full function call results or form_state_updates in production. Preserve all existing API behavior and response shape.
```

---

### 8.2 Add explicit redaction of prompt-like keys in server logger

**The Problem:** The server logger’s redactPII does not explicitly redact object keys named `prompt`, `systemPrompt`, or `userPrompt`. If code passes such context to logError or logInfo, long prompt text could appear in server logs.

**The Current State:** In viewbait/lib/server/utils/logger.ts, redactPII handles strings, arrays, and objects; for object keys it redacts email, password, token, user_id, api_key, etc., but does not check for prompt-related key names. Other keys’ values are redacted recursively via redactPII(value) but are not forced to a placeholder when the key indicates prompt content.

**The Goal State:** When redactPII processes an object, any key that (case-insensitively) matches `prompt`, `systemPrompt`, `userPrompt`, or `system_instruction` has its value replaced with a fixed placeholder (e.g. `[REDACTED:PROMPT]`) before logging, regardless of value content.

**Unit Test:**  
- Call the logger (or redactPII) with context that includes `{ prompt: 'A long instruction that would otherwise be logged...' }`. Assert the formatted log entry does not contain the original prompt text and contains the placeholder.  
- Assert that other keys (e.g. route, operation) are unchanged.

**Implementation Prompt:**

```
In viewbait/lib/server/utils/logger.ts, extend the redactPII function so that when it processes an object, any property whose key (lowercased) is one of 'prompt', 'systemprompt', 'userprompt', or 'system_instruction' has its value replaced with the string '[REDACTED:PROMPT]' instead of recursing into the value. Apply this check in the same loop where you currently handle email, password, token, user_id, and api_key. Ensure existing behavior for other keys and for non-object values is unchanged. Add a unit test that verifies an object containing a 'prompt' key is redacted to the placeholder and does not appear in the log output.
```

---

### 8.3 Centralize prompt templates in lib/server/prompts

**The Problem:** Prompt text and tool definitions are spread across multiple API route files. Centralizing them in a server-only folder (e.g. lib/server/prompts/) reduces the chance of accidental client import and makes prompt review and updates easier.

**The Current State:** Prompts and tool definitions live inside viewbait/app/api/* (generate, edit, assistant/chat, analyze-style, analyze-palette, enhance-title, generate-style-preview). ai-core has no prompt strings, only receives them as arguments.

**The Goal State:** Create viewbait/lib/server/prompts/ with modules that export prompt-building functions or constants (e.g. getAssistantSystemPrompt(formState, options), getEnhanceTitleSystemPrompt(), getThumbnailPromptData(...), assistantToolDefinition). API routes import from these modules and pass the result to ai-core or use in request bodies. No file under lib/server/prompts/ is imported by any client-only code (no import from components, app/*.tsx pages, or client-only hooks).

**Unit Test:**  
- Assert that no file in viewbait/components, viewbait/app (except API route handlers), or viewbait/lib/hooks imports from viewbait/lib/server/prompts or viewbait/lib/server (except via server-only entry points).  
- Optionally: add a small unit test that builds one prompt (e.g. enhance-title system prompt) and checks it is non-empty and contains expected substring.

**Implementation Prompt:**

```
Create a server-only prompt layer under viewbait/lib/server/prompts/. Add modules that export: (1) assistant system prompt builder and assistantToolDefinition (from app/api/assistant/chat/route.ts), (2) enhance-title system prompt (from app/api/enhance-title/route.ts), (3) thumbnail generation prompt builder or promptData builder (from app/api/generate/route.ts), and (4) any other long prompt or tool definition from app/api (analyze-style, analyze-palette, generate-style-preview, edit). Move the prompt text and tool definitions into these modules; keep API routes as thin orchestrators that call these builders and pass results to ai-core or fetch. Ensure no client-importable file (components, app pages, lib/hooks) imports from lib/server/prompts or from lib/server except where already allowed (e.g. server utils). Add a README or comment in lib/server/prompts that states prompts in this folder are server-only and must not be returned to the client or imported by client code. Do not change the external behavior of any API or the content of the prompts beyond moving them.
```

---

*End of audit.*
