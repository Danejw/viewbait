# TourKit Purpose

TourKit is a Playwright-based system for creating repeatable, guided tours of a web app. It provides a structured way to discover flows, map critical UI paths, generate stable tour scripts, and preserve artifacts for review.

## Problems TourKit Solves

- Brittle selectors that break when copy or layout changes.
- Missed async events and timing issues in end-to-end scripts.
- Unorganized artifacts (screenshots, traces, videos, maps, and docs) spread across the repo.

## Contract for Reliable Tours

TourKit tours should reference only:

- `data-tour` attributes for deterministic element targeting.
- `tour.event.*` custom events for stable event-driven flow control.

Avoid text-based selectors and implicit timing assumptions.

## Prompt Sequence

1. **00 (bootstrap)**: install and wire Playwright + TourKit scaffolding.
2. **01 (discovery)**: inventory flows, anchors, and instrumentation targets.
3. **02A/02B/02C (library, instrument, map)**: build shared runtime utilities, add in-app hooks, and generate maps.
4. **03 (create tours, repeatable)**: generate and stabilize production-ready tour specs.
5. **04 (documentation)**: finalize operational docs and runbooks.

## Multi-Tour Architecture

- Each feature should have its own focused tour.
- Shared flows (for example, authentication) should live in reusable fragments under `tourkit/guides/_fragments/`.
- Feature tours compose fragments rather than reimplementing shared steps.
