# TourKit Reference

## Guide DSL grammar

Each non-empty, non-comment line in `tourkit/guides/*.md` becomes a step.

Supported syntax:

- `Say: <message>`
- `Goto routeKey: <routeKey>`
- `Click <label> (<tour.anchor>)`
- `Fill <label> (<tour.anchor>) value:<literal>`
- `Fill <label> (<tour.anchor>) env:<ENV_VAR>`
- `Expect visible <label> (<tour.anchor>)`
- `Expect visible <label> (<tour.anchor>) timeout:<ms>`
- `Wait for <label> (<tour.event.name>) timeout:<ms>`
- `Wait <N>ms`
- `Snapshot <label> name:<filename>`
- `Include fragment: <fragmentName>`

Current runner step types implemented in JSON:
- `say`, `goto`, `click`, `fill`, `expectVisible`, `waitForEvent`, `waitMs`, `snapshot`.

Example (from `first-thumbnail.md`):

```text
Fill Thumbnail Title (tour.studio.create.form.input.thumbnailTitle) value:My First Thumbnail
Wait for Generation Complete (tour.event.studio.generate.complete) timeout:120000
Click First Generated Thumbnail (tour.studio.results.results.item.thumbnail)
```

## Tour JSON schema

Schema file: `tourkit/schema/tour.schema.json`

Top-level fields:
- `tourId` (required, pattern `^[a-z][a-z0-9-]*$`)
- `description` (optional)
- `steps` (required array of typed step objects)

Step object variants include:
- `{"type":"goto","routeKey":"studio.create"}`
- `{"type":"click","label":"Create","anchor":"tour.studio.create.form.btn.generate"}`
- `{"type":"fill","anchor":"tour.auth.form.input.email","valueEnv":"E2E_EMAIL"}`
- `{"type":"waitForEvent","name":"tour.event.auth.success","timeoutMs":30000}`

## npm commands (exact scripts in this repo)

- `npm run dev`
- `npm run remotion:studio`
- `npm run remotion:render`
- `npm run build`
- `npm run build:typecheck`
- `npm run start`
- `npm run lint`
- `npm run typecheck`
- `npm run typecheck:ci`
- `npm run test`
- `npm run test:run`
- `npm run test:coverage`
- `npm run score`
- `npm run score:landing`
- `npm run score:studio`
- `npm run benchmark`
- `npm run benchmark:landing`
- `npm run benchmark:studio`
- `npm run analyze`
- `npm run tourkit:doctor`
- `npm run tourkit:map`
- `npm run tourkit:gen`
- `npm run tour:all`
- `npm run pw:ui`
- `npm run tour:first-thumbnail`
- `npm run tour:first-thumbnail:ci`

## Artifact directory layout

```text
tourkit/artifacts/<tourId>/<timestamp>/
  screens/
  runlog.txt
  video.webm        # when capture enabled
  trace.zip         # when trace captured
  failure-summary.md # when run fails and summary is created
```

## Map/config file formats

- `tourkit/config/routes.json`
  - Route catalog with `routeKey`, `path`, `primaryFlow`, and `plannedTours`.
- `tourkit/config/events.json`
  - Event catalog with `name`, description, and payload examples.
- `tourkit/maps/tour.map.json`
  - Generated map of `routes[routeKey].anchors` and skip metadata.
- `tourkit/maps/TOUR_MAP.md`
  - Human-readable map grouped by route/area.

## `TOUR_FILE` usage by harness

`tests/e2e/tourkit.spec.ts` loads `process.env.TOUR_FILE`, reads that JSON tour file, tags the test with `@tour:<tourId>`, and passes the parsed data into `runTour(...)`.

Typical invocation:

```bash
cross-env TOUR_FILE=tourkit/tours/first-thumbnail.tour.json playwright test tests/e2e/tourkit.spec.ts --grep @tour:first-thumbnail
```

## Capture settings and where configured

Configured in `playwright.config.ts`:
- `trace`: `on` when `TOURKIT_CAPTURE=1`, otherwise `on-first-retry`
- `video`: `on` when `TOURKIT_CAPTURE=1`, otherwise `retain-on-failure`
- `screenshot`: `on` when `TOURKIT_CAPTURE=1`, otherwise `only-on-failure`

## Event buffer

`runTour.ts` injects an init script before navigation to patch `window.dispatchEvent` and append all `tour.event.*` events into `window.__tourkit_events`.

Why it exists:
- Allows deterministic `waitForEvent` checks.
- Handles events that fire before a specific wait step is reached.
