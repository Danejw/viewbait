# Onboarding Tour Runner

Reusable Playwright tours live in `tests/tours/` and produce onboarding artifacts in `onboarding/artifacts/<tour-name>/`.

## Run commands

- Install browsers (one-time): `npm run playwright:install`
- Run all end-to-end tests: `npm run test:e2e`
- Run only tours with always-on recording: `npm run tour:run`
- Run tours headed (debugging): `npm run tour:run:headed`
- Optional slideshow render (requires ffmpeg): `npm run tour:render -- <tour-name>`

`tour:run` sets `TOUR_MODE=1`, which forces all-run video + trace and a stable viewport.

## Output contract

Each tour run writes to:

- `onboarding/artifacts/<tour-name>/<id>-<slug>.png`
- `onboarding/artifacts/<tour-name>/tour.json`
- `onboarding/artifacts/<tour-name>/tour.md`

Example `tour.json` shape:

```json
{
  "tourName": "example-onboarding",
  "generatedAt": "2026-02-15T10:05:52.940Z",
  "steps": [
    {
      "id": "01",
      "title": "Open the landing page",
      "narration": "Welcome to ViewBait...",
      "screenshot": "01-open-the-landing-page.png",
      "timestamp": "2026-02-15T10:05:54.120Z",
      "durationMs": 1450
    }
  ]
}
```

`tour.md` is generated from the same data as a clean voiceover script.

## Create a new tour

1. Add a file in `tests/tours/` named `*.tour.spec.ts`.
2. Add a tagged test using `@tour` so `tour:run` can select it.
3. Create context once per test:

```ts
const ctx = await createTourContext(testInfo, 'my-tour-name');
```

4. Execute each step with `tourStep(page, ctx, {...})` including:
   - `id` (deterministic step ordering)
   - `title`
   - `narration`
   - `action(page)`
   - optional `waitFor` (locator or async assertion)
   - optional `durationMs` (used by slideshow rendering)

## Best practices for reliable tours

- Prefer resilient selectors: `getByRole`, `getByLabel`, and `data-testid`.
- Keep each step focused on one visible milestone.
- Use `waitFor` for explicit assertions instead of fixed sleeps.
- Avoid stateful assumptions between tours.
- Keep routes public unless a dedicated tour-auth mechanism is explicitly configured.

## Traces and videos

- Default mode: `trace: on-first-retry`, `video: retain-on-failure`.
- Tour mode (`TOUR_MODE=1`): `trace: on`, `video: on`, viewport `1440x900`.

Playwright stores test-run attachments (video/trace) in standard Playwright output folders, while screenshots and narration artifacts stay in `onboarding/artifacts/<tour-name>/`.
