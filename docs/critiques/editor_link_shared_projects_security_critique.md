# Security critique: Editor link shared projects plan (revised v2)

Senior-engineer **security-focused** review of [editor_link_shared_projects_plan_revised.md](viewbait/docs/critiques/editor_link_shared_projects_plan_revised.md) and the related code paths. This critique evaluates authentication boundaries, authorization, redirect safety, input validation, and data exposure.

---

## High-level overview (plain language)

The plan’s **security model is sound**: RLS and API checks keep project mutation owner-only, editor membership is self-service only (users add themselves via the join endpoint), and the service client is used narrowly for project lookup. The main **gaps** are: (1) **Redirect parameters are not validated**—auth callback, auth page, and the planned onboarding redirect use user-controlled `next`/`redirect` values and can send users to arbitrary URLs (open redirect). (2) **Editor slug input** is not bounded—join and PATCH should validate length and allowed charset to avoid abuse and edge cases. (3) The plan does not call out **rate limiting** on the join endpoint, which could allow slug enumeration or abuse. (4) When **“remove editor”** is added later, it must be owner-only and must not rely on client-supplied editor user_id without server-side ownership check. (5) **`?project=` and stored onboarding redirect** must be constrained so that only project IDs in the user’s list (or allowlisted paths) are accepted, to avoid IDOR or redirect to malicious URLs.

**What is done well:** Separation of service client (lookup only) vs user client (insert into project_editors with `user_id = auth.uid()`); RLS on project_editors (SELECT/INSERT only, WITH CHECK user_id = auth.uid()); project and thumbnail RLS that expand SELECT for editors but keep INSERT/UPDATE/DELETE appropriately scoped; PATCH project guarded by `updateProject(..., user.id)` so only the owner can set editor_slug; join endpoint requires authentication.

**Recommendations:** Add explicit **redirect allowlist** (same-origin or path allowlist) for auth callback, auth page, and onboarding redirect; add **slug validation** (max length, allowed charset) for join and for PATCH when accepting editor_slug; consider **rate limiting** on join-by-editor-slug; document that **?project=** and onboarding **redirect** must be validated (project in user’s list or path allowlist); when implementing “remove editor,” enforce owner-only and validate target user server-side.

---

## Summary table

| Area | Verdict | Notes |
|------|--------|--------|
| **Auth & join endpoint** | ✔ | requireAuth; only joining user added; service client for lookup only; insert with user client (RLS). |
| **RLS: projects** | ✔ | SELECT owner or editor; INSERT/UPDATE/DELETE owner-only. |
| **RLS: project_editors** | ✔ | SELECT/INSERT own row only; no UPDATE/DELETE (prevents users removing others). |
| **RLS: thumbnails** | ✔ | SELECT own or in editable project; INSERT user_id = auth.uid(); UPDATE/DELETE thumbnail owner. |
| **PATCH project / editor_slug** | ✔ | updateProject uses user_id; only owner can update. |
| **Open redirect (auth)** | ❌ | Auth callback and auth page use unvalidated `next`/`redirect`; can redirect to arbitrary URLs. |
| **Open redirect (onboarding)** | ❌ | Plan adds `?redirect=`; must allowlist or validate to same-origin/path. |
| **Redirect validation** | ❌ | Plan does not require allowlist for redirect/next in auth or onboarding. |
| **Editor slug validation** | ⚠ | No max length or charset; join and PATCH should validate to prevent abuse/DoS. |
| **?project= / IDOR** | ✔ | Plan: set activeProjectId only when project is in user’s list—prevents IDOR. |
| **?project= / redirect allowlist** | 💡 | Explicitly require: only set project when id is in list; validate onboarding redirect path. |
| **Join response data** | ✔ | Returning project (id, name, default_settings, etc.) is acceptable for joined editor. |
| **Rate limiting** | ⚠ | Plan does not mention rate limiting on join-by-editor-slug (enumeration/abuse). |
| **Remove editor (future)** | 💡 | When added: owner-only; validate project ownership and target user server-side. |
| **Service client usage** | ✔ | Used only for project lookup by slug; never exposed to client. |

---

## Detailed security critique

### ✔ Authentication and join endpoint

- **Join-by-editor-slug** requires `requireAuth`; the joining user is the only one added to `project_editors`. The service client is used only to resolve the project by `editor_slug` (bypassing RLS for a row owned by another user). The insert is done with the **user client** and RLS `WITH CHECK (user_id = auth.uid())`, so users can only add themselves. No privilege escalation.
- **PATCH /api/projects/[id]** uses `updateProject(supabase, id, user.id, update)`, which filters by `user_id = userId`. Only the project owner can update the project, including setting or clearing `editor_slug`. Editors cannot change project settings or the editor link.

### ✔ RLS design

- **projects:** SELECT for owner or editor; INSERT/UPDATE/DELETE for owner only. Editors cannot create, update, or delete the project row.
- **project_editors:** SELECT only own rows; INSERT only with `user_id = auth.uid()`. There is no UPDATE or DELETE policy, so users cannot remove other editors (or themselves) via RLS; “remove editor” will need a dedicated owner-only endpoint.
- **thumbnails:** SELECT expanded for thumbnails in projects the user can edit; INSERT still requires `user_id = auth.uid()`; UPDATE/DELETE remain thumbnail-owner-only. Consistent with “editors can add thumbnails, not change others’ thumbnails.”

### ❌ Open redirect (auth callback and auth page)

**Current behavior:**  
- Auth callback: `next = requestUrl.searchParams.get('next') || requestUrl.searchParams.get('redirect') || '/studio'` then `NextResponse.redirect(new URL(next, request.url))`. If `next` is an absolute URL (e.g. `https://evil.com`), `new URL(next, request.url)` resolves to that URL, so the user is redirected off-site after login.  
- Auth page: `redirectTo = searchParams.get("redirect") || "/studio"` then `router.push(redirectTo)` and `signInWithGoogle(redirectTo)`. Same risk: a crafted `redirect` can send the user to an external or malicious URL.

**Impact:** Phishing: an attacker can send a link like `https://yourapp.com/auth?redirect=https://evil.com` or use the callback with `?next=https://evil.com`. After sign-in, the user is sent to the attacker’s site with an active session (or the redirect is passed to OAuth). This is a standard **open redirect** issue.

**Recommendation:**  
- Add a **redirect allowlist** (or strict validation) for all redirect/next parameters:
  - Allow only **relative paths** (e.g. start with `/` and not `//`) or a small allowlist of paths (e.g. `/`, `/studio`, `/studio?project=*`, `/e/*`, `/onboarding`).
  - Reject or fall back to `/studio` for any value that is not on the allowlist (e.g. absolute URLs, `//evil.com`, or paths outside the app).
- Apply this in: (1) **Auth callback** (`next`/`redirect`), (2) **Auth page** (`redirectTo`), and (3) **Onboarding** (stored `redirect` when the plan is implemented). Document this requirement in the plan under “Edge cases” or a dedicated “Security” subsection.

### ❌ Open redirect (onboarding redirect)

**Plan:** Middleware redirects to `/onboarding?redirect=<encoded_destination>`; onboarding page stores it and navigates there on completion.

**Risk:** If `redirect` is not validated, a link like `/onboarding?redirect=https://evil.com` could send the user off-site after they complete onboarding.

**Recommendation:** Before storing or using the onboarding `redirect` parameter, validate it the same way as auth redirects: allow only same-origin relative paths or an allowlist (e.g. `/studio`, `/studio?project=<uuid>`). Do not use raw user input for navigation. Add this to the plan (e.g. in Section 9 or Files to touch: “Validate onboarding redirect: allowlist or same-origin path only”).

### ⚠ Editor slug: input validation

**Current behavior:**  
- Join route: `editor_slug` is required and trimmed; no max length or charset check.  
- PATCH projects [id]: when the client sends `editor_slug`, it is trimmed and stored; when `editor_link_enabled: true`, the server generates the slug (crypto.randomUUID-based), which is safe.

**Risks:**  
- Very long `editor_slug` (if ever accepted from client or from path) could stress DB or logging.  
- Unusual characters in slug could cause issues in URLs or logging; the plan says “URL-safe” but does not require validation on the join or on PATCH when setting `editor_slug` explicitly.

**Recommendation:**  
- **Join endpoint:** Validate `editor_slug`: e.g. max length (e.g. 64–128 chars), allowed charset (e.g. alphanumeric and hyphen `[a-zA-Z0-9-]`). Reject with 400 if invalid.  
- **PATCH /api/projects/[id]:** If the API allows client-set `editor_slug` (not only server-generated), apply the same length and charset rules.  
- **`/e/[slug]` page:** Path param comes from the router; the join API receives it from the client (page calls join with slug). So the join endpoint is the main place to enforce validation. Add to the plan: “Validate editor_slug on join (and on PATCH if accepted): max length, URL-safe charset (e.g. alphanumeric + hyphen).”

### ✔ ?project= and IDOR

The plan states that the studio sets `activeProjectId` from `?project=` **only when the project is in the combined list** (owned + shared). That list comes from GET /api/projects, which is RLS-scoped. So a malicious `?project=<other_user_project_id>` will not appear in the list and will not be applied. **IDOR is prevented** as long as the implementation strictly “only set when id is in the list.” Recommendation: in the plan, explicitly state that **only project IDs present in the user’s project list** (from the API) may be applied from `?project=`.

### 💡 Onboarding redirect and ?project= allowlist

When implementing onboarding redirect and `?project=` handling:  
- **Onboarding redirect:** Validate stored redirect with the same rules as auth (path allowlist or same-origin relative path).  
- **?project=:** Only apply when the value is a UUID that exists in the user’s project list (no need to allowlist UUIDs globally; “in list” is the constraint). Document both in the plan.

### ✔ Join response data

The join endpoint returns the project (DbProject) so the client can redirect to `/studio?project=<id>`. Exposing `id`, `name`, `default_settings`, and `user_id` (owner) to a user who has just joined as editor is acceptable for “shared with you” and applying settings. If desired, the response could be trimmed to a minimal set (e.g. id, name, default_settings); not a security requirement, but the plan could note it as an option.

### ⚠ Rate limiting (join-by-editor-slug)

The plan does not mention rate limiting. The join endpoint is authenticated but could be used to:  
- **Enumerate** valid editor slugs (try many slugs; 404 vs 200 reveals existence).  
- **Spam** project_editors (repeated joins to the same project are idempotent but still generate traffic).

**Recommendation:** Add to the plan or deployment checklist: consider **rate limiting** on POST /api/projects/join-by-editor-slug (e.g. per user or per IP: max N requests per minute). This reduces enumeration and abuse without changing the security model.

### 💡 Remove editor (future)

The plan defers “removing editors.” When implemented:  
- Only the **project owner** may remove an editor.  
- Use **server-side** checks: resolve project by id, verify `project.user_id = auth.uid()`, then delete the row from `project_editors` for the target user. Do not rely solely on client-supplied “editor user_id” without verifying project ownership.  
- RLS on project_editors currently has no DELETE policy; the delete can be done with the owner’s client (if you add a policy “owner can delete rows for their project”) or via a small server path that uses the service client only after verifying ownership. Add a short note in the plan under “Removing editors.”

### ✔ Service client scope

The service client is used only in the join route for `getProjectByEditorSlug`. It is not exposed to the client, and no other privileged operations are performed in that flow. The insert into `project_editors` correctly uses the user client so RLS applies.

### Summary of required plan updates

1. **Redirect validation:** Require an allowlist (or same-origin path validation) for `next`/`redirect` in auth callback, auth page, and for onboarding `redirect`. Document in the plan.  
2. **Onboarding redirect:** Explicitly require validating stored redirect (allowlist or same-origin path only) before navigating.  
3. **Editor slug validation:** Require validation on join (and on PATCH if client can set editor_slug): max length, URL-safe charset.  
4. **?project=:** Explicitly state that the studio may set activeProjectId from `?project=` only when that project id is in the user’s project list.  
5. **Rate limiting:** Add to plan or checklist: consider rate limiting on join-by-editor-slug.  
6. **Remove editor:** When added, require owner-only and server-side verification of project ownership and target user.

---

## Summary

The editor link plan’s **authorization and RLS design are solid**. The main security improvements are: **validating all redirect/next parameters** (auth and onboarding) to prevent open redirects, **validating editor_slug** (length and charset) at the join and PATCH boundaries, **documenting ?project= and onboarding redirect constraints**, **considering rate limiting** on the join endpoint, and **documenting owner-only, server-verified “remove editor”** for when it is implemented. Adding these to the plan and implementation will make the feature robust from a security perspective.
