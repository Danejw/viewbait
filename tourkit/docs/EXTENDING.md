# Extending TourKit

## Add a new step type

You must update three places together.

1. **Schema**

- File: `tourkit/schema/tour.schema.json`
- Add a new `oneOf` variant for your step.

2. **Generator output type (optional but recommended)**

- File: `tourkit/scripts/generate-tour-from-guide.ts`
- Extend `TourStep` union and parsing logic.

3. **Runner execution**

- File: `tourkit/runner/runTour.ts`
- Extend `TourStep` union and `switch(step.type)` behavior.

Example: add `pressKey`

- Schema entry:
  - `{ "type": "pressKey", "key": "Enter" }`
- Runner implementation:
  - `await page.keyboard.press(step.key)`
- Guide parser support:
  - parse lines like `Press Key key:Enter`

## Add a new app event end-to-end

1. Add event name to canonical config:

- `tourkit/config/events.json`

2. Emit in app runtime:

- call `emitTourEvent("tour.event.<domain>.<name>", detail)` from relevant component/state transition.

3. Regenerate map:

```bash
npm run tourkit:map
```

4. Use in guide DSL:

```text
Wait for My Event (tour.event.<domain>.<name>) timeout:30000
```

5. Regenerate tour JSON:

```bash
npm run tourkit:gen tourkit/guides/<tourId>.md
```

## Add CI checks (optional)

Recommended CI sequence:

```bash
npm run tourkit:map
npm run tourkit:doctor
npm run tour:first-thumbnail:ci
```

If browser binaries are not baked into CI image, include:

```bash
npx playwright install
```

## Port TourKit to another repo

### Option A: copy folder approach

- Copy `tourkit/` directory and `tests/e2e/tourkit.spec.ts`.
- Install deps used by scripts/runner (`@playwright/test`, `tsx`, `cross-env`).
- Add scripts in `package.json`.
- Add app-specific anchors/events and refresh map.

### Option B: internal package approach

- Publish `runner + schema + generator` as internal package.
- Keep app-specific `config/`, `maps/`, `guides/`, and anchor/event wiring in each app repo.

In both options, keep prefix contract unchanged (`tour.` + `tour.event.`).
