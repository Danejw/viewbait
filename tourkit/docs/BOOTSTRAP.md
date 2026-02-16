# TourKit Bootstrap

Prompt 00 bootstraps TourKit so future prompts can run with minimal setup friction.

## What was set up

- Playwright test harness and baseline config.
- TourKit folder structure under `tourkit/`.
- Placeholder scripts for doctor, map generation, and tour generation.
- Placeholder e2e test at `tests/e2e/tourkit.spec.ts`.

## Dependencies

Installed as dev dependencies:

- `@playwright/test`
- `dotenv`
- `cross-env`
- `tsx`

## Env wiring

TourKit uses its own env files under `tourkit/`:

- Template: `tourkit/.env.tourkit.example` (committed)
- Secrets: `tourkit/.env.tourkit` (gitignored)

Playwright loads `tourkit/.env.tourkit` via `dotenv` from `playwright.config.ts` before `defineConfig` is evaluated.

## Playwright webServer

`playwright.config.ts` includes a `webServer` block that auto-starts the app with `npm run dev` on port `3000`, reusing an existing server when present.

## Capture and overlay toggles

- `TOURKIT_CAPTURE=1` forces trace/video/screenshot capture on every run.
- `TOUR_OVERLAY=1` enables visual anchor overlay in-app once instrumentation is implemented.

## Scripts

- `npm run tourkit:doctor` -> placeholder health check script
- `npm run tourkit:map` -> placeholder map generation script
- `npm run tourkit:gen` -> placeholder tour generation script
- `npm run tour:all` -> run TourKit-tagged e2e spec(s)
- `npm run pw:ui` -> open Playwright UI mode

## Verification

1. Fill `tourkit/.env.tourkit` with real credentials.
2. Run `npx playwright test --grep @tourkit`.
3. Confirm the browser opens, app loads, and test passes.

## Next step

Run Prompt 01.
