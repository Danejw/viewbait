# Google Sign-In & Sign-Up Audit

This document describes how the ViewBait application signs users in (and up) with Google via Supabase Auth, what permissions are requested, and how the redirect flow works.

---

## 1. Overview

- **Provider**: Supabase Auth with **Google** as the OAuth provider.
- **Entry point**: Single entry point — the auth page **"Continue with Google"** button (`/auth`).
- **Sign-in vs sign-up**: Supabase treats the same Google OAuth flow as sign-in or sign-up depending on whether the Google account already has a linked user; there is no separate UI or code path for "Sign up with Google" vs "Sign in with Google".
- **Post-auth use of Google**: The same Google OAuth tokens obtained at login are used to populate the **YouTube integration** (read channel/analytics, and write for thumbnails/title). We use **only** the Supabase-driven flow; there is no app-owned redirect URL. Connect and Reconnect in the Studio also use this same flow (they call `signInWithGoogle(redirectTo)`).

---

## 2. Code Path Summary

| Layer | File(s) | Responsibility |
|--------|---------|----------------|
| UI | `app/auth/page.tsx` | Renders "Continue with Google" button; calls `signInWithGoogle(redirectTo)`. |
| Hook | `lib/hooks/useAuth.tsx` | Exposes `signInWithGoogle(redirectTo)`; delegates to auth service. |
| Service | `lib/services/auth.ts` | Builds callback URL, calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, scopes, queryParams } })`. |
| Callback | `app/auth/callback/route.ts` | GET handler: exchanges `code` for session, persists YouTube tokens when provider is Google, redirects to allowed `next`. |
| Redirect safety | `lib/utils/redirect-allowlist.ts` | Restricts post-login redirect to allowlisted paths (e.g. `/`, `/studio`, `/onboarding`, `/e/<slug>`). |
| Middleware | `middleware.ts` | Protects routes; sends unauthenticated users to `/auth` with `redirect` param; for auth routes with session, redirects to destination (e.g. `/studio`). |

---

## 3. Permissions (Scopes) Requested at Login

Google Sign-In is initiated with **Supabase** `signInWithOAuth` and the following **custom scopes** (in addition to whatever Supabase/Google add for basic sign-in, e.g. OpenID profile/email):

Defined in `lib/services/auth.ts` as `YOUTUBE_SCOPES`:

| Scope | Purpose |
|--------|--------|
| `https://www.googleapis.com/auth/youtube.readonly` | Read YouTube channel and content. |
| `https://www.googleapis.com/auth/yt-analytics.readonly` | Read YouTube Analytics. |
| `https://www.googleapis.com/auth/youtube.force-ssl` | Manage YouTube account (e.g. upload thumbnails, update title). |

These are requested **at the same time** as the user clicks "Continue with Google", so the consent screen can show both sign-in and YouTube-related permissions in one step.

Additional OAuth options in the same call:

- `access_type: 'offline'` — so a refresh token is returned when possible.
- `prompt: 'consent'` — forces the consent screen so we can obtain refresh token and scopes reliably.

So in practice we are asking for:

1. **Identity**: Sign-in and basic profile (handled by Supabase/Google).
2. **YouTube read**: Channel and analytics.
3. **YouTube write**: Thumbnails and metadata (e.g. title) via `youtube.force-ssl`.

---

## 4. Redirect Flow (Step-by-Step)

1. **User on `/auth`**  
   - Optional query: `?redirect=/studio` (or other allowlisted path).  
   - `redirectTo` is set via `getAllowedRedirect(searchParams.get("redirect"), "/studio")`.

2. **User clicks "Continue with Google"**  
   - `handleGoogleSignIn()` calls `signInWithGoogle(redirectTo)`.

3. **Auth service** (`lib/services/auth.ts`)  
   - Builds callback URL: `{origin}/auth/callback` with optional `?next={redirectTo}` (e.g. `?next=/studio`).  
   - Calls:
     - `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl.toString(), scopes: YOUTUBE_SCOPES, queryParams: { access_type: 'offline', prompt: 'consent' } } })`.  
   - Supabase returns a redirect URL; the client typically performs a **full browser redirect** to Google.

4. **User on Google**  
   - Signs in (if needed) and sees the consent screen for the requested scopes.  
   - Approves or denies.

5. **Google redirects to Supabase**  
   - Supabase completes the OAuth flow and then redirects the **browser** to the app’s **Site URL / Redirect URL** with a `code` (and possibly state).  
   - That URL is the one we passed as `redirectTo`: i.e. `{origin}/auth/callback?next=...`. So the browser lands on something like:
     - `https://<app>/auth/callback?code=...&next=/studio`  
   - (Exact query param names may vary; our callback reads `code` and `next` or `redirect`.)

6. **App callback** (`app/auth/callback/route.ts`)  
   - **GET** handler:
     - Reads `code` and `next` (or `redirect`) from the URL.  
     - Validates redirect: `next = getAllowedRedirect(rawNext, '/studio')`.  
     - Calls `supabase.auth.exchangeCodeForSession(code)`.  
     - On success:
       - Reads `provider_token`, `provider_refresh_token`, and user from the session.  
       - If the provider is Google and `provider_token` is present:
         - Extracts Google user id and (if available) scopes from `user.identities` / `user.app_metadata.providers_scopes.google`.  
         - Calls `persistYouTubeTokens(...)` to upsert into `youtube_integrations` (access token, refresh token, `google_user_id`, scopes, etc.) using the **service role** client.  
       - Responds with **redirect** to `next` (e.g. `NextResponse.redirect(new URL(next, request.url))` → `/studio`).

7. **User lands on destination**  
   - Typically `/studio` (or another allowlisted path).  
   - Middleware sees a valid session and allows access; no extra redirect unless onboarding or other logic applies.

**Important**: We do **not** use an app-owned redirect URI with Google. The only redirect in play is **Supabase's** (e.g. `https://<project>.supabase.co/auth/v1/callback`). Configure:

- **Supabase Dashboard**: Authentication → URL Configuration → Redirect URLs must include `https://<your-domain>/auth/callback` (and for local dev `http://localhost:3000/auth/callback`) so Supabase knows where to send the user after OAuth.
- **Google Cloud Console**: The OAuth client used by the Supabase Google provider must have **only** Supabase's callback URL in "Authorized redirect URIs" (do not add any /api/youtube/connect/callback or other app URL).

---

## 5. Where Google Sign-In Is Used

- **Auth page**: `app/auth/page.tsx` — "Continue with Google" button; calls `signInWithGoogle(redirectTo)`.
- **Studio YouTube tab**: "Connect with Google" and "Reconnect" use the same flow. `lib/hooks/useYouTubeIntegration.ts` exposes `reconnect()`, which calls `signInWithGoogle('/studio?view=youtube')` so the user goes through Supabase Google OAuth and returns to the YouTube view; the auth callback persists tokens as for login.
- **useAuth**: `lib/hooks/useAuth.tsx` exposes `signInWithGoogle(redirectTo?)`; used by the auth page and by `useYouTubeIntegration.reconnect()`.

---

## 6. Post-Login: How We Use the Google Tokens

- **Session**: Supabase session is created and stored (cookies) via `exchangeCodeForSession`; the session is used for all authenticated app and API access.
- **YouTube integration**: Right after a successful Google sign-in (or when the user clicks "Connect with Google" or "Reconnect" in the Studio), the callback persists the provider access/refresh tokens and `google_user_id` into `youtube_integrations` via `persistYouTubeTokens`. The same Supabase Google OAuth flow is used for login and for Connect/Reconnect; there is no separate OAuth flow or app-owned redirect URI. Token refresh uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` server-side (no redirect); the same OAuth client should be configured in Supabase Dashboard as the Google provider so that the tokens we receive are for that client.

---

## 7. Security and Redirect Safety

- **Open redirect**: Prevented by `getAllowedRedirect()` in the auth callback and anywhere else we use `redirect`/`next` (allowlisted pathnames only; no arbitrary absolute URLs).
- **Callback**: Runs on the server; exchanges the one-time `code` for a session; does not expose tokens to the client beyond what Supabase puts in the session/cookies.
- **Token storage**: YouTube tokens are stored in `youtube_integrations` via the **service role** client so RLS does not block the upsert; only backend code and RLS policies should allow access to this table.

---

## 8. Environment / Configuration

- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and server-side `SUPABASE_SERVICE_ROLE_KEY` for `persistYouTubeTokens`).
- **Google**: The Google provider is configured in the **Supabase Dashboard** (Authentication → Providers → Google) with **our** `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (same client used for initial grant and server-side token refresh). In Google Cloud Console, that client's "Authorized redirect URIs" must contain **only** Supabase's callback URL (e.g. `https://<project>.supabase.co/auth/v1/callback`). Add the three YouTube scopes to the OAuth consent screen. `NEXT_PUBLIC_APP_URL` is not required for the OAuth redirect (optional for other uses).

---

## 9. Summary Table

| Item | Detail |
|------|--------|
| **Entry points** | `/auth` → "Continue with Google"; Studio YouTube tab → "Connect with Google" / "Reconnect" (same flow). |
| **Auth provider** | Supabase Auth with Google only; no app-owned redirect URL. |
| **Scopes** | `youtube.readonly`, `yt-analytics.readonly`, `youtube.force-ssl` (+ sign-in/profile). |
| **OAuth options** | `access_type: 'offline'`, `prompt: 'consent'`. |
| **Callback URL** | `{origin}/auth/callback`; optional `?next=...` for post-login redirect. |
| **Redirect after login** | Allowlisted path only (e.g. `/studio`, `/studio?view=youtube`); default `/studio`. |
| **Token reuse** | Google provider tokens are stored in `youtube_integrations`; same flow for login and Connect/Reconnect. |
| **GCP redirect URI** | Only Supabase's callback URL; do not add any app URL (e.g. `/api/youtube/connect/callback`). |

This audit reflects the codebase as of the audit date; any change to Supabase or Google provider config (e.g. redirect URLs or scopes) should be reflected in Supabase Dashboard and Google Cloud Console and, if needed, in this doc.
