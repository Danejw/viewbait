# TourKit Purpose

TourKit is a Playwright-based system for building repeatable, guided tours of the app. It gives the team a reliable way to script real product flows and rerun those flows without manual guesswork.

## Problems TourKit solves

- Brittle selectors tied to changing UI copy
- Missed asynchronous app behavior and event timing
- Scattered artifacts and debugging output with no central organization

## Contract

TourKit tours only rely on:

- `data-tour` attributes for durable UI targeting
- `tour.event.*` custom events for app-level synchronization

This keeps tour scripts stable and implementation-agnostic.

## Prompt sequence

TourKit is delivered in a strict sequence:

1. Prompt 00: bootstrap
2. Prompt 01: discovery
3. Prompt 02A/02B/02C: library, instrumentation, map
4. Prompt 03: create repeatable tours
5. Prompt 04: finalize documentation

## Multi-tour architecture

Each product feature gets its own tour so tour scope stays focused. Shared flows, such as login, are extracted into reusable fragments in `tourkit/guides/_fragments/`.
