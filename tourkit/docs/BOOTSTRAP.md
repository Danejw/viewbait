# TourKit Bootstrap (Prompt 00)

## What Prompt 00 Sets Up

Prompt 00 bootstraps TourKit by installing Playwright tooling, creating the TourKit directory layout, wiring environment loading into Playwright, adding starter scripts, and creating a smoke-test harness.

## Dependencies Installed

- `@playwright/test`
- `dotenv`
- `cross-env`
- `tsx`

## Environment Wiring

TourKit uses its own env files, separate from the app env files:

- Template (committed): `tourkit/.env.tourkit.example`
- Real secrets (gitignored): `tourkit/.env.tourkit`

Playwright loads TourKit env variables explicitly via `dotenv` inside `playwright.config.ts` before config evaluation.

## Playwright `webServer`

The Playwright config includes a `webServer` block that auto-starts the app during tour runs:

- command: `npm run dev`
- port: `3000`
- `reuseExistingServer: true`
- `timeout: 120_000`

This avoids failures when the app is not already running.

## Capture and Overlay Toggles

- `TOURKIT_CAPTURE=1` forces video/screenshot/trace capture on every run.
- `TOUR_OVERLAY=1` enables in-app visual anchor overlay (once instrumentation is implemented).

## Added Scripts

- `npm run tourkit:doctor` — runs the TourKit doctor stub.
- `npm run tourkit:map` — runs the map generator stub.
- `npm run tourkit:gen` — runs the tour generator stub.
- `npm run tour:all` — runs TourKit-tagged Playwright tests.
- `npm run pw:ui` — opens Playwright UI mode.

## Verification

1. Fill in real credentials in `tourkit/.env.tourkit`.
2. Run: `npx playwright test --grep @tourkit`
3. Confirm the app opens and the bootstrap test passes.

## Next Step

Run **Prompt 01**.
