# Instrumentation Log (Prompt 02B)

## Routes instrumented

- `home` (`app/page.tsx`)
- `auth` (`app/auth/page.tsx`)
- `onboarding` (`app/onboarding/page.tsx`)
- `studio.create` + `studio.results` (`app/studio/page.tsx`, `components/studio/*`)
- `studio.browse`, `studio.gallery`, `studio.projects`, `studio.styles`, `studio.palettes`, `studio.faces` (`components/studio/views/*`)
- `share.project` (`app/p/[slug]/page.tsx`)
- `share.editor` (`app/e/[slug]/page.tsx`)

## Anchors added

- Home: `tour.home.nav.cta.openStudio`, `tour.home.hero.cta.startCreating`, `tour.home.footer.link.openStudio`
- Auth: `tour.auth.form.tab.signin`, `tour.auth.form.tab.signup`, `tour.auth.form.input.email`, `tour.auth.form.input.password`, `tour.auth.form.btn.submit`, `tour.auth.form.btn.google`, `tour.auth.form.link.forgotPassword`
- Onboarding: `tour.onboarding.welcome.btn.getStarted`, `tour.onboarding.welcome.btn.skipToStudio`, `tour.onboarding.step.progress.container.main`
- Studio create/results: `tour.studio.nav.sidebar.btn.*` (create/browse/gallery/projects/styles/palettes/faces), `tour.studio.create.form.input.thumbnailTitle`, `tour.studio.create.form.text.customInstructions`, `tour.studio.create.form.btn.aspectRatio.16_9`, `tour.studio.create.form.btn.resolution.1k`, `tour.studio.create.form.btn.variations.1`, `tour.studio.create.form.btn.generate`, `tour.studio.results.results.container.main`, `tour.studio.results.results.btn.refresh`, `tour.studio.results.results.select.sort`, `tour.studio.results.results.grid.thumbnailGrid`, `tour.studio.results.results.btn.loadMore`
- Studio views: `tour.studio.browse.grid.container.main`, `tour.studio.gallery.grid.container.main`, `tour.studio.projects.grid.container.main`, `tour.studio.styles.grid.container.main`, `tour.studio.palettes.grid.container.main`, `tour.studio.faces.grid.container.main`
- Shared routes: `tour.share.project.grid.container.main`, `tour.share.project.modal.modal.thumbnail`, `tour.share.editor.state.container.loading`, `tour.share.editor.state.container.error`, `tour.share.editor.state.btn.goStudio`

## Events wired

- `tour.event.route.ready` for all instrumented routes/views above
- `tour.event.auth.success` and `tour.event.auth.failed` in auth handlers
- `tour.event.studio.view.changed` in Studio `setView`
- `tour.event.studio.generate.started`, `tour.event.studio.generate.complete`, `tour.event.studio.generate.failed` in generation flow
- `tour.event.modal.opened` and `tour.event.modal.closed` in thumbnail edit + face editor modals

## Notes / special handling

- Studio sub-routes are SPA view states on `/studio`; route readiness is emitted both from `app/studio/page.tsx` (generator/results baseline) and specific view components (browse/gallery/projects/styles/palettes/faces).
- For share-project modal anchor, `ImageModal` is wrapped with a container anchor because the modal component itself is abstracted.
- No planned anchors were intentionally skipped.
