# TourKit Architecture

## High-level flow

```text
Guide (.md)                    App Source Code
    |                               |
    v                               v
[Generator] <-- validates --> [tour.map.json]
    |                               ^
    v                               |
Tour (.json)                   [Map Generator]
    |                               ^
    v                               |
[Runner] ----Playwright----> [Live App + Anchors + Events]
    |
    v
[Artifacts]
  screens/
  video.webm
  trace.zip
  runlog.txt
```

## Key integration points

- **dotenv loading**
  - `playwright.config.ts` loads `tourkit/.env.tourkit` before config evaluation.
- **Event buffer install point**
  - `tourkit/runner/runTour.ts` uses `page.addInitScript(...)` before first navigation.
- **Artifact copy location**
  - `tests/e2e/tourkit.spec.ts` copies Playwright output (`video`, traces) into `tourkit/artifacts/<tourId>/<timestamp>/`.
- **Overlay toggle source**
  - `tourkit/app/TourOverlay.tsx` reads `TOUR_OVERLAY` behavior via tour mode helpers.
- **Capture toggle source**
  - `playwright.config.ts` reads `TOURKIT_CAPTURE` to set trace/video/screenshot strategy.
- **Tour mode detection**
  - `tourkit/app/tourMode.ts` supports URL-driven `?tour=1` and env-driven mode checks.

## File dependency graph

- `tourkit/config/routes.json`
  - consumed by `tourkit/scripts/generate-tour-from-guide.ts`, `tourkit/scripts/generate-tour-map.ts`, and `tourkit/runner/runTour.ts`.
- `tourkit/config/events.json`
  - consumed by generator and doctor validations.
- `tourkit/maps/tour.map.json`
  - produced by map generator, consumed by guide generator and doctor.
- `tourkit/guides/*.md`
  - consumed by `tourkit/scripts/generate-tour-from-guide.ts`.
- `tourkit/tours/*.tour.json`
  - consumed by `tests/e2e/tourkit.spec.ts` through `TOUR_FILE`.
- `tourkit/runner/runTour.ts`
  - executes tour steps and writes run logs/screenshots.
- `playwright.config.ts`
  - provides runtime environment, capture options, and web server startup.

## Runtime sequence

1. Playwright config loads env and validates required credentials.
2. Harness reads `TOUR_FILE` and loads tour JSON.
3. Runner installs tour event buffer (`window.__tourkit_events`).
4. Runner executes steps (`goto`, `fill`, `click`, waits, snapshots).
5. Harness copies generated media/traces into TourKit artifact folders.
