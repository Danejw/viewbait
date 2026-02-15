# Onboarding Tour Runner

This repository includes a reusable Playwright-based tour system for generating onboarding assets.

## Commands

- `npm run test:e2e` — run all Playwright specs.
- `npm run tour:run` — run only `@tour` specs in **TOUR_MODE**.
- `npm run tour:run:headed` — same as above, but headed for local debugging.
- `npm run tour:render -- <tour-name>` — optional slideshow MP4 renderer (requires local `ffmpeg`).

## Artifact output contract

Each tour writes to:

```txt
onboarding/artifacts/<tour-name>/
  01-<slug>.png
  02-<slug>.png
  ...
  tour.json
  tour.md
```

Playwright run artifacts are written to `test-results/` (videos/traces) and `playwright-report/`.

### `tour.json`

`tour.json` includes ordered steps with:

- `id`
- `title`
- `narration`
- `screenshot`
- `timestamp`
- `durationMs`

### `tour.md`

`tour.md` is a narration-friendly Markdown script generated from `tour.json`, ready for TTS or voiceover drafting.

## Creating a new tour

1. Add a new spec in `tests/tours/<name>.tour.spec.ts`.
2. Tag it with `@tour` in `test.describe(...)` or test title.
3. Build steps with `tourStep(page, context, step)`:

```ts
await tourStep(page, context, {
  id: "01",
  title: "Open home",
  narration: "Narration for this frame.",
  action: async (page) => {
    await page.goto("/");
  },
  waitFor: page.getByRole("heading", { name: /something/i }),
});
```

4. Initialize context once per test:

```ts
const context = createTourContext(testInfo, "my-tour-name");
```

## Selector and stability best practices

- Prefer resilient selectors: `getByRole`, `getByLabel`, and `data-testid`.
- Keep each step focused on one visible state change.
- Avoid arbitrary waits; use `waitFor` hooks/locators and assertions.
- `tourStep` automatically tries `networkidle`, then falls back to a short deterministic pause.

## TOUR_MODE behavior

When `TOUR_MODE=1`:

- Playwright records **video for every run**.
- Playwright captures **trace for every run**.
- Viewport uses a consistent tour-friendly size.

Without `TOUR_MODE`, defaults are conservative (`retain-on-failure` style trace/video).

## Version control policy for generated assets

Generated assets are ignored by default:

- `onboarding/artifacts/`
- `test-results/`
- `playwright-report/`

This keeps repository history clean while allowing teams to upload tour outputs to release artifacts or docs systems.
