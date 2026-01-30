# Browser storage

This app uses **localStorage** for client-side persistence. To avoid quota/NO_SPACE errors (e.g. Chrome’s `FILE_ERROR_NO_SPACE` on `.ldb`), we cap what we store and handle storage failures without crashing.

## What is stored

- **Chat history** (`thumbnail-assistant-chat-history`): Studio assistant messages (role, content, timestamp, uiComponents, suggestions). Capped to the last 50 messages and 2 MB serialized size; older messages are evicted when over cap or on quota error.
- **Form/settings**: `thumbnail-generator-form-settings`, `thumbnail-generator-manual-settings`, and persisted generator state (via `useLocalStorage`). Small payloads; no explicit cap beyond normal usage.
- **UI prefs**: `studio-active-project-id`, floating nav position. Single small values.

## Caps and eviction

- **Chat**: `MAX_CHAT_MESSAGES = 50`, `MAX_CHAT_PAYLOAD_BYTES = 2 * 1024 * 1024` (2 MB). Save uses `setItemWithCap` from `lib/utils/safe-storage.ts`; when over max bytes or on quota error, the payload is trimmed (oldest messages dropped) and the write is retried once or skipped. The app never throws on storage full.
- **Watermarked image cache**: In-memory only (not persisted). Capped to 50 entries (FIFO); evicted object URLs are revoked.

## Quota/NO_SPACE handling

- **Safe storage** (`lib/utils/safe-storage.ts`): `getItemSafe` and `setItemWithCap` catch all storage errors and never throw. On write failure, `setItemWithCap` can retry once with a trimmed payload.
- **useLocalStorage**: All `localStorage` read/write/remove paths are wrapped in try/catch; errors are logged as warnings and the app continues.

Large assets (images, audio) are not cached in browser storage; they live on the backend (e.g. Supabase) and the app keeps only lightweight references locally.
