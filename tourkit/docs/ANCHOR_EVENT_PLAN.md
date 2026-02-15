# TourKit Anchor + Event Plan (Prompt 1)

## Scope

Primary Tour #1 flow discovered in current app:

`home -> auth -> login -> studio.create (manual) -> fill inputs -> set options -> generate -> results`

This plan defines the stable contract for upcoming implementation prompts.

## Naming rules (contract)

### Anchors

- Attribute: `data-tour="..."`
- Prefix: every anchor starts with `tour.`
- Grammar: `tour.<route>.<area>.<type>.<name>[.<variant>]`
- Allowed `<type>` values:
  - `cta | btn | input | select | tab | card | grid | item | modal | chip | toggle | text`

### Events

- Every event starts with `tour.event.`
- Grammar: `tour.event.<domain>.<name>`
- Allowed domains: `route | auth | studio | thumbnail | modal | results`

## Route discovery and route keys

Discovered app routes used by the first-thumbnail onboarding flow:

- `home` -> `/`
- `auth` -> `/auth`
- `studio.create` -> `/studio`
- `results` -> `/studio` (same page; results feed in center content)

## Minimum per-route anchors

These are the minimum stable anchors so tours do not rely on text selectors.

### home (`/`)

- `tour.home.nav.cta.openStudio` (top nav Open Studio CTA)
- `tour.home.hero.cta.openStudio` (hero/primary Open Studio CTA)

### auth (`/auth`)

- `tour.auth.form.tab.signin`
- `tour.auth.form.input.email`
- `tour.auth.form.input.password`
- `tour.auth.form.btn.submit`

### studio.create (`/studio`)

- `tour.studio.create.tab.manual`
- `tour.studio.create.input.title`
- `tour.studio.create.input.customInstructions`
- `tour.studio.create.btn.aspectRatio.16_9`
- `tour.studio.create.btn.resolution.1k`
- `tour.studio.create.btn.generate`

### results (`/studio`)

- `tour.results.main.grid.thumbnails`
- `tour.results.main.card.thumbnail.first`

## Event plan (what to emit and when)

### `tour.event.route.ready`

- Emit when each tour-relevant route is interactive and required anchors for that route are mounted.
- Payload example:
  - `{ routeKey, anchorsPresent: [...] }`

### `tour.event.auth.success`

- Emit after successful `signIn` result and before/while redirecting to `/studio`.
- Payload example:
  - `{ userId, redirectTo: "/studio" }`

### `tour.event.studio.manual.ready`

- Emit on `/studio` when Manual tab is active and core create-form controls are mounted.
- Payload example:
  - `{ mode: "manual", anchorsPresent: [...] }`

### `tour.event.thumbnail.generation.started`

- Emit right before `generate(...)` is called in manual generator action.
- Payload example:
  - `{ requestId, variations }`

### `tour.event.thumbnail.generation.complete`

- Emit after generation returns with at least one successful result and thumbnail refresh completes.
- Payload example:
  - `{ count, firstSrc, thumbnailIds }`

### `tour.event.results.ready`

- Emit when results grid is rendered and first thumbnail card is available (or a known empty-ready state is rendered).
- Payload example:
  - `{ routeKey: "results", totalVisible }`

## Implementation notes (where anchors/events will be added)

Expected anchor implementation locations:

- Home Open Studio CTAs:
  - `app/page.tsx`
- Auth form tabs/inputs/submit:
  - `app/auth/page.tsx`
- Studio manual mode tabs + form controls + generate button:
  - `components/studio/studio-generator.tsx`
- Results grid anchors:
  - `components/studio/studio-results.tsx`
  - `components/studio/thumbnail-grid.tsx` or thumbnail card component if needed for first-card anchor

Expected event implementation locations:

- Route ready events:
  - `app/page.tsx`
  - `app/auth/page.tsx`
  - `app/studio/page.tsx` and/or studio route child components
- Auth success event:
  - `app/auth/page.tsx` (inside successful sign-in path)
- Studio manual-ready event:
  - `components/studio/studio-generator.tsx`
- Generation started/complete events:
  - `components/studio/studio-provider.tsx` (`generateThumbnails` action)
- Results ready event:
  - `components/studio/studio-results.tsx`

## App-specific wait points to avoid DOM polling

- Auth submit -> successful sign-in redirect
  - wait on `tour.event.auth.success`
- Studio load -> manual mode controls are ready
  - wait on `tour.event.studio.manual.ready`
- Generate click -> backend generation lifecycle
  - wait on `tour.event.thumbnail.generation.started`
  - then wait on `tour.event.thumbnail.generation.complete`
- Results section ready for interactions
  - wait on `tour.event.results.ready`
