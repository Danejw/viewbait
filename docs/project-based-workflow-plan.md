# Project-based workflow migration

**Overview:** Add an optional project-based workflow: users can create projects, assign thumbnails to projects, switch between projects via an in-app switcher, and save/load generator settings per project—while leaving existing thumbnails and the current "generate without project" flow unchanged.

---

## Current state (unchanged behavior)

- **Entry**: Landing → `/studio` (single route).
- **Thumbnails**: Stored in `thumbnails` with `user_id`, title, style, palette, emotion, aspect_ratio, resolution, etc. No project concept.
- **Listing**: `GET /api/thumbnails` returns all user thumbnails; `buildThumbnailsQuery` (lib/server/data/thumbnails.ts) filters by `user_id` only.
- **Generation**: `POST /api/generate` creates rows with `user_id`; no `project_id`.
- **Settings**: All in StudioProvider (thumbnailText, style, palette, aspect ratio, resolution, variations, faces). Not persisted per context.

**Backward compatibility:** Existing thumbnails stay as-is. New schema will use **nullable** `project_id`; `null` means "no project" and they continue to appear in "All thumbnails."

---

## Target state

1. **Projects**: User can create/rename/delete projects (e.g. "Q1 video", "Tutorial series"). Stored in a new `projects` table.
2. **Thumbnails per project**: New generations can optionally be tied to the currently selected project. Gallery can show "All" or a single project.
3. **Project defaults**: Each project stores default generator settings in a **single JSONB column** (all manual settings: style, palette, aspect ratio, resolution, custom input, faces, etc.). When user switches project, generator form pre-fills from that project’s defaults; user can "Save current settings to project."
4. **In-app only**: No URL change. Project selection lives in a switcher (sidebar or header); `/studio` stays the only route.

---

## Data model

### New table: `projects`

| Column | Type | Notes |
|--------|------|--------|
| id | uuid | PK, default gen_random_uuid() |
| user_id | uuid | FK to auth.users, NOT NULL |
| name | text | NOT NULL |
| created_at | timestamptz | NOT NULL |
| updated_at | timestamptz | NOT NULL |
| **default_settings** | **jsonb** | nullable; **single column** for all manual generator settings (see shape below) |

RLS: user can only read/insert/update/delete their own rows (`user_id = auth.uid()`).

**`default_settings` JSONB shape** (flexible; new keys can be added without schema changes):

Store the full manual-settings snapshot so we can pre-fill the generator when switching projects. Align with StudioState (studio-provider.tsx) / GenerationRequest (useThumbnailGeneration.ts). All fields optional so partial saves are fine.

```ts
interface ProjectDefaultSettings {
  // Text
  thumbnailText?: string;
  customInstructions?: string;
  // Style / palette
  includeStyles?: boolean;
  selectedStyle?: string | null;   // style id or name
  includePalettes?: boolean;
  selectedPalette?: string | null; // palette id
  // Layout / output
  selectedAspectRatio?: string;    // e.g. '16:9'
  selectedResolution?: string;     // e.g. '1K'
  variations?: number;
  // Style references
  includeStyleReferences?: boolean;
  styleReferences?: string[];      // URLs
  // Faces
  includeFaces?: boolean;
  selectedFaces?: string[];         // face ids
  faceExpression?: string;         // e.g. 'None' or expression key
  facePose?: string;               // e.g. 'None' or pose key
  // Future: add new keys here without DB migration
}
```

- **Save**: "Save current settings to project" serializes the current generator state into this shape and PATCHes `default_settings`.
- **Load**: When `activeProjectId` changes, read `project.default_settings` and apply each key to StudioProvider (setThumbnailText, setSelectedStyle, etc.); omit or ignore keys that don’t exist in the current form.

### Thumbnails change

- Add **nullable** `project_id` (uuid, FK to `projects(id)`).
- No backfill: existing rows keep `project_id = null`.
- RLS: existing thumbnail policies stay; ensure they still allow read/write by owner (and that joining to `projects` does not block when `project_id` is null).

### Storage path (optional)

- Current path: `{user_id}/{thumbnail_id}/thumbnail.{ext}`. No change required; project is metadata only. Optionally later: `{user_id}/{project_id}/{thumbnail_id}/...` for organization—out of scope.

---

## API changes

### New: Projects CRUD

- **GET /api/projects** – List projects for the authenticated user (id, name, created_at, updated_at, **default_settings**). Order by updated_at or name.
- **POST /api/projects** – Create project (body: `name`, optional **`default_settings`** JSONB object).
- **PATCH /api/projects/[id]** – Update name and/or **`default_settings`**. Body can include `name` and/or `default_settings` (full replace recommended). Ensure `project.user_id === auth.uid()`.
- **DELETE /api/projects/[id]** – If hard-delete: set thumbnails’ `project_id` to null for that project, then delete project.

### Thumbnails API

- **GET /api/thumbnails** – Add optional query `projectId` (uuid). If present, filter `thumbnails.project_id = projectId`. If absent, keep current behavior (all user thumbnails).
- **POST /api/generate** – Add optional `project_id` in body. If provided and valid (project exists and belongs to user), set `baseThumbnailData.project_id = body.project_id` when creating thumbnail rows.

### Types and server data

- **lib/types/database.ts**: Add `DbProject`, `ProjectInsert`, `ProjectUpdate` with **`default_settings`** as a single JSONB type (e.g. `ProjectDefaultSettings` or `Json`); add `project_id?: string | null` to `DbThumbnail` and `ThumbnailInsert`. Export **`ProjectDefaultSettings`** for use when saving/loading project defaults.
- **lib/server/data/thumbnails.ts**: Extend `BuildThumbnailsQueryOptions` with `projectId?: string | null`; in `buildThumbnailsQuery`, add `.eq('project_id', projectId)` when `projectId` is provided. Same for `fetchThumbnails`.
- New: **lib/server/data/projects.ts** (or inline in API) for project CRUD used by route handlers.

---

## Frontend

### 1. Project switcher (in-app only)

- **Placement**: Top of StudioSidebar (or header) so it’s always visible.
- **UI**: Dropdown or compact list: first option "All thumbnails" (no project), then list of projects (name + maybe thumbnail count). Selecting one sets "current project" in state; gallery and generator use it.
- **State**: In StudioProvider add `activeProjectId: string | null` (null = "All") and `setActiveProjectId(id: string | null)`. Persist `activeProjectId` in localStorage so refresh keeps selection.

### 2. Projects data and mutations

- New service: **lib/services/projects.ts** – `getProjects()`, `createProject(payload)`, `updateProject(id, payload)`, `deleteProject(id)` calling the new API routes.
- New hooks: e.g. `useProjects()` (list) + mutations. Query keys: `projects` list, `project` detail by id.

### 3. Thumbnails list scoped to project

- **useThumbnails**: Add optional `projectId: string | null` to options. When set, pass to `getThumbnails` and include in query key so "All" vs project are cached separately.
- **lib/services/thumbnails.ts**: `getThumbnails(userId, { ..., projectId })` – append `projectId` to GET /api/thumbnails when present.
- StudioProvider: Pass `state.activeProjectId` into useThumbnails so gallery shows either all thumbnails or only the selected project.

### 4. Generator: project defaults (save / load)

- **Load**: When `activeProjectId` changes, if the selected project has **`default_settings`** (non-null object), apply each key to generator state: setThumbnailText, setCustomInstructions, setSelectedStyle, setSelectedPalette, setSelectedAspectRatio, setSelectedResolution, setVariations, setStyleReferences, setIncludeFaces, setSelectedFaces, setFaceExpression, setFacePose, etc. Only apply keys that exist in `default_settings`; ignore unknown keys for forward compatibility. If project has no default_settings, leave form as-is.
- **Save**: Add "Save current settings to project" (enabled only when a project is selected). On click: build a **`ProjectDefaultSettings`** object from current StudioProvider state (thumbnailText, customInstructions, includeStyles, selectedStyle, includePalettes, selectedPalette, selectedAspectRatio, selectedResolution, variations, includeStyleReferences, styleReferences, includeFaces, selectedFaces, faceExpression, facePose) and PATCH /api/projects/[id] with **`{ default_settings: thatObject }`**.
- **Generate**: When calling generateThumbnail, include `project_id: activeProjectId` when `activeProjectId` is not null so new thumbnails are associated with the current project.

### 5. Create / manage projects

- "New project" in the switcher opens a minimal modal or inline form: name only (defaults can be set after creation via "Save current settings to project").
- Edit/delete: From switcher dropdown (e.g. kebab menu per project). Delete: call DELETE /api/projects/[id]; then set `activeProjectId` to null if the deleted project was selected.

### 6. Gallery label and empty state

- When a project is selected, gallery header can show e.g. "My Thumbnails – [Project name]". When "All", keep "My Thumbnails" or "All thumbnails."
- Empty state when project has no thumbnails: short message and CTA to generate (and optionally "Save current settings to project" if they haven’t).

---

## Migration and compatibility

- **DB**: New migration: create **`projects`** table with **`default_settings` JSONB only** (no per-setting columns); add **`project_id`** to `thumbnails` (nullable, FK to projects). No data migration for existing thumbnails.
- **Existing users**: No project selected = "All thumbnails"; behavior matches current app. They can create projects and start using them without any one-time backfill.
- **Generate without project**: If user has "All" selected, do not send `project_id`; API behaves as today (thumbnail rows with `project_id` null).

---

## Implementation order (suggested)

1. **DB + types**: Migration for `projects` (with `default_settings` jsonb) and `thumbnails.project_id`; update lib/types/database.ts and supabase/tables (add projects.json if you keep table descriptors).
2. **API**: Implement GET/POST /api/projects, PATCH/DELETE /api/projects/[id]; then extend GET /api/thumbnails and POST /api/generate with projectId/project_id.
3. **Server data**: buildThumbnailsQuery and fetchThumbnails with projectId; project CRUD in server data or inside route handlers.
4. **Services + hooks**: lib/services/projects.ts, useProjects (and mutations), extend thumbnails service and useThumbnails with projectId.
5. **Studio state + UI**: Add activeProjectId and persistence; project switcher; wire useThumbnails to activeProjectId; load project defaults from **default_settings** on switch; "Save current settings to project" (serialize to **default_settings**); pass project_id on generate; create/delete project UI.

---

## Optional (later)

- **Project thumbnail count**: GET /api/projects can include thumbnail count per project for display in the switcher.
- **Move thumbnails**: "Move to project" from thumbnail card or gallery (PATCH thumbnail to set `project_id`).
- **Default project**: Option to auto-select last-used project on load (you already persist `activeProjectId`).

---

This keeps the old flow intact (no project = same as today), adds optional project-based organization and per-project default settings via a **single JSONB column**, and keeps routing simple with in-app-only project selection.
