# TourKit Contract

This is the canonical anchor/event contract for the repo. For practical usage, see [WORKFLOWS.md](./WORKFLOWS.md).

## Anchor naming grammar

All anchors must be placed in `data-tour` and must start with `tour.`.

```text
tour.<route>.<area>.<type>.<name>[.<variant>]
```

Real examples from this app:

1. `tour.home.nav.cta.openStudio`
2. `tour.auth.form.input.email`
3. `tour.auth.form.btn.submit`
4. `tour.studio.create.form.btn.aspectRatio.16_9`
5. `tour.studio.create.form.btn.resolution.1k`
6. `tour.studio.create.form.btn.variations.1`
7. `tour.studio.results.results.grid.thumbnailGrid`
8. `tour.studio.results.results.item.thumbnail`

## Event naming grammar

All events must start with `tour.event.`.

```text
tour.event.<domain>.<name>
```

Real examples:

- `tour.event.route.ready`
- `tour.event.auth.success`
- `tour.event.auth.failed`
- `tour.event.studio.view.changed`
- `tour.event.studio.generate.started`
- `tour.event.studio.generate.complete`
- `tour.event.studio.generate.failed`
- `tour.event.modal.opened`
- `tour.event.modal.closed`

## Allowed `<type>` values

- `cta` — primary conversion actions.
- `btn` — clickable button-like controls.
- `input` — input fields.
- `select` — dropdown/select triggers.
- `tab` — tab selectors.
- `card` — card containers.
- `grid` — grid/list wrapper containers.
- `item` — individual list/grid items.
- `modal` — modal/dialog roots.
- `chip` — chips/tag controls.
- `toggle` — switch-like controls.
- `text` — assertable text regions.
- `link` — navigational links.
- `label` — labels.
- `container` — structural wrappers.
- `image` — image nodes.
- `badge` — badges/counters.
- `progress` — progress indicators.

## Required prefixes and why

- Anchors use `tour.` so all automation selectors are namespace-isolated and grep-friendly.
- Events use `tour.event.` so waits can reliably discriminate app tour lifecycle events from native/browser events.

## Fragment system

- Fragments are reusable guide snippets.
- Location: `tourkit/guides/_fragments/`.
- Include syntax in guides:

```text
Include fragment: login
```

The generator expands this by loading `tourkit/guides/_fragments/login.md`.

## Do / Don't

### Do

- Anchor the interactive element itself, not an arbitrary wrapper.
- Emit `tour.event.route.ready` after route anchors are mounted.
- Prefer `Wait for (tour.event.*)` for async states.
- Keep anchor names stable and route-scoped.

### Don't

- Do not use text selectors in tours.
- Do not poll DOM for async operations when an event can be emitted.
- Do not place route-duplicate anchors on the same page.
- Do not skip map regeneration after adding anchors.
