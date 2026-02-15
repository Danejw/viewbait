# TourKit Workflows

## 1) Setup workflow (Prompts 1 -> 2)

### Prompt 1 (Discovery)

- Define route keys and flow in `tourkit/config/routes.json`.
- Define canonical events in `tourkit/config/events.json`.
- Document anchor/event plan in `tourkit/docs/ANCHOR_EVENT_PLAN.md`.

### Prompt 2 (Implementation)

- Add anchors in app code (`data-tour="tour...."`).
- Emit route + flow events (`tour.event....`).
- Add tour mode helpers + overlay under `tourkit/app/`.
- Generate map:

```bash
npm run tourkit:map
```

- Validate:

```bash
npm run tourkit:doctor
```

## 2) Tour creation workflow (Prompt 3 repeatable)

1. Write guide DSL:

```text
tourkit/guides/<tourId>.md
```

2. Generate tour JSON:

```bash
npm run tourkit:gen tourkit/guides/<tourId>.md
```

3. Add per-tour scripts in `package.json`:

- `tour:<tourId>`
- `tour:<tourId>:ci`

4. Run the tour:

```bash
npm run tour:<tourId>:ci
```

5. Inspect artifacts in:

```text
tourkit/artifacts/<tourId>/<timestamp>/
```

## 3) Docs workflow (Prompt 4)

- Refresh map first (`tourkit:map`).
- Update docs for any contract/runner/script change.
- Keep examples aligned with real `package.json` commands and real file paths.

## Common failure modes and fixes

### 1. Unknown anchor/event during `tourkit:gen`

- Cause: guide references value not in `tour.map.json`.
- Fix:
  - add anchor/event in app code,
  - run `npm run tourkit:map`,
  - rerun `npm run tourkit:gen ...`.

### 2. `TOUR_FILE` missing in Playwright harness

- Cause: launched `playwright test` without env.
- Fix: use `tour:<tourId>`/`tour:<tourId>:ci` scripts.

### 3. Browser executable missing

- Symptom: Playwright launch error.
- Fix:

```bash
npx playwright install
```

### 4. No artifacts copied

- Cause: trace/video not produced for that run.
- Fix:
  - ensure Playwright `use.video`/`use.trace` configured,
  - rerun test and inspect `testInfo.outputDir` outputs.

### 5. Doctor route checks warn about fetch/hydration

- Cause: app not reachable locally or anchors are client-rendered after initial HTML.
- Fix:
  - run app locally,
  - rerun doctor,
  - rely on runtime tour execution as final verification.
