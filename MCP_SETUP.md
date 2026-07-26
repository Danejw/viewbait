# ViewBAIT MCP setup

Endpoint: `https://viewbait.app/api/mcp`  
Auth: Supabase OAuth 2.1  
Framework: Next.js route handlers (`yourindie-mcp`)

## Status

| Step | Status |
|------|--------|
| 1. Package + generated Next routes | Done |
| 2. Env vars documented (`.env.example`, `.env.mcp.example`) | Done — copy into Vercel / `.env.local` |
| 3. Consent UI at `/oauth/consent` + auth redirect allowlist | Done |
| 4. Tools: `list_projects`, `list_thumbnails` (RLS-scoped) | Done |
| 5. Migration `20260725000000_mcp_oauth_permissions.sql` | Apply in Supabase (below) |
| 6. Dashboard OAuth Server + Custom Access Token hook | Manual (below) |
| 7. Deploy + connect MCP client | After 5–6 |

## 1. Environment

Copy from `.env.mcp.example` into `.env.local` and Vercel:

```bash
MCP_RESOURCE_URL=https://viewbait.app/api/mcp
MCP_STRICT_AUDIENCE=true
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

For local smoke tests against a production-audience JWT, use `MCP_STRICT_AUDIENCE=false` temporarily. Production must keep strict audience on.

## 2. Enable Supabase OAuth (Dashboard)

1. **Authentication → OAuth Server** — enable OAuth 2.1.
2. Set **Authorization Path** to `/oauth/consent`.
3. **Authentication → URL Configuration → Site URL** = `https://viewbait.app`.
4. Enable **dynamic client registration** if ChatGPT/Claude should self-register.
5. Migrate Auth JWT signing to an asymmetric key (ES256 or RS256).

## 3. Apply migration and hook

Apply `supabase/migrations/20260725000000_mcp_oauth_permissions.sql` (SQL editor or `supabase db push`).

Then **Authentication → Hooks → Custom Access Token** → select `public.custom_access_token_hook`.

This binds OAuth tokens to audience `https://viewbait.app/api/mcp` and adds `mcp_permissions`.

After a client registers, grant permissions:

```sql
insert into public.mcp_oauth_clients (client_id, permissions)
values ('CLIENT_ID', array['projects:read', 'thumbnails:read'])
on conflict (client_id) do update
  set permissions = excluded.permissions, updated_at = now();
```

## 4. Consent + login redirect

Consent lives at `/oauth/consent`. Unsigned users are sent to `/auth?redirect=/oauth/consent?...` (allowlisted). Do not use absolute `next=` URLs.

## 5. Tools

| Tool | Permission | Table |
|------|------------|--------|
| `list_projects` | `projects:read` | `projects` |
| `list_thumbnails` | `thumbnails:read` | `thumbnails` |

Access is enforced by tool `requiredPermissions` plus RLS (`mcp_has_permission` when `client_id` is present).

## 6. Verify after deploy

- `https://viewbait.app/api/mcp` accepts MCP Streamable HTTP.
- `https://viewbait.app/.well-known/oauth-protected-resource/api/mcp` returns protected-resource metadata.
- Unauthenticated MCP request → `401` with `WWW-Authenticate`.
- Consent page shows client name; Allow / Deny work.
- MCP client only sees the signed-in user’s rows (RLS).

Connect MCP clients to: `https://viewbait.app/api/mcp`
