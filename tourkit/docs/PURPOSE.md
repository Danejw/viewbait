# TourKit Purpose

TourKit is a structured Playwright workflow for building stable product walkthroughs in ViewBait.

## What TourKit solves

- Stable selectors via `data-tour="..."` anchors instead of brittle text/CSS selection.
- Explicit app synchronization via `tour.event.*` browser events.
- A repeatable pipeline that turns human guide files into runnable tours.

## Prompt sequence

1. **Prompt 0 (Setup):** Install Playwright, create TourKit structure, add scripts, verify baseline runner.
2. **Prompt 1 (Discovery):** Define route keys, anchor plan, and event contract.
3. **Prompt 2 (Implementation):** Add anchors/events in app code, add tour mode, generate anchor map.
4. **Prompt 3 (Tour Creation):** Convert guide DSL into validated tour JSON and run tours.
5. **Prompt 4 (Documentation):** Generate complete architecture and extension docs.

## Hard contract rule

Tours must reference only:
- `data-tour` anchors (`tour.*`)
- `tour.event.*` events

No text-selector contract is allowed for TourKit flows.
