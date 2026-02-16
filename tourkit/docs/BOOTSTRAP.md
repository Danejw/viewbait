# TourKit Bootstrap (Prompt 00)

This bootstrap configures TourKit so later prompts can build on a deterministic baseline.

## What Prompt 00 set up

- Added Playwright test harness support
- Added TourKit workspace folders under `/tourkit`
- Added placeholder TourKit scripts
- Added an initial tagged Playwright test in `tests/e2e/tourkit.spec.ts`
- Added starter TourKit docs and saved Prompt 00 in `tourkit/prompts/00-Bootstrap.md`

## Dependencies installed

Prompt 00 ensures these dev dependencies exist:

- `@playwright/test`
- `dotenv`
- `cross-env`
- `tsx`

## Env wiring

- Secrets live in `/tourkit/.env.tourkit`
- Template lives in `/tourkit/.env.tourkit.example`
- `/tourkit/.env.tourkit` is gitignored
- `playwright.config.ts` explicitly loads `tourkit/.env.tourkit` using `dotenv` before config evaluation
- Playwright config fails fast when `E2E_EMAIL` or `E2E_PASSWORD` are unset or left as template placeholders

## Playwright webServer behavior

`playwright.config.ts` includes a `webServer` block that auto-starts the app (`npm run dev` on port `3000`) and reuses an existing server when available.

## Capture and overlay toggles

- `TOURKIT_CAPTURE=1` turns on screenshot/video/trace capture for every run
- `TOUR_OVERLAY=1` enables the in-app anchor overlay once overlay support is implemented

## Available scripts

- `npm run tourkit:doctor` - placeholder doctor script for environment checks
- `npm run tourkit:map` - placeholder map generation script
- `npm run tourkit:gen` - placeholder guide-to-tour generation script
- `npm run tour:all` - runs only `@tourkit`-tagged Playwright tests
- `npm run pw:ui` - launches Playwright UI mode

## Verification

1. Fill `/tourkit/.env.tourkit` with real credentials
2. Run `npx playwright test --grep @tourkit`
3. Confirm the test opens the app and passes

## Next step

Run Prompt 01.
