# Assumption & Logic Critique: Tokeninfo-on-403 Implementation

**Scope:** The implementation that calls Google's tokeninfo endpoint when `thumbnails.set` returns 403, then uses the result to decide Reconnect vs ownership/limit messaging.

**Date:** 2026-02-06

---

## 1. Hidden assumptions

### 1.1 Tokeninfo returns `scope` for OAuth2 access tokens

**Assumption:** `GET https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=...` returns JSON that includes a `scope` field (space-separated) for the access token we send.

**Critique:** Google's tokeninfo endpoint is documented for both ID tokens and access tokens. For access tokens it typically returns `aud`, `scope`, `exp`, etc. We did not confirm the exact response schema in current Google docs; if the field were renamed or only present for certain token types, we'd get `tokenInfoScopes = []` and `tokenHasThumbnailScopeFromGoogle = false`, which would incorrectly push users toward Reconnect.

**Risk:** Low if tokeninfo behavior is stable; medium if Google changes or restricts tokeninfo for access tokens.

---

### 1.2 Passing the access token in the query string

**Assumption:** Sending the access token as a query parameter to tokeninfo is acceptable and does not create meaningful security or logging exposure.

**Critique:** Query strings are more likely to appear in server/proxy logs and referrer headers than Authorization headers. We do not log the token in our app logs (we log `tokenInfoScopes` only). Google's tokeninfo API is documented to accept the token in the query. So the main risk is third-party logging; we don't control that. Using a POST body would be preferable if the endpoint supported it; it typically does not for this read-only lookup.

**Risk:** Low; standard practice for this endpoint. Worth noting so we don't reuse the pattern for tokens in other URLs.

---

### 1.3 Tokeninfo failure → fall back to DB

**Assumption:** When the tokeninfo request fails (network, 4xx, parse error) we set `tokenHasThumbnailScopeFromGoogle = null` and use `dbHasThumbnailScope` for `tokenHasScope`. So "no tokeninfo result" is treated as "trust DB."

**Critique:** If tokeninfo is frequently unavailable (rate limits, timeouts, or Google deprecating scope in the response), we would often fall back to DB and repeat the previous behavior (possibly wrong message). We also do not log that tokeninfo failed, so debugging is harder.

**Risk:** Medium. Fallback is reasonable, but we should log when tokeninfo fails so we can see if fallback is happening often.

---

### 1.4 One scope is sufficient for thumbnails.set

**Assumption:** Checking for `YOUTUBE_THUMBNAIL_SCOPE` (`youtube.force-ssl`) alone is enough to decide "token has thumbnail permission." We do not require `youtube.upload` or any other scope in the tokeninfo check.

**Critique:** The YouTube API docs attribute thumbnails.set to "Manage your YouTube account" (force-ssl). We previously added `youtube.upload` to requested scopes in case it helped; we did not tie that into this check. If the API actually requires both, we could have force-ssl in the token but still 403, and we'd show the ownership/limit message instead of Reconnect.

**Risk:** Low; force-ssl is the documented scope for this method.

---

### 1.5 Token still valid at tokeninfo call time

**Assumption:** The same `accessToken` we used for the thumbnails.set request is still valid when we call tokeninfo immediately after receiving 403.

**Critique:** We do not refresh or replace the token between the two calls. A 403 does not invalidate the token. So the token is unchanged and valid; tokeninfo will return data for that token.

**Risk:** None.

---

### 1.6 When token has scope but 403 → only ownership or limit

**Assumption:** If `tokenHasThumbnailScopeFromGoogle === true` and we still get 403, the cause is either (1) video not on the token's channel, or (2) daily limit / account restriction. We do not consider other causes (e.g. API bug, wrong upload endpoint, token bound to different OAuth client).

**Critique:** Ownership and limit are the most plausible. Other causes are rarer; we have no evidence of them. The user message is still a best-effort explanation.

**Risk:** Low.

---

## 2. Logical leaps

### 2.1 "Token has scope" implies user should not Reconnect

**Leap:** If tokeninfo says the token includes the thumbnail scope, we set `isScopeError = false` and never return `SCOPE_REQUIRED`. So we never suggest Reconnect in that case.

**Critique:** Correct. If Google attests the token has the scope, re-auth will not fix the 403. Directing the user to ownership/limit is appropriate.

---

### 2.2 "Token lacks scope" → always Reconnect message

**Leap:** When `tokenHasScope` is false (from tokeninfo or DB fallback), we show the Reconnect message and return `SCOPE_REQUIRED`.

**Critique:** Valid. The only way to get the scope is to reconnect. One nuance: if tokeninfo failed and DB is wrong (e.g. manually set), we might still suggest Reconnect when the token actually had scope (e.g. transient tokeninfo failure). Logging tokeninfo failure would help distinguish that.

---

## 3. Gaps and recommendations

| Item | Recommendation |
|------|----------------|
| Tokeninfo failure invisible | Log when tokeninfo request fails or returns non-OK (e.g. `logWarn` with `tokeninfoStatus` or `tokeninfoError`), so we can see how often we fall back to DB. |
| Response shape | If we ever see empty `tokenInfoScopes` with a 200 from tokeninfo, inspect the raw response to confirm whether Google omits or renames `scope`. |
| Query-string token | Avoid reusing the "token in URL" pattern elsewhere; prefer headers or body for tokens. |

---

## 4. Summary

- **Assumptions that hold:** Tokeninfo returns scope for our access token; same token used for both calls; one scope (force-ssl) is sufficient for thumbnails.set; token has scope but 403 → ownership/limit messaging.
- **Risks:** Fallback to DB when tokeninfo fails is reasonable but should be observable (log failure); token in query is standard for this endpoint but worth not replicating.
- **Improvement:** Add a log line when tokeninfo fails or returns non-OK so we can tell Reconnect vs fallback in production.
