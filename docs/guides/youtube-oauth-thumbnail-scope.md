# YouTube Thumbnail Upload: Fixing 403 SCOPE_REQUIRED

If setting a video thumbnail from the app returns **403** with `code: "SCOPE_REQUIRED"`, the Google token does not include the thumbnail-upload scope.

**Reconnect** now uses a **dedicated YouTube OAuth flow** (`/api/youtube/connect/authorize` → Google → `/api/youtube/connect/callback`). We exchange the code with Google ourselves and store the tokens, so the token has the scopes you requested. You must use the **same** Google OAuth 2.0 Client ID (and secret) as in your app env (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`) and add the redirect URI and scope below.

## 1. Add the redirect URI for YouTube Connect (required for Reconnect)

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select the project that has the OAuth 2.0 Client ID used by your app (the one in `GOOGLE_CLIENT_ID`).
2. Go to **APIs & Services** → **Credentials** → open your **OAuth 2.0 Client ID** (Web application).
3. Under **Authorized redirect URIs**, add **every** URI your app can use as the callback origin:
   - `http://localhost:3000/api/youtube/connect/callback` (development, when you open the app as `http://localhost:3000`)
   - `http://127.0.0.1:3000/api/youtube/connect/callback` (development, when you open the app as `http://127.0.0.1:3000` — must match exactly or Google returns `redirect_uri_mismatch` and the new token is never saved)
   - `https://<your-production-domain>/api/youtube/connect/callback` (production — use your real app origin, e.g. `https://app.example.com/api/youtube/connect/callback`)
4. Save.

**Production:** Use the exact production origin (no trailing slash). Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in your production environment (same OAuth client as in GCP). Reconnect uses a relative URL, so it will hit your production domain when users are on the live site.

## 2. Add the scope in Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select the project that owns the **OAuth 2.0 Client ID** used by your app (the same client ID configured in Supabase for Google sign-in).
2. Go to **APIs & Services** → **OAuth consent screen**.
3. Click **Edit app** (or create the app if needed).
4. Open the **Scopes** step → **Add or remove scopes**.
5. Find **YouTube Data API v3** and add:
   - **Manage your YouTube account**  
   - Scope value: `https://www.googleapis.com/auth/youtube.force-ssl`
6. Save and continue through the consent screen setup.

Until this scope is added here, Google will not include it in the token.

## 3. Verify the app requests the scope (optional)

1. Open DevTools → **Network** tab.
2. In the app, trigger sign-in with Google (e.g. Reconnect or Sign in with Google).
3. In the list of requests, find the redirect to `accounts.google.com` (or `https://accounts.google.com/o/oauth2/v2/auth...`).
4. Open that URL and check the query string for `scope=`. It should include `https://www.googleapis.com/auth/youtube.force-ssl` (and the other YouTube scopes).  
   - If the scope is **missing** from the URL, the Supabase project may be overriding scopes (e.g. in **Authentication** → **Providers** → **Google**); add the YouTube scope there if there is a “Scopes” field.
   - If the scope **is present** but you still get 403, complete step 1 above and re-authorize (step 3).

## 4. Re-authorize so Google issues a new token

After adding the redirect URI (step 1) and scope (step 2) in GCP:

1. **Revoke your app’s access** (optional but recommended): [Google Account → Security → Third-party apps with account access](https://myaccount.google.com/permissions) → find your app → **Remove access**.
2. In your app, click **Reconnect** in the YouTube tab. You will be sent to the dedicated YouTube OAuth flow, then back to `/studio`.
3. Approve the consent screen (you should see the YouTube permissions).
4. Try **Set thumbnail** again.

The callback stores the tokens from Google before redirecting, so the next request uses the new token with the requested scopes.

## 5. If you still get 403

- **Check server logs** when the 403 happens. The thumbnail upload error is logged with `rawErrorBody` (Google’s full response) and `scopesGranted` (what we have stored for that user). If `scopesGranted` is empty or missing `https://www.googleapis.com/auth/youtube.force-ssl`, the Reconnect flow did not complete successfully (e.g. redirect URI mismatch, or you never hit our callback).
- **Redirect URI must match exactly.** If you open the app at `http://127.0.0.1:3000`, add `http://127.0.0.1:3000/api/youtube/connect/callback` in GCP. If you use `http://localhost:3000`, add that callback. After changing redirect URIs, click Reconnect again and complete the flow.
- **Revoke and Reconnect.** At [Third-party apps with account access](https://myaccount.google.com/permissions), remove your app, then in the app click Reconnect and consent again so Google issues a new token with the thumbnail scope.
