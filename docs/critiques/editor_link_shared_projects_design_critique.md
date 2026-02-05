# Design critique: Editor link shared projects (plan vs codebase)

Senior-engineer **design-focused** review of the strategy document **Editor link: share project for editing** (revised plan) and its alignment with the ViewBait codebase. This critique evaluates the strategy’s design choices, implementation gaps, and consistency with the existing architecture.

---

## High-level overview (plain language)

The **revised plan is well-designed** and matches the app’s patterns: protected `/e` routes, auth redirect, editor-slug similar to share_slug, `project_editors` join table, and RLS that expands SELECT for editors while keeping mutations owner- or creator-scoped. The flow (editor link → auth → join → redirect to studio with project) is clear and the prior critique’s fixes (thumbnails-by-project without `user_id` filter, service client for join lookup, two-query merge for projects, onboarding/OAuth callouts) are reflected in the plan and, where implemented, in the code.

**What’s already in good shape:** Middleware protects `/e`; the join API uses the service client for project lookup and the user client for inserting into `project_editors`; GET /api/projects returns owned + shared with `isShared` via a two-query merge; thumbnails list when `projectId` is set filters only by `project_id` and relies on RLS; generate route uses `getProjectByIdForAccess` so editors can generate into the project; migration 010 adds `project_editors`, `editor_slug`, and updated RLS; types include `editor_slug`; project selector shows shared projects with a “(Shared)” label.

**Design/implementation gaps:** (1) **Studio never reads `?project=` from the URL.** The plan says to set `activeProjectId` from the query and then clear it; the provider only hydrates from localStorage, so after the editor link redirect to `/studio?project=<id>` the project is not auto-selected. (2) **Share dialog has no “Editor link” block.** The plan calls for a second block to enable/disable `editor_slug` and show a copyable `/e/<slug>` URL; the dialog only implements the gallery share block. (3) **Editors cannot move thumbnails into the shared project.** PATCH /api/thumbnails/[id] and POST /api/thumbnails/[id]/project validate the project with `getProjectById` (owner-only), so editors get “Project not found or access denied” when assigning a thumbnail to the shared project. (4) **Onboarding does not preserve the post-login destination.** The plan says to preserve the intended URL (e.g. `/studio?project=...`) through onboarding; middleware redirects to `/onboarding` without a redirect param, and onboarding completion does not send the user to a stored destination.

**Verdict:** The **design is sound**; the main issues are **incomplete implementation** of URL-driven project selection, share-dialog editor link UI, editor-capable project validation for thumbnail move/update, and redirect preservation through onboarding. Addressing these four areas will bring behavior in line with the plan.

---

## Summary table

| Area | Verdict | Notes |
|------|--------|--------|
| **Overall strategy** | ✔ | Editor link, project_editors, RLS, and auth flow match the goal and existing patterns. |
| **URL and auth flow** | ✔ | `/e/[slug]` protected; redirect to auth with `redirect`; join API then redirect to `/studio?project=<id>`. |
| **Database & RLS (migration 010)** | ✔ | `project_editors`, `editor_slug`, projects/thumbnails SELECT for editors; mutations appropriately restricted. |
| **Join endpoint** | ✔ | Service client for project lookup; user client for `ensureProjectEditor`; idempotent. |
| **GET /api/projects** | ✔ | Two-query merge with `isShared`; list includes owned + shared. |
| **Thumbnails list when projectId set** | ✔ | No `user_id` filter; filter by `project_id` only; RLS enforces access. |
| **Generate route (project_id)** | ✔ | Uses `getProjectByIdForAccess` so editors can generate into the project. |
| **Studio ?project= handling** | ❌ | Plan: read `?project=`, set `activeProjectId`, persist, clear param. Code: provider only reads from localStorage; no URL sync. |
| **Share dialog: editor link** | ❌ | Plan: second block for editor link (enable/disable, copy `/e/<slug>`). Code: only gallery share block present. |
| **Thumbnail project validation (PATCH / POST project)** | ❌ | Plan implies editors can add/assign thumbnails to shared project. Code uses `getProjectById` (owner-only); editors cannot move/assign. |
| **Onboarding + editor link** | ⚠ | Plan: preserve destination through onboarding. Code: middleware redirects to `/onboarding` without redirect param; completion does not use stored destination. |
| **OAuth redirect allowlist** | 💡 | Plan calls this out; deployment checklist should confirm `/e/*` is allowed. |
| **Project selector & list** | ✔ | Uses combined list; shows “(Shared)” for shared projects. |
| **Types (editor_slug)** | ✔ | `DbProject` and related types include `editor_slug`. |

---

## Detailed design critique

### ✔ Strengths (design and implementation)

- **URL and auth:** Protecting `/e` in middleware and using `redirect=/e/<slug>` is consistent with `/studio` and existing auth handling. The `/e/[slug]` page calls the join API and redirects to `/studio?project=<id>` as specified.
- **Join endpoint design:** Using the **service client** for project lookup (bypassing RLS for a row owned by someone else) and the **user client** for `ensureProjectEditor` (RLS allows insert with `user_id = auth.uid()`) is the right split and is implemented correctly.
- **Projects list:** Two-query merge (owned + shared via `project_editors`) with `isShared` keeps semantics clear and is implemented in `listProjectsWithShared` and GET /api/projects.
- **Thumbnails by project:** The plan’s requirement to avoid a `user_id` filter when `projectId` is set is implemented in `buildThumbnailsQuery`: when `projectId` is set, the query filters only by `project_id` (and optional favorites) and relies on RLS.
- **Generate route:** `getProjectByIdForAccess` allows both owners and editors to use `project_id`; thumbnail rows still use `user_id = auth.uid()` for the creator. Aligns with the plan.
- **RLS and migration 010:** Policies for projects (SELECT owner or editor), thumbnails (SELECT own or in editable project), and `project_editors` (select/insert own row) match the described design.
- **Project selector:** Consumes the combined list and shows “(Shared)” for shared projects; no design gap there.

### ❌ Studio: `?project=` not applied to `activeProjectId`

**Plan (Section 4):** “On mount, read `project` from `useSearchParams()`. If present and the project is in the combined list, set `activeProjectId` to that id and persist to localStorage; then clear the query.”

**Code:** `StudioProvider` initializes `activeProjectId` only from `localStorage`. The studio page has `StudioViewFromQuery`, which syncs only `?view=admin` and `?view=roadmap`. Nothing reads `?project=` or calls `setActiveProjectId` from the URL.

**Impact:** After the editor link flow, the user is sent to `/studio?project=<id>`, but the studio does not switch to that project; behavior contradicts the plan and the intended UX.

**Recommendation:** Add a small component (e.g. `StudioProjectFromQuery`) that: (1) reads `project` from `useSearchParams()`; (2) when projects have loaded, if the id is in the list, calls `setActiveProjectId(id)` and persists to localStorage; (3) clears the `project` query param (e.g. via `router.replace` without `project`). Handle the race where the project list may load after the join (e.g. refetch after join or wait for list and then set if id appears).

### ❌ Share dialog: missing “Editor link” block

**Plan (Section 6):** Add a second block for “Editor link”: enable/disable that sets/clears `editor_slug` via PATCH; when enabled, show copyable `${origin}/e/${editor_slug}` and a short description.

**Code:** `ShareProjectDialog` only implements the gallery share block (share_slug, share_mode, `/p/<slug>`). There is no UI for `editor_slug` or `/e/<slug>`.

**Impact:** Owners cannot create or copy the editor link from the share dialog; the feature is only usable if they set `editor_slug` via another path (e.g. API only).

**Recommendation:** Add an “Editor link” section: toggle to enable/disable (PATCH with `editor_slug` set or null, reusing the same slug-generation pattern as share_slug on the server); when enabled, show the `/e/<slug>` URL and a copy button; reuse the same copy/error/saving patterns as the gallery block. Ensure PATCH /api/projects/[id] continues to allow only the owner to set `editor_slug` (already enforced by `user_id` in updateProject).

### ❌ Thumbnail project validation: editors cannot assign to shared project

**Plan (Section 3):** Editors can “add thumbnails to that project”; generate already allows `project_id` for editable projects. The plan also implies that moving/assigning existing thumbnails to the project should work for editors.

**Code:**  
- PATCH /api/thumbnails/[id]: when `payload.project_id` is set, validation uses `getProjectById(supabase, payload.project_id, user.id)` → owner-only.  
- POST /api/thumbnails/[id]/project: same check with `getProjectById`.  
So an **editor** (not owner) gets “Project not found or access denied” when setting a thumbnail’s project to the shared project.

**Impact:** Editors can generate into the project but cannot move existing thumbnails into it (or set project_id on update). UX is inconsistent with the “add thumbnails to this project” intent.

**Recommendation:** For both routes, when validating `project_id`, use **owner-or-editor** semantics: e.g. `getProjectByIdForAccess(supabase, projectId)` (or a dedicated helper that returns the project if the user is owner or in project_editors). If the project is returned, allow the assignment. Keep thumbnail row ownership unchanged (`user_id = auth.uid()` for the thumbnail); only the **project** access check should allow editors.

### ⚠ Onboarding: redirect not preserved

**Plan (Section 9, critique-based update):** When redirecting to onboarding (e.g. from /studio), preserve the intended destination (e.g. `/studio?project=...`) so that after onboarding the user is sent there.

**Code:** Middleware redirects to `/onboarding` with no query (e.g. no `?redirect=/studio?project=...`). Onboarding completion calls `markOnboardingCompleted()` but does not read a stored redirect or query param to send the user to a specific URL.

**Impact:** Editor-link users who need onboarding land on /onboarding and, after completing it, are not automatically sent to the shared project; they lose the “open this project” context.

**Recommendation:** (1) In middleware, when redirecting to onboarding from /studio (or when the original request was /studio with query), set redirect to `/onboarding?redirect=<encoded_destination>` (e.g. `/studio?project=xxx`). (2) On the onboarding page, read `redirect` from searchParams and store it (e.g. sessionStorage or state). (3) On completion (e.g. when marking onboarding complete or on the “Go to Studio” step), navigate to the stored redirect if present, otherwise to `/studio`. This keeps the plan’s “preserve redirect through onboarding” design.

### 💡 OAuth redirect allowlist

The plan already calls out confirming that `/e/*` (or origin + `/e/...`) is an allowed redirect URL in Supabase Auth and the OAuth provider. No design change; ensure this is on the deployment/checklist.

### ✔ Other design choices

- **Removing editors:** Correctly deferred; owner-only removal from `project_editors` can be added later.
- **Settings:** Using project `default_settings` when an editor opens the project (via URL or selector) reuses existing studio logic; no “settings in URL” is needed.
- **Editor slug uniqueness:** Same as share_slug (globally unique, generate on enable, clear on disable); implementation in PATCH projects/[id] follows this.

---

## Summary

The **editor link shared projects** plan is **well-designed** and consistent with the codebase. The main gaps are **implementation** rather than design:

1. **Studio:** Implement reading `?project=` and setting `activeProjectId` (and clearing the param) so that the post–editor-link redirect actually opens the project.
2. **Share dialog:** Add the “Editor link” block (enable/disable, copy `/e/<slug>`) so owners can create and share the link from the UI.
3. **Thumbnail APIs:** Use owner-or-editor project validation (e.g. `getProjectByIdForAccess`) in PATCH thumbnails/[id] and POST thumbnails/[id]/project so editors can assign thumbnails to the shared project.
4. **Onboarding:** Preserve destination (e.g. `?redirect=`) when sending users to onboarding and send them to that destination after completion.

Once these four items are done, behavior will align with the plan and the feature will be consistent and complete from a design perspective.
