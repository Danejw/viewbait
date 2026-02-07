# Assumption & Logic Critique: YouTube Thumbnail 403 Debugging

**Scope:** Plan and logic used to debug and mitigate the persistent 403 when calling YouTube Data API `thumbnails.set` ("The authenticated user doesn't have permissions to upload and set custom video thumbnails").

**Date:** 2026-02-06

---

## 1. Hidden assumptions

### 1.1 Same 403 for scope, ownership, and limit

**Assumption:** The single 403 response with message "doesn't have permissions to upload and set custom video thumbnails" can be caused by (a) missing OAuth scope, (b) video not owned by the token’s channel, or (c) daily thumbnail limit. We treat all three as one 403 and branch only on our own state (DB scope, ownership check).

**Critique:** The API text is explicitly about "permissions," which aligns with scope/authorization. Ownership and daily limit are inferred from external docs and community reports; we did not confirm in official YouTube API docs that the **same** 403 and message are used for quota/limit. YouTube might use 429 or a different error for limits. If so, we would never hit our "daily limit" branch and the user message could be wrong.

**Risk:** Medium. User-facing copy may be misleading if the real cause is quota/limit and the API returns a different code later.

---

### 1.2 Supabase not forwarding scopes

**Assumption:** Supabase’s `signInWithOAuth` may not send our `options.scopes` to Google when building the auth URL, so the token could lack YouTube write scope. We therefore implemented app-owned OAuth (authorize + callback) to control the `scope` parameter.

**Critique:** Plausible and a common pain point with provider-mediated OAuth. We did **not** verify Supabase’s documented behavior or inspect the redirect URL; we went straight to a second OAuth flow. Validating Supabase first would have given direct evidence.

**Risk:** Low. App-owned flow is a valid fix and gives full control; we may have added complexity without confirming the root cause in Supabase.

---

### 1.3 Stored `scopes_granted` reflects token capability

**Assumption:** Persisting the `scope` value from Google’s token response into `scopes_granted` means "the access token has these scopes." We use `dbHasThumbnailScope` to decide whether to show "Reconnect" vs "ownership/limit" and to infer token capability.

**Critique:** For the **app-owned** callback, the stored value is exactly what Google returned for that authorization, so it should match the issued token. Risk: (1) User never completed the new flow (e.g. redirect_uri mismatch), so the row might still hold an old token or a manually/otherwise set scope list. (2) After refresh, we assume the new access token has the same scopes as the refresh grant; that’s standard but we didn’t confirm it for Google.

**Risk:** Low for a clean app-owned reconnect; higher if any legacy or manual DB updates exist.

---

### 1.4 Channel match implies "ownership" for thumbnails.set

**Assumption:** If `channels.list` (mine=true) returns channel C and `videos.list` (id=videoId) shows the video’s `snippet.channelId === C`, then the token is "allowed" to set the thumbnail for that video (i.e. ownership).

**Critique:** Correct for normal channels. We did not consider Brand Accounts or delegated channel management; in those cases the same check might still pass but API behavior could differ. Edge case only.

**Risk:** Low.

---

### 1.5 No server-side token scope verification

**Assumption:** We stated Google access tokens are opaque (not JWTs) and did not decode them. We did **not** call Google’s tokeninfo endpoint (`https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=...`), which can return the token’s actual `scope` (and other claims).

**Critique:** This is a **gap**. On 403 we could have called tokeninfo and logged the real scopes. That would definitively show whether the token has `youtube.force-ssl` (or related) and would separate "token missing scope" from "ownership/limit/other." Without it we only infer from DB and ownership check.

**Risk:** High for debugging. We may keep guessing instead of having one source of truth for token scope.

---

## 2. Logical leaps

### 2.1 From "permissions" message to ownership/limit copy

**Leap:** Because we can’t read scope from the token and we store scopes in DB, when we get 403 and `dbHasThumbnailScope` is true we conclude the cause is "video not on your channel or daily limit" and show that message.

**Critique:** The API message is about "permissions." It’s a leap to present "daily limit" as an equally likely cause without confirming that YouTube uses the same 403 for limit. We also never verified the token’s scope via tokeninfo, so we don’t know that the token actually has the scope.

**Recommendation:** On 403, call tokeninfo once (or on a sample) and log actual scopes. If the token lacks the scope, show Reconnect; if it has the scope, then ownership/limit message is justified.

---

### 2.2 Reconnect flow = token has requested scopes

**Leap:** After the user completes the app-owned authorize → Google → callback flow, we assume the stored access (and refresh) token has the scopes we requested and that we stored from the token response.

**Critique:** Valid **if** the callback succeeded and we persisted the token from that response. If the user hit redirect_uri_mismatch or another error and never reached our callback, the DB could still have an old integration; we don’t distinguish "reconnect attempted but failed" from "reconnect succeeded." Token verification in the callback (channels.list) helps but only for read; it doesn’t prove write scope.

**Recommendation:** Keep callback token verification; add optional tokeninfo call on 403 to log real scopes.

---

## 3. Potential risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Same 403 used for both "permission" and "quota" unknown | Medium | Check YouTube API / quota docs; if limit returns different code, narrow user message to scope/ownership only when 403. |
| Token scope never verified server-side | High (debugging) | Call `oauth2/v3/tokeninfo` when 403 (or once per session) and log scope; use to decide Reconnect vs ownership/limit. |
| Stored scopes from wrong flow or manual edit | Medium | Rely on tokeninfo when 403; treat DB as hint, not authority. |
| Extra channels.list + videos.list on every set-thumbnail | Low | Adds latency and quota; consider doing only on 403 or sampling. |
| google_signin.md still describes Supabase callback for YouTube | Low | Update doc to describe app-owned YouTube flow and when each flow is used. |

---

## 4. Summary

- **Strongest missing step:** We did **not** verify the access token’s scope with Google (e.g. tokeninfo). Adding that on 403 would give definitive evidence and correct messaging (Reconnect vs ownership/limit).
- **Assumptions that hold:** App-owned OAuth controlling scope; storing Google’s token response scope; channel-id match as ownership for normal channels.
- **Assumptions to tighten:** That the same 403 is used for daily limit; that "permissions" 403 with DB scope and ownership check is enough to show ownership/limit copy without token verification.
