# TourKit Architecture

## High-level data flow

```text
Guide (.md DSL)
   |
   v
[tourkit/scripts/generate-tour-from-guide.ts]
   |
   v
Tour JSON (.tour.json)
   |
   v
[tests/e2e/tourkit.spec.ts] --> [tourkit/runner/runTour.ts] --> Playwright browser
                                                           |
                                                           v
                                      /tourkit/artifacts/<tourId>/<timestamp>/
                                         - screens/*.png
                                         - runlog.txt
                                         - video.webm
                                         - trace.zip
```

```text
config/routes.json + config/events.json
                 |
                 v
      [tourkit/scripts/generate-tour-map.ts]
                 |
                 v
  maps/tour.map.json + maps/TOUR_MAP.md
```

## Where the contract lives

- Naming and contract docs:
  - `tourkit/docs/NAMING.md`
  - `tourkit/docs/CONTRACT.md`
- Canonical machine contract:
  - `tourkit/config/routes.json`
  - `tourkit/config/events.json`
- Current discovered contract snapshot:
  - `tourkit/maps/tour.map.json`

## Runtime pieces

- Tour mode / helpers:
  - `tourkit/app/tourMode.ts`
  - `tourkit/app/tourEvents.browser.ts`
  - `tourkit/app/tourSelectors.ts`
  - `tourkit/app/TourOverlay.tsx`
- Runner:
  - `tourkit/runner/runTour.ts`
- Harness:
  - `tests/e2e/tourkit.spec.ts`

## Why this architecture is stable

- Tours target stable anchors, not changing copy.
- Async waits use explicit events, not fragile polling.
- Guide DSL compiles to strict JSON and validates against map.
- Artifacts are centralized per run for fast debugging.
