# TourKit README

TourKit is this repo's event-driven Playwright tour system for stable, repeatable guided flows.

## 60-second Quickstart

```bash
1. cp tourkit/.env.tourkit.example tourkit/.env.tourkit
2. Edit tourkit/.env.tourkit (fill E2E_EMAIL and E2E_PASSWORD)
3. npm run tourkit:doctor
4. npm run tour:first-thumbnail
```

Windows PowerShell equivalent:

```powershell
Copy-Item tourkit/.env.tourkit.example tourkit/.env.tourkit
# Edit tourkit/.env.tourkit
npm run tourkit:doctor
npm run tour:first-thumbnail
```

## First run setup

1. Copy `tourkit/.env.tourkit.example` to `tourkit/.env.tourkit`.
2. Fill `E2E_EMAIL` and `E2E_PASSWORD` with real test credentials.
3. Run `npm run tourkit:doctor` and make sure it passes (warnings are acceptable depending on setup).

See [BOOTSTRAP.md](./BOOTSTRAP.md) for bootstrap details and [WORKFLOWS.md](./WORKFLOWS.md) for common workflows.

## Folder structure overview

- `tourkit/app/` — lightweight client utilities (overlay, event emitter, mode/selectors).
- `tourkit/artifacts/` — run outputs per tour and timestamp (`screens/`, `runlog.txt`, optional media).
- `tourkit/config/` — canonical route and event catalogs (`routes.json`, `events.json`).
- `tourkit/docs/` — operational docs and contracts.
- `tourkit/guides/` — human-authored tour guides in DSL format.
- `tourkit/guides/_fragments/` — reusable guide fragments (for example, login).
- `tourkit/maps/` — generated anchor map artifacts (`tour.map.json`, `TOUR_MAP.md`).
- `tourkit/prompts/` — prompt history used to build this TourKit setup.
- `tourkit/runner/` — Playwright runtime executor (`runTour.ts`).
- `tourkit/schema/` — JSON schema for generated tour files.
- `tourkit/scripts/` — utility scripts (doctor, map generator, guide compiler).
- `tourkit/tours/` — generated `.tour.json` files consumed by Playwright harness.

## Available npm commands

### `tourkit:*`

- `npm run tourkit:doctor` — validates config/env/schema/tour files.
- `npm run tourkit:map` — generates `tourkit/maps/tour.map.json` and `tourkit/maps/TOUR_MAP.md`.
- `npm run tourkit:gen -- tourkit/guides/<tourId>.md` — compiles guide DSL into `tourkit/tours/<tourId>.tour.json`.

### `tour:*`

- `npm run tour:all` — runs all tests tagged `@tourkit`.
- `npm run tour:first-thumbnail` — headed run for the first-thumbnail tour.
- `npm run tour:first-thumbnail:ci` — headless CI-style run for the first-thumbnail tour.

## Create a new tour checklist

1. Write a guide at `tourkit/guides/<tourId>.md`.
2. Run `npm run tourkit:gen -- tourkit/guides/<tourId>.md`.
3. Add `tour:<tourId>` and `tour:<tourId>:ci` scripts in `package.json`.
4. Run `npm run tour:<tourId>:ci`.
5. Fix and retry until it passes.

See [WORKFLOWS.md](./WORKFLOWS.md) and [REFERENCE.md](./REFERENCE.md) for full details.

## Recording presets

| Preset | Env settings | Use case |
|---|---|---|
| Minimal (default) | `TOURKIT_CAPTURE=0`, `TOUR_OVERLAY=0` | CI runs, pass/fail focus |
| Clean recording | `TOURKIT_CAPTURE=1`, `TOUR_OVERLAY=0` | Marketing demos and clean screenshots |
| Debug recording | `TOURKIT_CAPTURE=1`, `TOUR_OVERLAY=1` | Debug anchor placement and route instrumentation |

Exact `.env.tourkit` edits:

### Minimal (default)
```dotenv
TOURKIT_CAPTURE=0
TOUR_OVERLAY=0
```

### Clean recording
```dotenv
TOURKIT_CAPTURE=1
TOUR_OVERLAY=0
```

### Debug recording
```dotenv
TOURKIT_CAPTURE=1
TOUR_OVERLAY=1
```

## Sanity checklist

- [ ] `.env.tourkit` exists and is listed in `.gitignore`
- [ ] `npm run tourkit:doctor` passes (or shows only warnings)
- [ ] At least one tour exists in `/tourkit/tours/`
- [ ] Running that tour produces artifacts in `/tourkit/artifacts/`
- [ ] Clean recording preset (`TOURKIT_CAPTURE=1`, `TOUR_OVERLAY=0`) produces video
