# ViewBAIT MCP setup

Endpoint: `https://www.viewbait.app/api/mcp`  
Auth: Supabase OAuth 2.1  
Framework: Next.js route handlers (`yourindie-mcp`)

> Use the **www** host. Apex `viewbait.app` 307-redirects to www, which breaks Cursor MCP OAuth discovery and leaves clients stuck on "Exchanging token…".

## Status

| Step | Status |
|------|--------|
| 1. Package + generated Next routes | Done |
| 2. Env vars documented (`.env.example`, `.env.mcp.example`) | Done — copy into Vercel / `.env.local` |
| 3. Consent UI at `/oauth/consent` + auth redirect allowlist | Done |
| 4. Ten project, asset, thumbnail, generation, edit, and comparison tools | Done |
| 5. MCP permission migrations through `20260726000000_mcp_oauth_tool_permissions.sql` | Apply in Supabase (below) |
| 6. Dashboard OAuth Server + Custom Access Token hook | Manual (below) |
| 7. Deploy + connect MCP client | After 5–6 |

## 1. Environment

Copy from `.env.mcp.example` into `.env.local` and Vercel:

```bash
MCP_RESOURCE_URL=https://www.viewbait.app/api/mcp
MCP_STRICT_AUDIENCE=true
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

For local smoke tests against a production-audience JWT, use `MCP_STRICT_AUDIENCE=false` temporarily. Production must keep strict audience on.

## 2. Enable Supabase OAuth (Dashboard)

1. **Authentication → OAuth Server** — enable OAuth 2.1.
2. Set **Authorization Path** to exactly `/oauth/consent` (leading slash, no domain).
3. **Authentication → URL Configuration → Site URL** must be the **app** origin, e.g. `https://viewbait.app` (or `https://www.viewbait.app` if that is canonical).  
   If Site URL is still `https://YOUR_PROJECT.supabase.co`, authorize redirects to Supabase itself and you get a **404** JSON: `{"error":"requested path is invalid"}`.
4. Add both `https://viewbait.app/**` and `https://www.viewbait.app/**` under Redirect URLs if you use both hosts.
5. Enable **dynamic client registration** if ChatGPT/Claude should self-register.
6. Migrate Auth JWT signing to an asymmetric key (ES256 or RS256).

## 3. Apply migration and hook

Apply migrations through `supabase/migrations/20260726000000_mcp_oauth_tool_permissions.sql` (SQL editor or `supabase db push`).

Then **Authentication → Hooks → Custom Access Token** → select `public.custom_access_token_hook`.

This binds OAuth tokens to audience `https://www.viewbait.app/api/mcp` and adds `mcp_permissions`.

After a client registers, grant permissions:

```sql
insert into public.mcp_oauth_clients (client_id, permissions)
values ('CLIENT_ID', array[
  'account:read',
  'projects:read',
  'projects:write',
  'assets:read',
  'thumbnails:read',
  'thumbnails:write',
  'thumbnails:compare',
  'generation:write'
])
on conflict (client_id) do update
  set permissions = excluded.permissions, updated_at = now();
```

## 4. Consent + login redirect

Consent lives at `/oauth/consent`. Unsigned users are sent to `/auth?redirect=/oauth/consent?...` (allowlisted). Do not use absolute `next=` URLs.

## 5. Tools

| Tool | Permission | Operation |
|------|------------|-----------|
| `get_account_context` | `account:read` | Account, plan, credits, and generation limits |
| `list_projects` | `projects:read` | Paginated owned and editor projects |
| `get_project_workspace` | `projects:read`, `thumbnails:read` | Project defaults, counts, and recent thumbnails |
| `create_project` | `projects:write` | Create a project with optional defaults |
| `update_project` | `projects:write` | Update owned project name or defaults |
| `list_generation_assets` | `assets:read` | Styles, palettes, and saved faces |
| `list_thumbnails` | `thumbnails:read` | Paginated owned thumbnails with filters |
| `generate_thumbnails` | `generation:write` | Generate 1–4 thumbnails using normal credits and tier limits |
| `edit_thumbnail` | `thumbnails:write` | Create an edited thumbnail version |
| `compare_thumbnails` | `thumbnails:read`, `thumbnails:compare` | Multimodal creative comparison of 2–4 thumbnails |

Access is enforced by tool `requiredPermissions` plus OAuth-aware RLS. Generation and editing reuse the production API handlers, including credit accounting, plan limits, storage handling, and failure cleanup.

## 6. Verify after deploy

- `https://www.viewbait.app/api/mcp` accepts MCP Streamable HTTP (401 + `WWW-Authenticate`, not a 307).
- `https://www.viewbait.app/.well-known/oauth-protected-resource/api/mcp` returns protected-resource metadata.
- Unauthenticated MCP request → `401` with `WWW-Authenticate`.
- The OAuth consent page shows the requesting client and allows approval or denial.
- A user can access only their own records through RLS.

### Stuck on "Exchanging token…" (Cursor / ChatGPT)

Consent **Allow** only issues an authorization code. The MCP client must then exchange it at Supabase’s token endpoint.

1. Connect using exactly `https://www.viewbait.app/api/mcp` (www required, no trailing slash). Apex redirects break OAuth.
2. After Allow, if the browser stays on ViewBait, click **Continue to …** (needed for `cursor://` callbacks some browsers block).
3. Codes expire in ~10 minutes — retry Connect if you waited.
4. In Supabase Auth logs, look for token endpoint `invalid_grant` / hook errors right after Allow.
5. Vercel env `MCP_RESOURCE_URL` and `custom_access_token_hook` `aud` must both be `https://www.viewbait.app/api/mcp`.

Connect MCP clients to: `https://www.viewbait.app/api/mcp`
