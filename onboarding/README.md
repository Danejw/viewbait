# Onboarding Tour Generator

Reusable Playwright-driven onboarding capture system for ViewBait.

## Commands

- `npm run test:e2e` — run all Playwright E2E tests.
- `npm run tour:run` — run only tour tests (`@tour` tagged).
- `npm run tour:run:headed` — run tours in headed mode for debugging.

## Environment

- `PLAYWRIGHT_BASE_URL` (optional): default `http://127.0.0.1:3000`
- `E2E_EMAIL` / `E2E_PASSWORD`: credentials for login tour steps.
- `TOUR_MODE=1`: always capture Playwright video + trace (in addition to screenshot artifacts).

Example:

```bash
E2E_EMAIL=you@example.com E2E_PASSWORD=secret TOUR_MODE=1 npm run tour:run
```

## Output Artifacts

Each tour writes deterministic files under:

- `onboarding/artifacts/<tourName>/01-<slug>.png`
- `onboarding/artifacts/<tourName>/tour.json`
- `onboarding/artifacts/<tourName>/tour.md`

`tour.json` is the machine-readable manifest, and `tour.md` is a narration-first script with image links.

## Authoring a New Tour

1. Create `onboarding/tours/<name>.json`
2. Follow the DSL structure:
   - `say`
   - `click`
   - `fill`
   - `select`
   - `expect`
3. Run `npm run tour:run`.

Selector strategy (in priority order):
1. `testId`
2. `{ role, name }`
3. `{ label }`
4. `{ text }`

## Selector Best Practices

- Add `data-testid` on stable controls used by tours.
- Keep IDs semantic and workflow-oriented (`login-submit`, `thumbnail-title`).
- Avoid CSS selectors for long-term reliability.

## Tour Mode, Traces, and Videos

`playwright.config.ts` toggles capture behavior:

- `TOUR_MODE=1` → `video: 'on'`, `trace: 'on'`
- default → `video: 'retain-on-failure'`, `trace: 'on-first-retry'`

This keeps CI efficient while preserving deep debugging for onboarding captures.
