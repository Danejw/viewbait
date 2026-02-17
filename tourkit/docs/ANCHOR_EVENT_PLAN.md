# TourKit Anchor + Event Plan

## Naming rules

### Anchor rule
- Attribute: `data-tour="..."`
- Prefix: every anchor starts with `tour.`
- Grammar:

```text
tour.<route>.<area>.<type>.<name>[.<variant>]
```

### Allowed `<type>` values
`cta`, `btn`, `input`, `select`, `tab`, `card`, `grid`, `item`, `modal`, `chip`, `toggle`, `text`, `link`, `label`, `container`, `image`, `badge`, `progress`

### Event rule
- Every event starts with `tour.event.`
- Grammar:

```text
tour.event.<domain>.<name>
```

## Multi-tour plan (discovery)

1. **first-thumbnail** — First-time user path from landing/auth into Studio and generating thumbnails once.
   - Routes: `home -> auth -> studio.create -> studio.results`
2. **custom-instructions** — Demonstrate how custom instructions change generation.
   - Routes: `auth -> studio.create -> studio.results`
3. **aspect-resolution-variations** — Demonstrate aspect ratio, resolution, and variation controls in the generator.
   - Routes: `auth -> studio.create -> studio.results`
4. **studio-navigation** — Switch between core Studio views from sidebar (Create, Browse, Gallery, Projects, Styles, Palettes, Faces).
   - Routes: `auth -> studio.create -> studio.browse -> studio.gallery -> studio.projects -> studio.styles -> studio.palettes -> studio.faces`
5. **onboarding-first-run** — Dedicated onboarding flow from welcome to first successful generation.
   - Routes: `onboarding -> studio.results`
6. **shared-project-view** — Open shared project gallery and inspect results.
   - Routes: `share.project`
7. **editor-link-to-studio** — Join project through editor link and land in Studio.
   - Routes: `share.editor -> studio.create`

## Shared flow fragments

- **login** (`home/auth -> authenticated studio access`) is shared by tours:
  - `first-thumbnail`
  - `custom-instructions`
  - `aspect-resolution-variations`
  - `studio-navigation`

- **open-create-view** (`studio` with Create view active) is a potential future fragment for all creation-focused tours.

## Per-route anchor tables

## Route: home (path: /)

| Anchor | Element | Notes |
|---|---|---|
| tour.home.nav.cta.openStudio | Header “Open Studio” CTA | Routes to `/auth` or `/studio` depending on auth state |
| tour.home.hero.cta.startCreating | Hero “Start Creating” CTA | Main conversion entry to auth/studio |
| tour.home.footer.link.openStudio | Footer “Open Studio” CTA | Backup navigation anchor |

Implementation location: `app/page.tsx` near `studioOrAuthHref` links in nav/hero/footer sections.

## Route: auth (path: /auth)

| Anchor | Element | Notes |
|---|---|---|
| tour.auth.form.tab.signin | Sign in tab trigger | Switches tab state |
| tour.auth.form.tab.signup | Sign up tab trigger | Switches tab state |
| tour.auth.form.input.email | Sign-in email input | Used by login fragment |
| tour.auth.form.input.password | Sign-in password input | Used by login fragment |
| tour.auth.form.btn.submit | Sign-in submit button | Used by login fragment |
| tour.auth.form.btn.google | Continue with Google button | Optional auth path |
| tour.auth.form.link.forgotPassword | Forgot password trigger | Password recovery flow |

Implementation location: `app/auth/page.tsx` in `AuthForm` tab/form markup.

## Route: onboarding (path: /onboarding)

| Anchor | Element | Notes |
|---|---|---|
| tour.onboarding.welcome.btn.getStarted | Welcome “Get started” button | Begins onboarding steps |
| tour.onboarding.welcome.btn.skipToStudio | “Skip to Studio” button | Optional bypass path |
| tour.onboarding.step.progress.container.main | Step progress container | Assert onboarding stage visible |

Implementation location: `app/onboarding/page.tsx` in welcome shell and step container markup.

## Route: studio.create (path: /studio)

| Anchor | Element | Notes |
|---|---|---|
| tour.studio.nav.sidebar.btn.create | Sidebar “Create” button | Forces generator view |
| tour.studio.nav.sidebar.btn.browse | Sidebar “Browse” button | For navigation tour |
| tour.studio.create.form.input.thumbnailTitle | Thumbnail title input | Required before generation |
| tour.studio.create.form.text.customInstructions | Custom instructions textarea | Used in custom-instructions tour |
| tour.studio.create.form.btn.aspectRatio.16_9 | Aspect ratio 16:9 button | Representative ratio choice |
| tour.studio.create.form.btn.resolution.1k | Resolution 1K button | Baseline resolution choice |
| tour.studio.create.form.btn.variations.1 | Variations = 1 button | Baseline variation choice |
| tour.studio.create.form.btn.generate | “CREATE THUMBNAILS” button | Starts generation |

Implementation location:
- `components/studio/studio-sidebar.tsx` (sidebar buttons)
- `components/studio/studio-generator.tsx` (`StudioGeneratorThumbnailText`, `StudioGeneratorCustomInstructions`, aspect/resolution/variation controls, submit button)

## Route: studio.results (path: /studio)

| Anchor | Element | Notes |
|---|---|---|
| tour.studio.results.results.container.main | Results panel root | Assert results view visible |
| tour.studio.results.results.btn.refresh | Refresh button | Manual refresh |
| tour.studio.results.results.select.sort | Sort select trigger | Sorting behavior |
| tour.studio.results.results.grid.thumbnailGrid | Thumbnail grid container | Assert generation output exists |
| tour.studio.results.results.item.thumbnail | First generated thumbnail card | Click to open generated thumbnail details/modal (requires prior generation) |
| tour.studio.results.results.btn.loadMore | Load more button | Pagination (conditional) |

Implementation location: `components/studio/studio-results.tsx` and `components/studio/thumbnail-grid.tsx` / `components/studio/load-more-button.tsx`.

## Route: studio.browse (path: /studio?view=browse)

| Anchor | Element | Notes |
|---|---|---|
| tour.studio.nav.sidebar.btn.browse | Sidebar “Browse” button | Changes Studio sub-view |
| tour.studio.browse.grid.container.main | Browse grid container | Verify browse content loaded |

Implementation location: `components/studio/studio-sidebar.tsx`, `components/studio/views/StudioViewBrowse.tsx`.

## Route: studio.gallery (path: /studio?view=gallery)

| Anchor | Element | Notes |
|---|---|---|
| tour.studio.nav.sidebar.btn.gallery | Sidebar “Gallery” button | Changes Studio sub-view |
| tour.studio.gallery.grid.container.main | Gallery grid container | Verify gallery content loaded |

Implementation location: `components/studio/studio-sidebar.tsx`, `components/studio/views/StudioViewGallery.tsx`.

## Route: studio.projects (path: /studio?view=projects)

| Anchor | Element | Notes |
|---|---|---|
| tour.studio.nav.sidebar.btn.projects | Sidebar “Projects” button | Changes Studio sub-view |
| tour.studio.projects.grid.container.main | Projects list/grid | Verify project cards visible |

Implementation location: `components/studio/studio-sidebar.tsx`, `components/studio/views/StudioViewProjects.tsx`.

## Route: studio.styles (path: /studio?view=styles)

| Anchor | Element | Notes |
|---|---|---|
| tour.studio.nav.sidebar.btn.styles | Sidebar “Styles” button | Changes Studio sub-view |
| tour.studio.styles.grid.container.main | Style cards grid | Verify style library loaded |

Implementation location: `components/studio/studio-sidebar.tsx`, `components/studio/views/StudioViewStyles.tsx`.

## Route: studio.palettes (path: /studio?view=palettes)

| Anchor | Element | Notes |
|---|---|---|
| tour.studio.nav.sidebar.btn.palettes | Sidebar “Palettes” button | Changes Studio sub-view |
| tour.studio.palettes.grid.container.main | Palette cards grid | Verify palette library loaded |

Implementation location: `components/studio/studio-sidebar.tsx`, `components/studio/views/StudioViewPalettes.tsx`.

## Route: studio.faces (path: /studio?view=faces)

| Anchor | Element | Notes |
|---|---|---|
| tour.studio.nav.sidebar.btn.faces | Sidebar “Faces” button | Changes Studio sub-view |
| tour.studio.faces.grid.container.main | Faces grid | Verify face library loaded |

Implementation location: `components/studio/studio-sidebar.tsx`, `components/studio/views/StudioViewFaces.tsx`.

## Route: share.project (path: /p/[slug])

| Anchor | Element | Notes |
|---|---|---|
| tour.share.project.grid.container.main | Shared gallery masonry grid | Public/project-share tour assertions |
| tour.share.project.modal.modal.thumbnail | Shared thumbnail modal root | Used when opening a shared thumbnail |

Implementation location: `app/p/[slug]/page.tsx` and shared gallery card/modal components.

## Route: share.editor (path: /e/[slug])

| Anchor | Element | Notes |
|---|---|---|
| tour.share.editor.state.container.loading | Loading state wrapper | Joining via editor slug |
| tour.share.editor.state.container.error | Error state wrapper | Invalid/expired link handling |
| tour.share.editor.state.btn.goStudio | Error state “Go to Studio” button | Recovery path |

Implementation location: `app/e/[slug]/page.tsx`.

## Per-event table

| Event | When to emit | Payload | Implementation location |
|---|---|---|---|
| tour.event.route.ready | Route key anchors are attached and page is interactive | `{ routeKey, anchorsPresent }` | Client pages/views: `app/page.tsx`, `app/auth/page.tsx`, `app/onboarding/page.tsx`, `app/studio/page.tsx`, `app/p/[slug]/page.tsx`, `app/e/[slug]/page.tsx` |
| tour.event.auth.success | Email/password or OAuth login succeeds before redirect to studio | `{ method, userId }` | `app/auth/page.tsx` handlers and/or `lib/hooks/useAuth.tsx` after successful sign-in |
| tour.event.auth.failed | Sign-in attempt fails and error is shown | `{ method, message }` | `app/auth/page.tsx` (`handleSignIn`, `handleGoogleSignIn`) |
| tour.event.studio.view.changed | Studio sidebar/view selection changes | `{ view }` | `components/studio/studio-provider.tsx` `setView` action |
| tour.event.studio.generate.started | User clicks generate and request is dispatched | `{ projectId, variations, resolution, aspectRatio }` | `components/studio/studio-provider.tsx` in `generateThumbnails` before API call |
| tour.event.studio.generate.complete | Generation completes with at least one success | `{ successCount }` | `components/studio/studio-provider.tsx` after `generate_completed` tracking path |
| tour.event.studio.generate.failed | Generation fails fully or partially | `{ reason }` | `components/studio/studio-provider.tsx` after `generate_failed` tracking path |
| tour.event.modal.opened | Modal/dialog becomes open | `{ modalKey }` | Dialog components (e.g. `components/studio/thumbnail-edit-modal.tsx`, `components/studio/face-editor.tsx`) |
| tour.event.modal.closed | Modal/dialog closes | `{ modalKey }` | Same modal components on close callbacks |

## Implementation notes

- `studio.create` and `studio.results` currently share path `/studio`; disambiguation should use route keys based on active Studio view state (`currentView`) rather than URL path alone.
- Several Studio views are lazy-loaded (`components/studio/studio-views.tsx`), so `tour.event.route.ready` should fire from each view component once its own key anchors are mounted.
- For auth, avoid emitting events in server callback route handlers for browser waits; emit from client code (`auth` page or auth hook) where Playwright listens.
- Shared/public routes (`/p/[slug]`, `/e/[slug]`) should include route-ready events for loading and error states because rendering is stateful and conditional.
