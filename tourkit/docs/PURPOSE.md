# TourKit Purpose

TourKit is a Playwright-based system for creating repeatable, guided tours of this web app.

## Problems TourKit solves

- Brittle selectors tied to visible text or unstable DOM structure.
- Missed async states and timing issues in guided walkthroughs.
- Unorganized screenshots, traces, and execution artifacts.

## Tour contract

Tours must reference only:

- `data-tour` attributes for durable UI anchors.
- `tour.event.*` custom events for app-state checkpoints.

## Prompt sequence

1. Prompt 00: Bootstrap
2. Prompt 01: Discovery
3. Prompts 02A, 02B, 02C: Library, instrument, and map
4. Prompt 03: Create repeatable tours
5. Prompt 04: Documentation and handoff

## Multi-tour architecture

Each feature gets its own tour. Shared flows such as login live in reusable fragments under `tourkit/guides/_fragments/`.
