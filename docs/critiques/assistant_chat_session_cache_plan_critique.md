# Critique: Assistant Chat Session Cache Plan

Senior-engineer review of the strategy document **Assistant Chat Session Caching** (persist YouTube assistant chat in sessionStorage when switching tabs or navigating away and back), evaluated against the ViewBait codebase.

---

## High-level overview (plain language)

The strategy is **sound and well aligned** with the app. It correctly chooses **sessionStorage** for “as long as the user is on the app” (tab lifetime), reuses the existing **safe-storage** cap/trim pattern from the thumbnail chat, and extends that module with an optional **storage** parameter so the assistant can use sessionStorage without duplicating logic. Hydration is handled by loading in a mount-only `useEffect` instead of initializing state from storage, avoiding SSR mismatch. Persisting both **messages** and **draft** in a single `{ messages, draft }` object under one key keeps the design simple and within one size cap.

**Main strengths:** (1) Session scope matches the stated product goal. (2) Reusing safe-storage preserves quota handling and trim behavior. (3) Only two call sites use safe-storage today (both in studio-chat); adding an optional `options` parameter is backward compatible. (4) The plan explicitly calls out the “welcome then restore” flash and deems it acceptable.

**Risks and gaps:** (1) **Effect ordering:** The plan mentions ensuring load runs before save but leaves the exact mechanism a bit open (“simplest: run save on every change” with load in a separate effect with `[]` deps). In practice, both effects run after commit; the save effect will run on the first paint with default state and can overwrite a valid stored conversation before the load effect has run. The plan should prescribe a **hasHydrated** ref (or equivalent) so save is skipped until after the first load has been applied. (2) **Trim function contract:** The plan says trim should return a “strictly smaller” payload; when the stored shape is `{ messages, draft }`, the trim must operate on that object (e.g. drop oldest message and re-stringify), not on a raw array. The plan describes this but could be more explicit that the trim receives the *full* JSON string of `{ messages, draft }`. (3) **Validation of restored messages:** Malformed or adversarial stored data could inject `role`/`content` that break the UI or leak into rendered Markdown; the plan says “validate that messages is an array of objects with role and content” but should explicitly recommend sanitizing `content` (e.g. max length, or rely on ChatMessage’s safe rendering) and rejecting unknown `role` values. (4) **Key naming:** Two keys are suggested (`studio-assistant-chat` vs `youtube-assistant-chat`); the critique recommends picking one and sticking to it for consistency.

**Verdict:** Proceed with the plan. Before implementation: (a) add an explicit “skip save until after load” guard (e.g. hasHydrated ref), (b) tighten the trim contract and validation/sanitization for restored messages, and (c) fix the storage key to a single name.

---

## Summary table

| Area | Verdict | Notes |
|------|--------|--------|
| **Overall strategy** | ✔ | Session-scoped cache, reuse of safe-storage, minimal surface (2 files). |
| **Storage choice (sessionStorage)** | ✔ | Tab lifetime matches “cached as long as the user is on the app”; no cross-tab leakage. |
| **Extending safe-storage** | ✔ | Optional `storage` keeps existing callers (studio-chat) unchanged; single implementation for cap/trim. |
| **Stored shape `{ messages, draft }`** | ✔ | One key, one cap; draft prevents losing typed input when switching tabs. |
| **Hydration (useEffect load)** | ✔ | Avoids initializing state from storage so server and first client render match; brief flash is acceptable. |
| **Effect ordering (load vs save)** | ⚠ | Save effect runs on first paint with default state and can overwrite good data before load runs. Need explicit “skip save until after load” (e.g. hasHydrated ref). |
| **Trim function** | ⚠ | Plan should state clearly that trim receives the full `{ messages, draft }` JSON string and must return the same shape (smaller); document that dropping the first message and re-stringifying is the required behavior. |
| **Validation of restored data** | ⚠ | Recommend validating/sanitizing `content` (length, or rely on safe render) and allowing only `role: 'user' \| 'assistant'` to avoid bad data or XSS if Markdown is rendered. |
| **Storage key** | 💡 | Plan offers two names; pick one (e.g. `studio-assistant-chat`) and use it consistently. |
| **toolResults size** | ✔ | Trimming by dropping oldest messages is sufficient; no need to shrink individual toolResults in this phase. |
| **Out of scope** | ✔ | localStorage, clear on logout, and server sync correctly left for later. |

---

## Detailed critique

### ✔ Strengths

- **Reuse:** [lib/utils/safe-storage.ts](viewbait/lib/utils/safe-storage.ts) already provides `getItemSafe` and `setItemWithCap` with maxBytes and trim; [studio-chat.tsx](viewbait/components/studio/studio-chat.tsx) uses them for thumbnail chat history. Extending with optional `storage` keeps one place for quota and trim logic.
- **Backward compatibility:** Only studio-chat uses safe-storage today. Adding an optional second parameter (e.g. `options?: { storage?: Storage }`) leaves existing calls unchanged.
- **Session scope:** sessionStorage clears when the tab closes, which matches “as long as the user is on the app” and avoids leaving long-lived PII in localStorage.
- **Hydration:** Loading in a mount-only useEffect and not from `useState(initial)` avoids server/client mismatch; the plan correctly accepts the brief “welcome then restore” flash.
- **Single payload:** Storing `{ messages, draft }` under one key with one cap and one trim function keeps the implementation simple.

### ⚠ Effect ordering: save can overwrite before load

The plan says: “run save on every change and have load run first (useEffect order: load in one effect, save in another … load runs once with [] deps so it runs first).” In React, **both effects run after the same commit**. The save effect has deps `[messages, inputValue]`. On first paint, that effect runs with the *initial* state (`[WELCOME]`, `''`). So the first save can write that default payload to sessionStorage **before** the load effect has run and replaced state with stored data. That would overwrite a valid previous conversation.

**Recommendation:** Introduce a ref, e.g. `hasHydratedRef.current`, set to `true` only after the load effect has run (and applied stored data if any). In the save effect, skip calling `saveToStorage` until `hasHydratedRef.current` is true. Alternatively, run the load effect with empty deps and the save effect only when a “hydrated” flag (from state) is true, set by the load effect after it runs.

### ⚠ Trim function contract and shape

The plan says the trim function “Given a payload string, parse as JSON; if it’s an object with a `messages` array and length > 1, remove the first element of `messages`, re-stringify, and return.” It should be explicit that:

- The **input** to trim is the full JSON string of `{ messages: AssistantMessage[], draft?: string }`.
- The **output** must be the same shape (object with `messages` and optionally `draft`); after removing the first message, `JSON.stringify` the updated object. If trimming repeatedly and `messages` becomes empty, the plan suggests “return a minimal payload (e.g. `{ messages: [welcome], draft: '' }`)” so the trim always returns a smaller string. That is correct; document it so implementers don’t return a string that’s not valid for the next trim iteration.

### ⚠ Validation and sanitization of restored messages

Restored data can be malformed or adversarial (e.g. from a modified client or dev tools). The plan says “validate that messages is an array of objects with role and content (and optional toolResults).” To reduce risk:

- **Role:** Only allow `role === 'user'` or `role === 'assistant'`; discard or coerce any other value.
- **Content:** If [ChatMessage](viewbait/components/studio/chat-message.tsx) renders assistant content as Markdown, ensure stored `content` is not treated as trusted HTML (sanitize or rely on a safe Markdown renderer). A simple guard is a max length per message (e.g. 100k chars) to avoid huge payloads and potential DoS.
- **toolResults:** Ensure each element has the expected shape (`tool: string`, `result: unknown`) and optionally cap array length or nested size so one corrupted entry doesn’t break the UI.

### 💡 Key naming and constants

The plan suggests either `studio-assistant-chat` or `youtube-assistant-chat`. Prefer **one** key (e.g. `studio-assistant-chat`) to match the component name and the fact that the assistant lives in the studio. Document it as a named constant (e.g. `ASSISTANT_CHAT_STORAGE_KEY`) next to `MAX_ASSISTANT_MESSAGES` and `MAX_ASSISTANT_PAYLOAD_BYTES` so it’s easy to change later if needed.

### 💡 Optional: debounce save on draft

Saving on every `inputValue` change can write to sessionStorage very frequently while the user types. Consider debouncing the save when only the draft changed (e.g. 300–500 ms), while still saving immediately when `messages` changes. This is an optimization, not required for correctness.

---

## References

- Plan: Assistant Chat Session Caching (e.g. `assistant_chat_session_cache_f6ae3820.plan.md`).
- [viewbait/lib/utils/safe-storage.ts](viewbait/lib/utils/safe-storage.ts) – current API, no `storage` option.
- [viewbait/components/studio/studio-assistant-panel.tsx](viewbait/components/studio/studio-assistant-panel.tsx) – current state (messages, inputValue), no persistence.
- [viewbait/components/studio/studio-chat.tsx](viewbait/components/studio/studio-chat.tsx) – existing load/save pattern with getItemSafe, setItemWithCap, MAX_CHAT_MESSAGES, trim.
