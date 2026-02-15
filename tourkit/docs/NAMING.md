# TourKit Naming Contract

## Anchor naming (required)

Use `data-tour` attributes only.

Grammar:

`tour.<route>.<area>.<type>.<name>[.<variant>]`

- `<route>`: stable route key, not a literal URL path
- `<area>`: stable section/component area (`hero`, `nav`, `form`, `create`, `main`, `grid`, etc.)
- `<type>`: one of:
  - `cta`
  - `btn`
  - `input`
  - `select`
  - `tab`
  - `card`
  - `grid`
  - `item`
  - `modal`
  - `chip`
  - `toggle`
  - `text`
- `<name>`: stable intent name (`openStudio`, `email`, `password`, `submit`, `title`, `customInstructions`, `aspectRatio`, `resolution`, `generate`)
- `<variant>`: optional suffix for stable variants (`manual`, `16_9`, `1k`, etc.)

### Anchor examples

- `tour.home.hero.cta.openStudio`
- `tour.auth.form.input.email`
- `tour.auth.form.input.password`
- `tour.auth.form.btn.submit`
- `tour.studio.create.tab.manual`
- `tour.studio.create.input.title`
- `tour.studio.create.input.customInstructions`
- `tour.studio.create.btn.aspectRatio.16_9`
- `tour.studio.create.btn.resolution.1k`
- `tour.studio.create.btn.generate`
- `tour.results.main.grid.thumbnails`

## Event naming (required)

Events must be browser `CustomEvent`s and must start with `tour.event.`.

Grammar:

`tour.event.<domain>.<name>`

Allowed domains:
- `route`
- `auth`
- `studio`
- `thumbnail`
- `modal`
- `results`

Allowed name endings:
- `ready`
- `success`
- `started`
- `complete`
- `opened`
- `closed`

### Event examples

- `tour.event.route.ready`
- `tour.event.auth.success`
- `tour.event.studio.manual.ready`
- `tour.event.thumbnail.generation.started`
- `tour.event.thumbnail.generation.complete`

## Do / Don't

### Do

- Do use only `data-tour` anchors for action targets.
- Do emit explicit `tour.event.*` events for async waits.
- Do anchor the actual interactive element (button/input/tab), not only parent wrappers.

### Don't

- Don't use text selectors in tours (`getByText`, fuzzy labels) as the contract.
- Don't poll DOM for generation completion when an event can be emitted.
- Don't anchor non-interactive wrappers if a child button/input is the real target.
