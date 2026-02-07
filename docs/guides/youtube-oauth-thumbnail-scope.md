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

**After Reconnect:** Check your server logs. You should see `YouTube connect callback: token verification` with `tokenHasYouTubeAccess: true`. If you see `token verification failed` or `tokenHasYouTubeAccess: false`, the token from Google did not get the requested YouTube scopes (fix the consent screen, test users, or redirect URI and try again).

---

## Redirect URI must match exactly

The OAuth redirect URI used by the app is:

```text
<your-app-origin>/api/youtube/connect/callback
```

(No trailing slash.)

**Recommended:** Set `NEXT_PUBLIC_APP_URL` (or `APP_URL`) in your env to the exact origin you use to open the app (e.g. `http://localhost:3000` or `https://yourdomain.com`). The app then uses that to build the redirect URI, so it stays consistent and matches what you add in GCP. If you don’t set it, the app derives the origin from the request, which can differ (e.g. `127.0.0.1` vs `localhost`) and cause **Error 400: redirect_uri_mismatch**.

**Examples:**

- Local (localhost): `http://localhost:3000/api/youtube/connect/callback`
- Local (127.0.0.1): `http://127.0.0.1:3000/api/youtube/connect/callback`
- Production: `https://yourdomain.com/api/youtube/connect/callback`

In **Google Cloud Console** → **APIs & Services** → **Credentials** → open the **OAuth 2.0 Client ID** that matches the `GOOGLE_CLIENT_ID` in your app’s env → **Authorized redirect URIs** → add the **exact** URI. It must match the redirect URI the app sends (use the same origin as `NEXT_PUBLIC_APP_URL` if set). A mismatch causes `redirect_uri_mismatch` or token exchange failures.

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

---

## 403 "doesn't have permissions to upload and set custom video thumbnails"

If Reconnect succeeds but setting a thumbnail still returns this error, **Google did not include the thumbnail scope in the token**. The app requested the scope, but the issued token does not have it. Do the following:

### 1. Add yourself as a Test user (required when app is in Testing)

When your OAuth consent screen is in **Testing** mode, Google only grants sensitive/restricted scopes (including “Manage your YouTube account”) to **Test users**.

1. Go to **Google Cloud Console** → **APIs & Services** → **OAuth consent screen**.
2. Under **Test users**, click **+ ADD USERS**.
3. Add the **exact Google account** you use to sign in and reconnect (the one that gets the 403).
4. Save.
5. In [Google Account → Third-party apps with account access](https://myaccount.google.com/permissions), remove your app’s access.
6. In the app, open the **YouTube** tab and click **Reconnect**. Complete the consent screen again.

After that, Google should issue a token that includes `youtube.force-ssl`, and set-thumbnail should work.

### 2. Confirm the scope is on the consent screen

In **OAuth consent screen** → **Edit app** → **Scopes**, ensure **“Manage your YouTube account”** (`https://www.googleapis.com/auth/youtube.force-ssl`) is added and saved. If it is missing, add it, save, then revoke and Reconnect again.

### 3. Supabase Dashboard (optional)

If your project uses **Supabase Auth** with the Google provider, check **Supabase Dashboard** → **Authentication** → **Providers** → **Google** for any “Additional scopes” or similar option. If present, add `https://www.googleapis.com/auth/youtube.force-ssl` so the server requests it when redirecting to Google.

### 4. Video ownership and channel

A 403 can also mean the **video is not owned by the channel** the connected Google account is using. The YouTube API only allows setting thumbnails for videos on **your own** channel.

- **Single channel:** Ensure the video (e.g. the one in the YouTube tab) was uploaded by the same Google account you used to reconnect. If the video list is empty or shows another channel's videos, you're likely on the wrong account.
- **Multiple channels / Brand Account:** The token is tied to one Google account. If that account manages several YouTube channels (e.g. a Brand Account), the API uses the **default** channel for that account. Try setting the thumbnail on a video that belongs to that default channel, or sign in with the Google account that owns the channel where the video lives.
- **Quick check:** In YouTube Studio in the browser, confirm the video appears under "Content" for the channel you expect. Then reconnect in the app with that same Google account and try again.

### 5. Thumbnail upload limits

YouTube enforces **per-channel limits** on how many custom thumbnails can be set in a rolling period (e.g. 24 hours). If you've already set many thumbnails recently, the API may return 403 until the limit resets. See [YouTube's custom thumbnail limits](https://support.google.com/youtube/answer/72431).
