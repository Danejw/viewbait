# TourKit Validation Report

Generated from `tourkit/docs/ANCHOR_EVENT_PLAN.md` vs `tourkit/maps/tour.map.json`.

## Anchors

### home

**Planned and found**
- tour.home.footer.link.openStudio
- tour.home.hero.cta.startCreating
- tour.home.nav.cta.openStudio

### auth

**Planned and found**
- tour.auth.form.btn.google
- tour.auth.form.btn.submit
- tour.auth.form.input.email
- tour.auth.form.input.password
- tour.auth.form.link.forgotPassword
- tour.auth.form.tab.signin
- tour.auth.form.tab.signup

### onboarding

**Planned and found**
- tour.onboarding.step.progress.container.main
- tour.onboarding.welcome.btn.getStarted
- tour.onboarding.welcome.btn.skipToStudio

### studio.create

**Planned and found**
- tour.studio.create.form.btn.aspectRatio.16_9
- tour.studio.create.form.btn.generate
- tour.studio.create.form.btn.resolution.1k
- tour.studio.create.form.btn.variations.1
- tour.studio.create.form.input.thumbnailTitle
- tour.studio.create.form.text.customInstructions
- tour.studio.nav.sidebar.btn.browse
- tour.studio.nav.sidebar.btn.create

**Found but unplanned**
- tour.studio.nav.sidebar.btn.faces
- tour.studio.nav.sidebar.btn.gallery
- tour.studio.nav.sidebar.btn.palettes
- tour.studio.nav.sidebar.btn.projects
- tour.studio.nav.sidebar.btn.styles

### studio.results

**Planned and found**
- tour.studio.results.results.btn.loadMore
- tour.studio.results.results.btn.refresh
- tour.studio.results.results.container.main
- tour.studio.results.results.grid.thumbnailGrid
- tour.studio.results.results.item.thumbnail
- tour.studio.results.results.select.sort

**Found but unplanned**
- tour.studio.nav.sidebar.btn.browse
- tour.studio.nav.sidebar.btn.create
- tour.studio.nav.sidebar.btn.faces
- tour.studio.nav.sidebar.btn.gallery
- tour.studio.nav.sidebar.btn.palettes
- tour.studio.nav.sidebar.btn.projects
- tour.studio.nav.sidebar.btn.styles

### studio.browse

**Planned and found**
- tour.studio.browse.grid.container.main
- tour.studio.nav.sidebar.btn.browse

**Found but unplanned**
- tour.studio.nav.sidebar.btn.create
- tour.studio.nav.sidebar.btn.faces
- tour.studio.nav.sidebar.btn.gallery
- tour.studio.nav.sidebar.btn.palettes
- tour.studio.nav.sidebar.btn.projects
- tour.studio.nav.sidebar.btn.styles

### studio.gallery

**Planned and found**
- tour.studio.gallery.grid.container.main
- tour.studio.nav.sidebar.btn.gallery

**Found but unplanned**
- tour.studio.nav.sidebar.btn.browse
- tour.studio.nav.sidebar.btn.create
- tour.studio.nav.sidebar.btn.faces
- tour.studio.nav.sidebar.btn.palettes
- tour.studio.nav.sidebar.btn.projects
- tour.studio.nav.sidebar.btn.styles

### studio.projects

**Planned and found**
- tour.studio.nav.sidebar.btn.projects
- tour.studio.projects.grid.container.main

**Found but unplanned**
- tour.studio.nav.sidebar.btn.browse
- tour.studio.nav.sidebar.btn.create
- tour.studio.nav.sidebar.btn.faces
- tour.studio.nav.sidebar.btn.gallery
- tour.studio.nav.sidebar.btn.palettes
- tour.studio.nav.sidebar.btn.styles

### studio.styles

**Planned and found**
- tour.studio.nav.sidebar.btn.styles
- tour.studio.styles.grid.container.main

**Found but unplanned**
- tour.studio.nav.sidebar.btn.browse
- tour.studio.nav.sidebar.btn.create
- tour.studio.nav.sidebar.btn.faces
- tour.studio.nav.sidebar.btn.gallery
- tour.studio.nav.sidebar.btn.palettes
- tour.studio.nav.sidebar.btn.projects

### studio.palettes

**Planned and found**
- tour.studio.nav.sidebar.btn.palettes
- tour.studio.palettes.grid.container.main

**Found but unplanned**
- tour.studio.nav.sidebar.btn.browse
- tour.studio.nav.sidebar.btn.create
- tour.studio.nav.sidebar.btn.faces
- tour.studio.nav.sidebar.btn.gallery
- tour.studio.nav.sidebar.btn.projects
- tour.studio.nav.sidebar.btn.styles

### studio.faces

**Planned and found**
- tour.studio.faces.grid.container.main
- tour.studio.nav.sidebar.btn.faces

**Found but unplanned**
- tour.studio.nav.sidebar.btn.browse
- tour.studio.nav.sidebar.btn.create
- tour.studio.nav.sidebar.btn.gallery
- tour.studio.nav.sidebar.btn.palettes
- tour.studio.nav.sidebar.btn.projects
- tour.studio.nav.sidebar.btn.styles

### share.project

**Planned but missing**
- tour.share.project.grid.container.main — requires concrete dynamic slug at runtime
- tour.share.project.modal.modal.thumbnail — requires concrete dynamic slug at runtime

### share.editor

**Planned but missing**
- tour.share.editor.state.btn.goStudio — requires concrete dynamic slug at runtime
- tour.share.editor.state.container.error — requires concrete dynamic slug at runtime
- tour.share.editor.state.container.loading — requires concrete dynamic slug at runtime

## Events

- ✅ `tour.event.route.ready` has an emission string in app/components code.
- ✅ `tour.event.auth.success` has an emission string in app/components code.
- ✅ `tour.event.auth.failed` has an emission string in app/components code.
- ✅ `tour.event.studio.view.changed` has an emission string in app/components code.
- ✅ `tour.event.studio.generate.started` has an emission string in app/components code.
- ✅ `tour.event.studio.generate.complete` has an emission string in app/components code.
- ✅ `tour.event.studio.generate.failed` has an emission string in app/components code.
- ✅ `tour.event.modal.opened` has an emission string in app/components code.
- ✅ `tour.event.modal.closed` has an emission string in app/components code.

## Summary

```
Validation Summary
==================
Routes checked: 13
Anchors planned: 44
Anchors found:   87
Anchors missing: 5
  - tour.share.project.grid.container.main (share.project: requires concrete dynamic slug at runtime)
  - tour.share.project.modal.modal.thumbnail (share.project: requires concrete dynamic slug at runtime)
  - tour.share.editor.state.btn.goStudio (share.editor: requires concrete dynamic slug at runtime)
  - tour.share.editor.state.container.error (share.editor: requires concrete dynamic slug at runtime)
  - tour.share.editor.state.container.loading (share.editor: requires concrete dynamic slug at runtime)
Unplanned anchors: 48
  - tour.studio.nav.sidebar.btn.faces (studio.create)
  - tour.studio.nav.sidebar.btn.gallery (studio.create)
  - tour.studio.nav.sidebar.btn.palettes (studio.create)
  - tour.studio.nav.sidebar.btn.projects (studio.create)
  - tour.studio.nav.sidebar.btn.styles (studio.create)
  - tour.studio.nav.sidebar.btn.browse (studio.results)
  - tour.studio.nav.sidebar.btn.create (studio.results)
  - tour.studio.nav.sidebar.btn.faces (studio.results)
  - tour.studio.nav.sidebar.btn.gallery (studio.results)
  - tour.studio.nav.sidebar.btn.palettes (studio.results)
  - tour.studio.nav.sidebar.btn.projects (studio.results)
  - tour.studio.nav.sidebar.btn.styles (studio.results)
  - tour.studio.nav.sidebar.btn.create (studio.browse)
  - tour.studio.nav.sidebar.btn.faces (studio.browse)
  - tour.studio.nav.sidebar.btn.gallery (studio.browse)
  - tour.studio.nav.sidebar.btn.palettes (studio.browse)
  - tour.studio.nav.sidebar.btn.projects (studio.browse)
  - tour.studio.nav.sidebar.btn.styles (studio.browse)
  - tour.studio.nav.sidebar.btn.browse (studio.gallery)
  - tour.studio.nav.sidebar.btn.create (studio.gallery)
  - ... 28 more
Events configured: 9
Events verified:   9
```
