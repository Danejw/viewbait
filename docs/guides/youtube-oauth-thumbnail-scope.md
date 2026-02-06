# YouTube OAuth: Thumbnail scope and Reconnect

This guide explains how to get the **thumbnail upload** scope for the YouTube integration. The set-thumbnail feature (e.g. “Set on YouTube” from the gallery or the set-thumbnail icon on video cards) requires the `youtube.force-ssl` scope (“Manage your YouTube account”). That scope is **not** granted by normal app login; it is only granted when you use **Reconnect** in the **YouTube** tab in Studio.

---

## Use Reconnect in the YouTube tab (not login)

- **Sign in with Google** (Supabase) is used only for logging into the app. It does **not** request YouTube write scopes or update `youtube_integrations`.
- **YouTube Connect / Reconnect** is the flow that requests `youtube.force-ssl` and stores tokens (and `scopes_granted`) in `youtube_integrations`. It is started only when you click **Connect with Google** or **Reconnect** in the **YouTube** tab in Studio (via `/api/youtube/connect/authorize`).

So to enable thumbnail upload:

1. In Studio, open the **YouTube** tab (sidebar).
2. If you see “Connect with Google”, click it. If you’re already connected, click **Reconnect** (in the channel summary bar or in the missing-scope banner).
3. Complete the Google consent screen. Ensure the requested permissions include something like “Manage your YouTube account” (this is the `youtube.force-ssl` scope).

Logging out and back in with Google will **not** update YouTube tokens or add the thumbnail scope.

---

## Redirect URI must match exactly

The OAuth redirect URI used by the app is:

```text
<your-app-origin>/api/youtube/connect/callback
```

(No trailing slash.)

**Examples:**

- Local (localhost): `http://localhost:3000/api/youtube/connect/callback`
- Local (127.0.0.1): `http://127.0.0.1:3000/api/youtube/connect/callback`
- Production: `https://yourdomain.com/api/youtube/connect/callback`

In **Google Cloud Console** → **APIs & Services** → **Credentials** → open the **OAuth 2.0 Client ID** that matches the `GOOGLE_CLIENT_ID` in your app’s env → **Authorized redirect URIs** → add the **exact** URI for the origin you use. If you open the app at `http://127.0.0.1:3000`, the redirect URI must use that same origin. A mismatch can cause `redirect_uri_mismatch` or token exchange failures.

---

## Add the scope on the OAuth consent screen

- Go to **Google Cloud Console** → **APIs & Services** → **OAuth consent screen** → Edit app → **Scopes** → Add or remove scopes.
- Under **YouTube Data API v3**, add **“Manage your YouTube account”** (scope value `https://www.googleapis.com/auth/youtube.force-ssl`). Save.

Without this scope on the consent screen, Google may not include it in the token, and the set-thumbnail icon will not appear.

---

## Same OAuth client in the app

The app’s `GOOGLE_CLIENT_ID` (and `GOOGLE_CLIENT_SECRET`) must be the **same** OAuth client where you added the redirect URI and where the consent screen has the YouTube scope. If you use one client for “Sign in with Google” and another for “YouTube API”, the app must use the client configured for the YouTube connect flow for the `/api/youtube/connect/*` routes.

---

## Optional: Revoke and Reconnect

If the set-thumbnail icon still doesn’t appear after Reconnect:

1. Go to [Google Account → Security → Third-party apps with account access](https://myaccount.google.com/permissions), find your app, and remove access.
2. In the app, open the **YouTube** tab and click **Reconnect** (or Connect with Google). Go through consent again so Google issues a new token with the requested scopes.

After a successful Reconnect with the thumbnail scope, `scopes_granted` in `youtube_integrations` will include `youtube.force-ssl` and the set-thumbnail icon will be shown (for Pro users).
