# Critique: Editor link shared projects plan

Senior-engineer review of the implementation plan **Editor link: share project for editing** (plan file: `c:\Users\RecallableFacts\.cursor\plans\editor_link_shared_projects_3b4a3da8.plan.md`), evaluated against the ViewBait codebase and architecture.

---

## High-level overview (plain language)

The plan is **structurally sound** and aligns well with existing patterns: protected routes, auth redirect, share_slug-style editor_slug, and RLS for projects/thumbnails. The separation of “gallery link” vs “editor link,” the use of a `project_editors` join table, and owner-only project mutation with editor-only thumbnail-add semantics are the right design choices.

**Main strengths:** Clear URL and auth flow (`/e/[slug]` → auth → join → studio?project=); correct reuse of auth callback and middleware; sensible RLS (SELECT expanded for editors, INSERT/UPDATE/DELETE kept tight); and the note that settings are shared via project `default_settings` without extra URL params. The file-touch list and edge-case callouts (onboarding, slug uniqueness, removing editors) are useful.

**Critical gap:** The plan says the thumbnails API should “not restrict by ownership when filtering by project_id” and that “RLS will enforce.” In the codebase, the thumbnails list is built with **`QueryPatterns.userOwnedWithFavorites`**, which applies **`.eq('user_id', userId)`**. So even with new RLS allowing editors to see thumbnails in shared projects, the **application-level** query would still return only the current user’s thumbnails when viewing a shared project. Editors would not see the owner’s (or other editors’) thumbnails in that project. The plan must explicitly require changing the thumbnails list behavior when `projectId` is set (e.g. when listing by project, do not filter by `user_id` and rely on RLS to restrict to allowed projects).

**Other risks:** (1) **Join endpoint and RLS:** Resolving project by `editor_slug` likely needs the service client or a small server-side bypass of RLS (project row is owned by another user), so the plan’s “service or server client” must be explicit: use service client to look up by `editor_slug`, then insert into `project_editors` with the current user. (2) **GET /api/projects** returning shared projects: with RLS updated, listing “owned” uses the user’s session and will only return rows allowed by RLS; to also return “shared” projects the list must either query via a view/function that unions owned + editor membership, or use two queries (owned + shared) and merge with `isShared`. The plan mentions “extend listProjects” or “separate query and merge”—the merge approach is clearer and avoids RLS complexity on a single SELECT. (3) **Onboarding:** The plan flags that editor-link users might hit onboarding before studio; it should recommend preserving `redirect` through onboarding (e.g. after onboarding complete, redirect to `redirect` or `/studio?project=...`) so the editor still lands on the right project. (4) **OAuth redirect URL:** Sign-in with Google uses a redirect URL; ensure `/e/[slug]` is an allowed redirect target in Supabase (and any OAuth config) so post-login redirect to `/e/xyz` works.

**Verdict:** Proceed with the plan after addressing the thumbnails-list filter gap and clarifying join endpoint auth (service client for lookup). Optionally tighten GET /api/projects implementation (two-query merge) and post-onboarding redirect behavior.

---

## Summary table

| Area | Verdict | Notes |
|------|--------|--------|
| **Overall strategy** | ✔ | Editor link, project_editors, and RLS expansion match the goal and existing patterns. |
| **URL and auth flow** | ✔ | `/e/[slug]` protected, redirect to auth with `redirect`, then join → studio?project= is correct. |
| **Database: project_editors** | ✔ | Join table with (project_id, user_id), unique, CASCADE; appropriate. |
| **RLS: projects** | ✔ | SELECT for owner or editor; INSERT/UPDATE/DELETE owner-only is correct. |
| **RLS: thumbnails** | ✔ | SELECT for own or project in project_editors; INSERT user_id = auth; UPDATE/DELETE owner-only is correct. |
| **Thumbnails list when projectId set** | ❌ | Plan says “do not restrict by ownership”; code uses `userOwnedWithFavorites` which adds `.eq('user_id', userId)`. Editors would only see their own thumbnails in a shared project. Must change query when listing by project to rely on RLS (no user_id filter for that path). |
| **Join-by-editor-slug endpoint** | ⚠ | Lookup by editor_slug must read a project owned by another user; use **service client** for that lookup, then insert into project_editors with current user. Plan says “service or server client”—should be explicit: service for lookup. |
| **GET /api/projects (owned + shared)** | ✔ | Merging owned + editor list with `isShared` is the right contract; two-query merge is clearer than complex RLS on one SELECT. |
| **Generate route: project_id** | ✔ | getProjectByIdOrEditable (owner or project_editors) is the right check. |
| **Studio ?project= and settings** | ✔ | Set activeProjectId from URL, clear param, apply default_settings from project—already supported. |
| **Share dialog: editor link** | ✔ | Second block, enable/disable editor_slug, copy /e/ slug, reuse slug pattern. |
| **Onboarding + editor link** | ⚠ | Plan notes editor-link users may hit onboarding; recommend preserving redirect through onboarding so they land on /studio?project= after completion. |
| **OAuth / redirect allowlist** | 💡 | Ensure /e/* is an allowed redirect target in Supabase Auth (and Google OAuth) so post-login redirect to /e/[slug] works. |
| **Removing editors** | ✔ | Correctly deferred; owner-only delete from project_editors can be added later. |

---

## Detailed critique

### ✔ Strengths

- **URL and auth:** Protecting `/e` in middleware and using `redirect=/e/<slug>` matches how `/studio` is protected and how the auth page and callback already handle `redirect`/`next`. No change to auth callback is needed.
- **project_editors and RLS:** The join table gives a clear membership model. Expanding projects SELECT and thumbnails SELECT so editors can see the project and all thumbnails in it, while keeping project mutation and thumbnail UPDATE/DELETE owner/creator-scoped, is the right security boundary.
- **Settings:** Using the project’s `default_settings` when an editor opens the project (via URL or selector) reuses the existing studio-provider logic; no “settings in URL” is needed.
- **Share dialog:** Adding an “Editor link” block next to the existing gallery link, with enable/disable and copy URL, keeps one place for sharing and reuses the slug-generation pattern from share_slug.
- **File-touch list and edge cases:** The table of files and the notes on onboarding, slug uniqueness, and removing editors give implementers a clear checklist and scope boundary.

### ❌ Thumbnails list: application-level user_id filter

The plan states: “Ensure the thumbnails API does not restrict by ownership when filtering by project_id; RLS will enforce.”

In the codebase, [buildThumbnailsQuery](viewbait/lib/server/data/thumbnails.ts) uses [QueryPatterns.userOwnedWithFavorites](viewbait/lib/server/utils/query-builder.ts), which builds a query with **`.eq('user_id', userId)`**. So when an editor requests `GET /api/thumbnails?projectId=<shared_project_id>`, they would only get thumbnails where `user_id = current user` and `project_id = shared_project_id`—i.e. only their own thumbnails in that project, not the owner’s or other editors’.

**Recommendation:** In the plan (and implementation), explicitly:

1. When listing thumbnails **by project** (`projectId` provided), do **not** apply a `user_id` filter; filter only by `project_id` (and optional favorites/sort). RLS will limit results to projects the user owns or is in `project_editors` for.
2. When listing thumbnails **without** a project (all thumbnails), keep current behavior (user_id filter) so the user sees only their own thumbnails across all projects.

This may require a separate code path in `buildThumbnailsQuery` or in the route (e.g. when `projectId` is set, use a query that filters only by `project_id` and ordering, and omit `user_id`), and possibly a small helper in the query-builder for “thumbnails by project (RLS-only)” if you want to keep query building centralized.

### ⚠ Join-by-editor-slug: use service client for lookup

The “join by editor slug” endpoint must resolve a project by `editor_slug`. That project is owned by another user. With RLS, a normal user-scoped client cannot SELECT that project row. The plan says “Resolves project by editor_slug (service or server client).”

**Recommendation:** Be explicit: use the **service client** (or equivalent privileged client) to look up the project by `editor_slug`. Then, with the current user from `requireAuth`, insert into `project_editors` (service client or a dedicated function that checks the user is the one joining). Return the project to the client so it can redirect to `/studio?project=<id>`. This avoids RLS blocking the lookup and keeps “who can join” as “anyone with the link,” which matches the product intent.

### ⚠ GET /api/projects: owned + shared

The plan suggests either extending `listProjects` to union owned + editor membership or doing a separate “shared” query and merging. With RLS:

- A single `from('projects').select(...)` with the user’s session will only return rows that pass RLS. After updating RLS to allow SELECT for `user_id = auth.uid() OR id IN (SELECT project_id FROM project_editors WHERE user_id = auth.uid())`, one query can return both owned and shared projects. To mark “shared” you still need to know which rows came from editor membership: either a computed column/VIEW, or a second query to `project_editors` and merge in the client/route. The “two-query merge” (list owned, list project_ids from project_editors, fetch those projects, merge with `isShared: true`) is straightforward and avoids RLS policy complexity; the plan already allows for it.

**Recommendation:** In the plan, prefer the two-query merge unless you introduce a DB view/function that returns a single result set with an `is_shared` (or similar) flag. Document that GET /api/projects returns both owned and shared and that each project has `isShared: boolean`.

### ⚠ Onboarding and redirect

The plan correctly notes that editor-link users might be sent to onboarding before studio. Middleware currently redirects users who have not completed onboarding to `/onboarding`, and the auth `redirect` param is used for post-login destination, not necessarily preserved through onboarding.

**Recommendation:** In the plan, add: “When redirecting to onboarding (e.g. from /studio), preserve the intended destination (e.g. /studio?project=...) in sessionStorage or a query param so that after onboarding is completed, the user is sent to that URL.” Then implement onboarding completion to read that stored redirect and send the user to the editor’s project when applicable.

### 💡 OAuth redirect allowlist

After sign-in (e.g. Google OAuth), Supabase redirects to the URL provided (e.g. `redirectTo`). If that URL is `/e/xyz`, the redirect target must be allowed in Supabase Auth URL settings (and any OAuth provider config).

**Recommendation:** In the plan or deployment checklist, add: “Confirm that `/e/*` (or the app origin + path `/e/...`) is an allowed redirect URL in Supabase Auth and in the OAuth provider (e.g. Google) so that post-login redirect to the editor link works.”

### ✔ Generate route and getProjectByIdOrEditable

Allowing `project_id` when the user is owner or in `project_editors` via a helper like `getProjectByIdOrEditable(supabase, projectId, userId)` keeps the generate route consistent and secure. Thumbnail rows still use `user_id = auth.uid()` for the creator.

### ✔ Studio ?project= and default_settings

Reading `?project=` from the URL, setting `activeProjectId`, persisting to localStorage, and clearing the param is the right UX. Applying `default_settings` when the project is in the list is already implemented in the studio provider; no extra “settings in URL” is needed.

### ✔ Share dialog and slug generation

Reusing the same slug-generation approach as `share_slug` for `editor_slug` keeps behavior consistent. Adding an “Editor link” section with enable/disable and copyable `/e/<slug>` is clear and matches the existing gallery-link pattern.

---

## Summary

The plan is **sound and implementable**. The one **critical** fix is to explicitly change the thumbnails list behavior when `projectId` is set so that the query does not filter by `user_id` and relies on RLS to show all thumbnails in that project (for both owners and editors). Clarify that the join-by-editor-slug endpoint uses the **service client** for project lookup by `editor_slug`, and optionally tighten the GET /api/projects approach (two-query merge with `isShared`) and the handling of redirect through onboarding and OAuth allowlist. With those updates, the plan is robust and aligned with the codebase.
