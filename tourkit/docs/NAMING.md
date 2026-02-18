# TourKit Naming Contract

## Anchor grammar

All anchors use `data-tour` and **must** start with `tour.`:

```text
tour.<route>.<area>.<type>.<name>[.<variant>]
```

- `<route>`: stable route key (`home`, `auth`, `studio.create`, `studio.results`)
- `<area>`: local page area (`hero`, `nav`, `form`, `sidebar`, `results`, `settings`)
- `<type>`: one of the allowed values below
- `<name>`: stable element identifier
- `<variant>`: optional qualifier (`16_9`, `4k`, `manual`)

### Concrete examples (from this app)

- `tour.home.hero.cta.startCreating`
- `tour.auth.form.input.email`
- `tour.auth.form.btn.submit`
- `tour.studio.create.form.input.thumbnailTitle`
- `tour.studio.create.form.text.customInstructions`
- `tour.studio.create.form.btn.generate`
- `tour.studio.create.form.btn.aspectRatio.16_9`
- `tour.studio.results.results.select.sort`
- `tour.studio.results.results.btn.refresh`
- `tour.studio.nav.sidebar.btn.browse`

## Allowed `<type>` values (complete)

- `cta` — Primary call-to-action actions.
- `btn` — Generic clickable buttons.
- `input` — Text-like input fields.
- `select` — Dropdown/select trigger controls.
- `tab` — Tab switch controls.
- `card` — Card containers representing an entity.
- `grid` — Grid/list wrapper containers.
- `item` — Individual row/tile/list items.
- `modal` — Modal/dialog roots.
- `chip` — Small selectable chips/tags.
- `toggle` — Toggle/switch controls.
- `text` — Read-only text nodes used for assertions.
- `link` — Navigation links/anchors.
- `label` — Form labels.
- `container` — Structural wrapper blocks needed for assertions.
- `image` — Images or image placeholders.
- `badge` — Small status/count badges.
- `progress` — Progress meters/indicators.

## Event grammar

All events must be custom events and must start with `tour.event.`:

```text
tour.event.<domain>.<name>
```

Examples:
- `tour.event.route.ready`
- `tour.event.auth.success`
- `tour.event.auth.failed`
- `tour.event.studio.generate.started`
- `tour.event.studio.generate.complete`
- `tour.event.modal.opened`
- `tour.event.modal.closed`

## Do / Don't rules

### Do
- DO anchor the interactive element itself (not a wrapper).
- DO emit `tour.event.route.ready` after key anchors are present and the page is interactive.
- DO use `tour.event.*` waits instead of DOM polling for async operations.

### Don't
- DON'T use text selectors in tours.
- DON'T poll DOM for generation completion if you can emit an explicit event.
- DON'T use duplicate anchors on the same route.
- DON'T anchor conditionally rendered elements without documenting the condition in the plan.
