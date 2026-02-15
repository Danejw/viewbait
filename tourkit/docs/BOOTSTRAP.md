# TourKit Bootstrap (Prompt 0)

## What Prompt 0 sets up

- Ensures Playwright test dependency exists.
- Ensures TourKit folder skeleton exists under `/tourkit/`.
- Adds baseline Playwright config with trace/video/screenshot defaults for debugging.
- Adds baseline npm scripts for TourKit and Playwright UI mode.
- Adds stub generator/doctor scripts so follow-up prompts can replace implementation incrementally.
- Adds a placeholder `@tourkit` Playwright harness test.

## Detection summary

- Repo uses **Next.js** and local dev start command is `npm run dev`.
- Playwright was **not** installed initially.
- `@playwright/test` and `cross-env` were installed as dev dependencies.
- Browser binary install was attempted with `npx playwright install` but failed in this environment (403 from Playwright CDN).

## Scripts added

- `tourkit:doctor`
- `tourkit:map`
- `tourkit:gen`
- `tour:all`
- `pw:ui`

## Verify Playwright setup

1. Start app:
   ```bash
   npm run dev
   ```
2. Run TourKit placeholder test:
   ```bash
   npx playwright test tests/e2e/tourkit.spec.ts --grep @tourkit --headed
   ```
3. Run all TourKit-tagged tests:
   ```bash
   npm run tour:all
   ```
4. Show a trace from a failed/retried run:
   ```bash
   npx playwright show-trace path/to/trace.zip
   ```

## Current limitation in this environment

Browser binaries could not be downloaded due a CDN access restriction. On a normal developer machine, run:

```bash
npx playwright install
```

## Exact next step

Run **Prompt 1** (Anchor Discovery) to define route keys, anchor contract, and event contract files under `/tourkit/config` and `/tourkit/docs`.
