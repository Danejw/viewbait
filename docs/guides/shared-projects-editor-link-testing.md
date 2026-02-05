# Manual Testing Guide: Shared Projects (Editor Link)

**Feature:** Path 3 link-based editor invite — project owner can share an **editor link**; anyone with the link (when logged in) can open that project in the studio, view all thumbnails, add their own (create or move), and delete only thumbnails they added.

**Last updated:** 2025-02-05

---

## Prerequisites

- **Two test accounts** (or one account + incognito/second browser) to act as **Owner** and **Editor**.
- App running locally (e.g. `npm run dev`); both users can sign in.
- **For Editor link only:** Run migration `007_projects_editor_slug.sql` (Supabase SQL Editor or `supabase db push`) so the `projects.editor_slug` column exists. Without it, the Projects tab and project PATCH (name/share) still work; only the Editor link section in Share will fail.

---

## Part A: Without migration 007 (core projects)

Use this to confirm the projects tab and project updates work even when the `editor_slug` column does not exist yet.

| Step | Action | Expected result |
|------|--------|-----------------|
| A.1 | Sign in and open **Studio**. | Studio loads. |
| A.2 | Go to **Projects** view (sidebar). | Projects list loads without 500; you see your projects or an empty list. |
| A.3 | Create a new project (e.g. "Test Project"). | Project is created and appears in the list and in the project switcher. |
| A.4 | Open **Share** for that project. | Share Project Dialog opens. |
| A.5 | Enable **Share project gallery** and set mode (All thumbnails / Only favorites). | Toggle and mode save successfully; no 500. Share link section appears. |
| A.6 | Change the project **name** (e.g. via project settings or edit) and save. | PATCH succeeds; project name updates. |
| A.7 | (Optional) Copy the **view** link and open it in an incognito window. | Read-only gallery at `/p/<slug>` loads. |

If any step returns **500** or "column projects.editor_slug does not exist", the app is still using the full project fields somewhere; see Troubleshooting. Once Part A passes, you can run migration 007 and test Part B.

---

## Part B: With migration 007 (Editor link)

Run `007_projects_editor_slug.sql` first. Then follow the steps below.

---

### 1. Owner: Create project and add thumbnails

| Step | Action | Expected result |
|------|--------|-----------------|
| 1.1 | Sign in as **Owner**. | Dashboard/Studio loads. |
| 1.2 | Go to **Studio** or **Projects** view. | Projects list and project switcher visible. |
| 1.3 | Create a new project (e.g. "Q1 Thumbnails") and select it in the project switcher. | Project appears in switcher; label shows project name. |
| 1.4 | Generate at least one thumbnail (Manual or Chat) with this project selected. | Thumbnail appears in gallery and is in this project. |
| 1.5 | Optionally add a second thumbnail. | You have 1–2 thumbnails owned by you in the project. |

---

### 2. Owner: Create and share editor link

| Step | Action | Expected result |
|------|--------|-----------------|
| 2.1 | Go to **Projects** view. | List of your projects. |
| 2.2 | Open **Share** for the project (Share icon on the project card). | Share Project Dialog opens. |
| 2.3 | Scroll to the **Editor link** section. | Section shows "Create editor link" (or existing link if already created). |
| 2.4 | Click **Create editor link**. | Button shows "Creating…"; editor link URL appears and is copied to clipboard. |
| 2.5 | Copy the editor link if needed (Copy button). | URL like `https://<origin>/studio?editor=<slug>`. |
| 2.6 | Close the Share dialog. | Dialog closes; project list unchanged. |

**Note:** The **view link** (`/p/<slug>`) is for read-only gallery sharing. The **editor link** (`/studio?editor=<slug>`) lets others open the project in the studio and add/delete their own thumbnails.

---

### 3. Editor: Open link and view project

If the Editor is not signed in when they open the editor link, they are redirected to sign in and then brought back to the studio with the shared project loaded (the editor link and its query are preserved through the auth redirect).

| Step | Action | Expected result |
|------|--------|-----------------|
| 3.1 | In another browser or incognito window, open the **editor link**. | App loads; sign-in required if not authenticated. |
| 3.2 | Sign in as **Editor** (second account). | Studio loads. |
| 3.3 | Check the project switcher. | Shows **"Shared: &lt;Project Name&gt;"** (or "Shared project" until name loads). |
| 3.4 | Confirm the gallery shows **all** thumbnails in the project (Owner’s + any from Editor). | Owner’s thumbnails visible in the grid. |
| 3.5 | Open the project switcher dropdown. | The **shared project appears in the dropdown** (e.g. "Shared: &lt;Project Name&gt;" or the project name). "All thumbnails", Editor’s own projects, and the shared project are all listed. |
| 3.6 | Go to **Projects** view (sidebar). | The shared project appears in the list with a **"Shared"** badge. It has a **Use** button only (no Share, no Delete). Access lasts until the owner revokes the editor link. |
| 3.7 | *(Optional)* Note on loading. | You may briefly see **"Shared project"** in the switcher or in the "Move to project" dropdown before the actual project name loads. |


---

### 4. Editor: Add thumbnails to the project

| Step | Action | Expected result |
|------|--------|-----------------|
| 4.1 | With "Shared: …" selected, use **Generate** (Manual or Chat) to create a new thumbnail. | New thumbnail appears; it belongs to the Editor and is in the shared project. |
| 4.2 | Confirm the new thumbnail is still in the shared project. | Thumbnail is part of the shared project. |
| 4.3 | Switch to **"All thumbnails"** (or another of your projects). On a thumbnail you **own**, open the **"Move to project"** (or **"Add to project"**) dropdown (folder-plus icon on the card). | The **shared project appears in the dropdown** when you are in editor mode (e.g. "Q1 Thumbnails" or "Shared: …"). |
| 4.4 | Select the **shared project** from the dropdown. | Thumbnail moves into the shared project. |
| 4.5 | Switch back to **"Shared: &lt;Project Name&gt;"** in the project switcher. | The moved thumbnail appears in the shared project gallery. |

---

### 5. Editor: Delete only own thumbnails

| Step | Action | Expected result |
|------|--------|-----------------|
| 5.1 | On a thumbnail **owned by the Owner**, open the action menu (or hover). | **Delete** is not available. |
| 5.2 | On a thumbnail **owned by the Editor**, open the action menu. | **Delete** is available. |
| 5.3 | Delete one of Editor’s thumbnails and confirm. | Thumbnail is removed. |
| 5.4 | Confirm Owner’s thumbnails remain and still have no delete option for Editor. | Editor cannot delete Owner’s thumbnails. |

---

### 6. Owner: Verify editor’s thumbnails and revoke link

| Step | Action | Expected result |
|------|--------|-----------------|
| 6.1 | As **Owner**, select the same project in the switcher (your project). | You see all project thumbnails (yours and Editor’s). |
| 6.2 | Open **Share** for this project. | Share dialog opens. |
| 6.3 | In **Editor link**, click **Revoke** (trash icon). | Editor link is revoked; only "Create editor link" is shown. |
| 6.4 | As **Editor**, refresh the page or open the same editor link again. | A toast may show "Editor link not found or revoked." The shared project **disappears from the Projects tab** and from the **project switcher dropdown**. If the Editor had that project selected, the app may clear it automatically when the next thumbnails request returns 403/404 (access denied). |

---

### 7. Owner: Rotate editor link (optional)

| Step | Action | Expected result |
|------|--------|-----------------|
| 7.1 | As Owner, create a new **editor link** for the project. | New link is generated and copied. |
| 7.2 | Click **Rotate** (refresh icon) in the Editor link section. | New slug/link is generated; previous link stops working. |
| 7.3 | As Editor, try the **old** editor link. | No longer works. |
| 7.4 | As Editor, open the **new** editor link. | Editor can access the project again. |

---

### 8. Edge cases and regression

| Step | Action | Expected result |
|------|--------|-----------------|
| 8.1 | **Owner** creates an editor link, then **deletes** the project. | Project is deleted; editor link for that project no longer resolves. |
| 8.2 | **Editor** switches to "All thumbnails" or another project, then back to the shared project (same session). | Shared project loads again; all project thumbnails visible. |
| 8.2b | **Owner** revokes the editor link while **Editor** has the shared project open. | On the next thumbnails request (e.g. refetch or navigation), the app receives 403; the shared project is removed from session and disappears from the Projects tab and switcher dropdown without a full page refresh. |
| 8.3 | **Editor** opens the editor link in a new tab while already signed in. | Project resolves; "Shared: …" and thumbnails load without extra sign-in. |
| 8.4 | Owner shares the **view** link (`/p/<share_slug>`). A viewer opens it. | View-only gallery; no edit/delete/add. Editor link remains separate. |

---

### 9. API / network checks (optional)

In the browser Network tab:

- **GET /api/projects** — 200; list of projects (no 500).
- **GET /api/projects/by-editor-slug?slug=…** — called when loading Studio with `?editor=`; 200 with `projectId` and `projectName` when slug is valid.
- **GET /api/thumbnails?projectId=…&editorSlug=…** — when viewing shared project as editor; 200 with all project thumbnails.
- **POST /api/projects/<id>/editor-link** — create/rotate/revoke; 200 for owner.
- **PATCH /api/projects/<id>** — 200 for name/share updates (no 500 from missing `editor_slug` when migration not applied, if using PROJECT_FIELDS_LIST).

---

## Quick reference: Owner vs Editor

| Capability | Owner | Editor (with link) |
|------------|--------|---------------------|
| View all project thumbnails | Yes | Yes |
| Add thumbnails (generate / move own into project) | Yes | Yes |
| Delete thumbnail | Only own | Only own |
| Create / rotate / revoke editor link | Yes | No |
| Delete project | Yes | No (project not in their list) |
| Project in switcher | As owned project | As "Shared: &lt;name&gt;" |
| Shared project in "Move to project" dropdown | N/A (owns project) | Yes (when in editor mode) |

---

## Troubleshooting

- **GET /api/projects 500 or "column editor_slug does not exist"** — List/create/PATCH use a field set that omits `editor_slug` so they work without migration 007. If you still see 500 on GET /api/projects, ensure `listProjects` uses `PROJECT_FIELDS_LIST` (no `editor_slug`). Run migration 007 to add the column for full functionality.
- **PATCH /api/projects/[id] 500 "column editor_slug does not exist"** — `updateProject` should use `PROJECT_FIELDS_LIST` for the select after update so name/share updates work without the migration. If it still fails, check that `updateProject` selects `PROJECT_FIELDS_LIST`. Creating or revoking the **editor link** (which updates `editor_slug`) will still 500 until migration 007 is applied.
- **"Editor link not found"** — Slug was revoked or rotated; use the latest link from the Owner.
- **Editor sees no thumbnails** — Confirm switcher shows "Shared: …" and the project has thumbnails; check GET thumbnails with `projectId` and `editorSlug` for 403/404.
- **Editor can delete Owner’s thumbnails** — Bug: delete should only show when `thumbnail.user_id === currentUser.id`; check ThumbnailCard `isOwner` and delete API auth.
- **Editor link section in Share dialog** — Visible whenever the Share dialog is used. "Create editor link" and related actions work only after migration 007 is applied.
- **Shared project not in switcher or Projects tab** — Ensure you opened the studio via the editor link (URL has `?editor=<slug>`). The shared project appears in the project switcher dropdown and in the Projects tab (with "Shared" badge) when the editor link has been resolved in this session.
- **Shared project not in "Move to project" dropdown** — Same as above; the shared project appears in the thumbnail card's "Move to project" / "Add to project" dropdown when it is in the session (resolved via editor link).
- **"Shared project" before real name** — You may briefly see "Shared project" in the switcher or in the Move to project dropdown before the actual project name loads (async resolution of the editor slug).
