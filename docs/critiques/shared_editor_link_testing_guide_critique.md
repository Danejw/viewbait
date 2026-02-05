# Critique: Shared Editor Link + Testing Guide Plan

Senior-engineer review of the implementation plan **Shared project editor link – dropdown and testing guide** (plan file: `shared_editor_link_+_testing_guide_946d229a.plan.md`), evaluated against the ViewBait codebase and architecture.

---

## High-level overview (plain language)

The strategy is **sound and well scoped**. It fixes a real gap: editors who open a project via the editor link can generate thumbnails into that project but cannot **move** existing thumbnails into it, because the "Move to project" dropdown only lists owned projects. The plan correctly limits the fix to a **dropdown-only** combined list (owned + current shared project) and leaves the project **switcher** and gallery filter unchanged, which avoids scope creep and keeps UX consistent.

**Main strengths:** Clear separation of `projects` (owned, for switcher and rest of app) vs `projectsForDropdown` (owned + shared by editor link, for thumbnail card only); reuse of existing `editorSlugByProjectId` and `getProjectByEditorSlug`; no change to ThumbnailCard once the provider exposes the right list; and explicit edge cases (no duplicate when owner views own project, support for multiple editor links in session). The testing guide rewrite ensures step 4.3 ("Move to project → select the shared project") is actually verifiable and aligns the doc with current (and post-implementation) behavior.

**Risks and gaps:** The codebase currently has a **partial or broken** implementation: `StudioData` and `useThumbnailActions` already reference `projectsForDropdown`, and the editor-link effect calls `setSharedProjectNameByProjectId`, but the provider’s `data` useMemo does **not** include `projectsForDropdown`, and the `sharedProjectNameByProjectId` state declaration is missing. So either the plan was partially applied and left incomplete, or the state lives elsewhere; in any case, completing the plan as written (add state, compute `projectsForDropdown` in `data`, keep hook returning `data.projectsForDropdown`) is the right fix. The plan does not call out **loading/race** when the editor opens the link: `projectName` is set asynchronously after `getProjectByEditorSlug`; the fallback "Shared project" is correct, but the guide could mention that the label may briefly show "Shared project" before the real name. No security or API changes are required—editor slug is already passed for move-to-project via existing `onAddToProject` and `updateThumbnailProject(..., editorSlug)`.

**Verdict:** Proceed with the plan. Complete the provider implementation (state + `projectsForDropdown` in `data` useMemo) so it matches the interface and the hook; then update the testing guide as specified. After implementation, run through the guide once to confirm step 4.3 and revoke/rotate steps work end-to-end.

---

## Summary table

| Area | Verdict | Notes |
|------|--------|--------|
| **Overall strategy** | ✔ | Dropdown-only combined list; switcher unchanged; clear scope. |
| **Provider approach** | ✔ | `sharedProjectNameByProjectId` + `projectsForDropdown`; owned + shared (no duplicates); single source for dropdown. |
| **useThumbnailActions** | ✔ | Return `projects: data.projectsForDropdown` so card gets combined list; already specified in plan. |
| **ThumbnailCard** | ✔ | No change needed; uses `project.id` / `project.name` and `onAddToProject`; provider passes slug via existing logic. |
| **Edge cases** | ✔ | Owner viewing own project → no duplicate; multiple editor links → multiple entries in dropdown. |
| **Testing guide** | ✔ | Rewrite for clarity; step 4.3 verifiable; owner/editor/revoke/rotate covered. |
| **Out of scope** | ✔ | Switcher and gallery filter stay owned-only; no code changes there. |
| **Implementation state** | ❌ | Plan is correct but code is incomplete: `data` useMemo missing `projectsForDropdown`; `sharedProjectNameByProjectId` state likely missing despite setter in effect. |
| **Async project name** | ⚠ | Label may briefly show "Shared project" until `projectName` loads; plan’s fallback is correct; guide could note this. |
| **Security / API** | ✔ | No new APIs; `editorSlug` already used in move-to-project and thumbnails API. |

---

## Detailed critique

### ✔ Strengths

- **Problem definition:** Correctly identifies that the "Move to project" dropdown only shows `data.projects` (owned), so the shared project is missing and step 4.3 cannot be done. Fixing this only for the dropdown (not the switcher) is the right boundary.
- **Data shape:** Introducing `projectsForDropdown: Array<{ id: string; name: string }>` keeps the dropdown list minimal and typed; `projects` remains `DbProject[]` for switcher and defaults. Good separation of concerns.
- **Reuse:** Uses existing `editorSlugByProjectId`, `getProjectByEditorSlug` (which already returns `projectName`), and `onAddToProject` → `updateThumbnailProject(..., editorSlug)`. No new APIs or auth paths.
- **Edge cases:** Explicitly handles (1) shared project also in owned list → do not duplicate in `projectsForDropdown`; (2) multiple editor links in session → iterate `editorSlugByProjectId` and add each missing project with stored name. Matches real usage.
- **Testing guide:** Single doc in `docs/guides/`, prerequisites, Part A (without migration) / Part B (with migration), owner and editor flows, and explicit coverage of create/copy editor link, open link, "Shared: &lt;Name&gt;", generate and **move existing** thumbnail, delete only own, revoke/rotate. Step 4.3 becomes verifiable. Clear note that shared project is **not** in the switcher list, only in the thumbnail add/move dropdown.
- **Out of scope:** Explicitly leaves switcher and gallery filter as owned-only; avoids feature creep.
- **Sequence diagram:** Mermaid flow is accurate (Owner → ShareDialog → Editor → StudioProvider → ThumbnailCard → API).

### ❌ Implementation incomplete in codebase

The plan’s steps are correct, but the current code is inconsistent:

- **StudioData** declares `projectsForDropdown: Array<{ id: string; name: string }>` and **useThumbnailActions** returns `projects: data.projectsForDropdown`.
- The **data** useMemo in `studio-provider.tsx` does **not** set `projectsForDropdown`; it only sets `projects`, `projectsLoading`, etc. So `data.projectsForDropdown` is **undefined** at runtime, and the thumbnail card’s dropdown would receive undefined (or TypeScript may complain if strict).
- The editor-link **useEffect** calls `setSharedProjectNameByProjectId((prev) => ({ ...prev, [projectId]: projectName ?? "Shared project" }))`, but there is **no** `useState` for `sharedProjectNameByProjectId` in the provider (and no `dropdownList` / `projectsForDropdown` computation). So the setter is either undefined (broken) or the state was added elsewhere and the `data` useMemo was never updated.

**Recommendation:** Implement the plan fully in `studio-provider.tsx`: (1) Add `const [sharedProjectNameByProjectId, setSharedProjectNameByProjectId] = useState<Record<string, string>>({});` (2) In the same `data` useMemo, compute `projectsForDropdown`: owned projects mapped to `{ id, name }` plus, for each `projectId` in `editorSlugByProjectId` that is not in `projects`, append `{ id: projectId, name: sharedProjectNameByProjectId[projectId] ?? "Shared project" }`. (3) Include `projectsForDropdown` (and `sharedProjectNameByProjectId` in the dependency array) in the useMemo. That will align the implementation with the interface and make the dropdown work.

### ⚠ Async project name

When the editor opens the link, `getProjectByEditorSlug` is async. The provider sets `activeProjectId` and `editorSlugByProjectId` first, then `sharedProjectNameByProjectId`. So for a brief moment the shared project may appear in the dropdown (if `projectsForDropdown` is implemented) with name "Shared project" until `projectName` arrives. The plan’s fallback is correct; consider adding a one-line note in the testing guide: "You may briefly see 'Shared project' before the actual project name appears."

### ✔ ThumbnailCard and API

- ThumbnailCard already uses `project.id`, `project.name`, and `onAddToProject(id, project.id, projectId ?? null)`. No change needed once the hook provides `projectsForDropdown`.
- `onAddToProject` in the provider already uses `editorSlugByProjectId[newProjectId]` when calling `thumbnailsService.updateThumbnailProject(..., editorSlug)`. The API and RLS already support editor-slug access for moving thumbnails into the project. No backend changes required.

### ✔ Verification and docs

- Plan verification steps (owner create → share → editor open → generate → move existing → owner sees → revoke → link dead) are correct.
- Keeping prerequisites, API checks, troubleshooting, and quick-reference table in the guide is good. Removing or adjusting any step that said "shared project is not in the switcher dropdown" to clarify "not in **switcher**; **is** in thumbnail card Move to project dropdown" avoids confusion.

---

## Conclusion

The strategy is **effective and aligned** with the app: minimal surface area (dropdown only), reuse of editor-slug resolution and APIs, and a testing guide that makes the full flow (including move existing thumbnail) testable. The main follow-up is to **complete the provider implementation** (state + `projectsForDropdown` in `data`) so the existing interface and hook work at runtime; then ship the testing guide updates and run through the guide once to confirm.
