# API Rate Limiting

Sensitive and expensive API routes are rate-limited per user (or per IP for unauthenticated routes) to reduce abuse, cost overrun, and denial of service.

## Source of truth

**Which routes are limited and at what limits:** see `RATE_LIMIT_CONFIG` in `lib/server/utils/rate-limit.ts`. That config is the single source of truth; this doc summarizes it and documents behavior.

| Route ID            | Limit (per minute) | Typical use                    |
|---------------------|--------------------|--------------------------------|
| `generate`          | 20                 | Thumbnail generation (AI)     |
| `assistant-chat`    | 30                 | AI assistant chat             |
| `agent-chat`        | 30                 | YouTube agent chat             |
| `account-export`    | 5                  | GDPR data export               |
| `account-delete`    | 5                  | Account deletion               |
| `join-editor-slug`  | 10                 | Join project by editor slug    |

Routes call `enforceRateLimit(routeId, request, userId)` once after auth; when the limit is exceeded they return HTTP 429 with code `RATE_LIMIT_EXCEEDED`.

## Implementation details

- **Store:** In-memory, per process. Limits are **per instance**; in a multi-instance or serverless deployment, each instance has its own counters.
- **Window:** 1 minute rolling.
- **Key:** For authenticated routes, key is `{routeId}:{userId}`. For unauthenticated (e.g. future login), key uses request IP (`x-forwarded-for` or `x-real-ip`) so the same abstraction applies.

## Multi-instance and scaling

For cross-instance rate limiting (e.g. to enforce a global per-user limit across replicas), the implementation would need a shared store (e.g. Redis or Upstash). Until then, the limitation is accepted and documented; adding a shared store would require changes only in `lib/server/utils/rate-limit.ts`, not in individual routes.

## Adding a new rate-limited route

1. Add an entry to `RATE_LIMIT_CONFIG` in `lib/server/utils/rate-limit.ts` with `limitPerWindow` and `message`.
2. In the route handler, after resolving the user (or null for unauthenticated), call:
   `const res = enforceRateLimit('your-route-id', request, user?.id ?? null); if (res) return res`
