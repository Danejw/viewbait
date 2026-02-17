# TourKit Workflows

See [README.md](./README.md) for quickstart and [REFERENCE.md](./REFERENCE.md) for full DSL and command reference.

## Setup workflow (run once)

1. Prompt 00 — Bootstrap
2. Prompt 01 — Discovery
3. Prompt 02A — Library
4. Prompt 02B — Instrument
5. Prompt 02C — Map + Validate

## Create a new tour (repeatable)

1. Write `tourkit/guides/<tourId>.md` using the guide DSL.
2. Compile it:
   - `npm run tourkit:gen -- tourkit/guides/<tourId>.md`
3. Add scripts to `package.json`:
   - `tour:<tourId>`
   - `tour:<tourId>:ci`
4. Run it:
   - `npm run tour:<tourId>:ci`
5. Fix failures and rerun until green.

Windows PowerShell example:

```powershell
npm run tourkit:gen -- tourkit/guides/my-tour.md
npm run tour:my-tour:ci
```

## Add anchors to a new page

1. Plan anchors in `tourkit/docs/ANCHOR_EVENT_PLAN.md`.
2. Add `data-tour="tour..."` in the app components.
3. Add `emitTourEvent(...)` for key async transitions.
4. Regenerate map:
   - `npm run tourkit:map`
5. Validate with:
   - `npm run tourkit:doctor`
   - `tourkit/docs/VALIDATION_REPORT.md`

## Record clean demo videos

1. Edit `tourkit/.env.tourkit`:
   - `TOURKIT_CAPTURE=1`
   - `TOUR_OVERLAY=0`
2. Run:
   - `npm run tour:<tourId>`
3. Find video at:
   - `tourkit/artifacts/<tourId>/<timestamp>/video.webm`

## Common failure modes and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `E2E_EMAIL missing` | Env not loaded or value absent | Fill `tourkit/.env.tourkit`, rerun `npm run tourkit:doctor` |
| `Element detached` | Hydration/rerender timing | `safeClick` retries; if persistent, add a `Wait <N>ms` guide step |
| `WaitForEvent timed out` | Event not emitted in app path | Verify `emitTourEvent("tour.event...")` exists on that flow |
| `BaseURL connection refused` | App not reachable | Check `webServer` in `playwright.config.ts` or run `npm run dev` |
| Overlay visible in video | `TOUR_OVERLAY=1` | Set `TOUR_OVERLAY=0` |
| Anchor not found | Missing `data-tour` or stale map | Add anchor and rerun `npm run tourkit:map` |
| Auth redirect during map generation | Auth-gated route | Expected for protected routes; map marks `skipReason: auth redirect` |
