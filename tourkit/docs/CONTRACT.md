# TourKit Contract

The TourKit contract is two things:

1. **Anchors** in DOM via `data-tour="tour...."`
2. **Events** via `window.dispatchEvent(new CustomEvent("tour.event...."))`

Tours should rely on these only.

## Anchor grammar

Required prefix: `tour.`

Format:

`tour.<route>.<area>.<type>.<name>[.<variant>]`

- `route`: stable route key (example: `home`, `auth`, `studio.create`, `results`)
- `area`: page/component area (example: `hero`, `nav`, `form`, `create`, `main`)
- `type`: one of:
  - `cta | btn | input | select | tab | card | grid | item | modal | chip | toggle | text`
- `name`: stable functional identifier
- `variant` (optional): stable sub-option (`16_9`, `1k`, `manual`, etc.)

Examples:

- `tour.home.hero.cta.openStudio`
- `tour.auth.form.input.email`
- `tour.studio.create.btn.aspectRatio.16_9`
- `tour.studio.create.btn.variations.1`
- `tour.results.main.card.thumbnail.first`

## Event grammar

Required prefix: `tour.event.`

Format:

`tour.event.<domain>.<name>`

- `domain`: route | auth | studio | thumbnail | modal | results
- `name`: ready | success | started | complete | opened | closed

Examples:

- `tour.event.route.ready`
- `tour.event.auth.success`
- `tour.event.studio.manual.ready`
- `tour.event.thumbnail.generation.complete`
- `tour.event.results.ready`

## Why prefixes are required

- They provide a machine-checkable namespace.
- They prevent collisions with unrelated classes/selectors/events.
- They make validation in `generate-tour-from-guide.ts`, `doctor.ts`, and map generation deterministic.

## Do / Don't

### Do

- Do anchor interactive elements (button/input/tab) directly.
- Do wait for `tour.event.*` for async completion points.
- Do keep names stable across copy/UI text changes.

### Don't

- Don't use text selectors as contract (`getByText`, string matching, placeholder-based matching).
- Don't poll DOM for completion if an event exists.
- Don't anchor only wrappers when users interact with nested controls.
