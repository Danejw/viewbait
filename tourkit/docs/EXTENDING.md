# Extending TourKit

See [ARCHITECTURE.md](./ARCHITECTURE.md) for system overview and [REFERENCE.md](./REFERENCE.md) for exact DSL/schema details.

## Add a new step type (example: `assertText`)

To add a new step type end-to-end, update all three layers:

1. **Schema** — `tourkit/schema/tour.schema.json`
   - Add a `oneOf` variant for:
   ```json
   {
     "type": "object",
     "properties": {
       "type": { "const": "assertText" },
       "anchor": { "type": "string" },
       "text": { "type": "string" }
     },
     "required": ["type", "anchor", "text"],
     "additionalProperties": true
   }
   ```

2. **Generator parser** — `tourkit/scripts/generate-tour-from-guide.ts`
   - Extend DSL parsing to accept a line like:
   ```text
   Assert text <label> (<tour.anchor>) value:<expected>
   ```
   - Emit JSON step: `{ "type": "assertText", "anchor": "...", "text": "..." }`.

3. **Runner** — `tourkit/runner/runTour.ts`
   - Add step handling in `runStep`:
   - Locate anchor selector and assert text content with Playwright expect.

4. **Docs + examples**
   - Update `REFERENCE.md` DSL section and add at least one guide example.

## Add a new event

1. Add event metadata to `tourkit/config/events.json`.
2. Emit event in app code with `emitTourEvent("tour.event.<domain>.<name>", payload)`.
3. Use event in guide `Wait for ... (tour.event.<domain>.<name>) timeout:<ms>`.
4. Regenerate map if anchors also changed:
   - `npm run tourkit:map`
5. Re-run doctor:
   - `npm run tourkit:doctor`

## Add a new fragment

1. Create `tourkit/guides/_fragments/<name>.md`.
2. Use it from guides:

```text
Include fragment: <name>
```

3. Re-generate affected tours via `npm run tourkit:gen -- ...`.

## Port TourKit to another repo

Checklist:

- Copy folders:
  - `tourkit/app`
  - `tourkit/config`
  - `tourkit/runner`
  - `tourkit/schema`
  - `tourkit/scripts`
  - `tourkit/docs`
- Copy harness:
  - `tests/e2e/tourkit.spec.ts`
  - `playwright.config.ts` env loading pattern
- Add scripts to `package.json`.
- Add env template and `.gitignore` entries:
  - ignore `tourkit/.env.tourkit`
  - commit `tourkit/.env.tourkit.example`
- Rebuild route/event plan for the new app and run map generation.

## Add CI integration

Recommended baseline:

1. Run headless CI command(s):
   - `npm run tour:first-thumbnail:ci`
   - or `npm run tour:all`
2. Ensure env vars are provided (`E2E_EMAIL`, `E2E_PASSWORD`, `PLAYWRIGHT_BASE_URL` if needed).
3. Upload `tourkit/artifacts/**` as CI artifacts on both success and failure.
4. Fail build on non-zero tour exit status.
5. Add failure notification with link to artifact bundle (`runlog.txt`, screenshots, trace/video when present).
