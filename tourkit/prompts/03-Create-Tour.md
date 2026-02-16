# PROMPT 03 — CREATE TOUR (repeatable)

You are creating a new tour from a guide file. This prompt is designed to be run MULTIPLE TIMES, once for each tour you want to create (e.g., "first-thumbnail", "custom-instructions", "advanced-settings").

Each run produces a validated, passing tour with organized artifacts.

## Pre-flight (required, every time)

### 1) Verify infrastructure exists

Check that ALL of these files exist. If any are missing, STOP and tell the user which prompt to run.

| File | Created by |
|---|---|
| `/tourkit/config/routes.json` | Prompt 01 |
| `/tourkit/config/events.json` | Prompt 01 |
| `/tourkit/maps/tour.map.json` | Prompt 02C |
| `/tourkit/schema/tour.schema.json` | Prompt 02A |
| `/tourkit/runner/runTour.ts` | Prompt 02A |
| `/tourkit/scripts/generate-tour-from-guide.ts` | Prompt 02A |
| `/tests/e2e/tourkit.spec.ts` | Prompt 02A |
| `playwright.config.*` with dotenv loading | Prompt 00 |

### 2) Verify env is ready

Load `/tourkit/.env.tourkit` via dotenv and confirm:
- `E2E_EMAIL` is set and is not the placeholder value
- `E2E_PASSWORD` is set and is not the placeholder value

If missing, print the exact fix steps and STOP:
```
1. Copy tourkit/.env.tourkit.example to tourkit/.env.tourkit
2. Edit tourkit/.env.tourkit
3. Fill in E2E_EMAIL and E2E_PASSWORD with real test credentials
4. Rerun this prompt
```

### 3) Verify the map is current

Check when `/tourkit/maps/tour.map.json` was last modified. If it is older than the most recently modified component file in the app, warn:

```
Warning: tour.map.json may be stale. Consider running: npm run tourkit:map
```

If the map has ZERO anchors for any route in the primary flow, STOP and instruct the user to run `npm run tourkit:map` with the app running.

### 4) Determine which tour to create

The tour to create is specified by ONE of:
- A guide file path passed as context (e.g., "Create a tour from tourkit/guides/first-thumbnail.md")
- A tour ID mentioned in the conversation (e.g., "Create the custom-instructions tour")
- If neither is provided, check `/tourkit/config/routes.json` for `plannedTours` and ask which one to create

---

## Guide DSL reference

Every guide is a markdown file where each non-empty, non-comment line is one tour step. The tourId is inferred from the filename (e.g., `first-thumbnail.md` -> tourId `first-thumbnail`).

### Step types

```
# This is a comment (ignored)

Say: <message text>
Goto routeKey: <routeKey>
Click <human label> (<tour.anchor.name>)
Fill <human label> (<tour.anchor.name>) value:<literal string>
Fill <human label> (<tour.anchor.name>) env:<ENV_VAR_NAME>
Expect visible <human label> (<tour.anchor.name>)
Expect visible <human label> (<tour.anchor.name>) timeout:<ms>
Wait for <human label> (<tour.event.name>) timeout:<ms>
Wait <N>ms
Snapshot <human label> name:<filename_without_extension>
Include fragment: <fragment_name>
Pause <N>ms name:<label>
```

### Rules

- Every actionable line MUST include an anchor `(tour.*)` or event `(tour.event.*)` in parentheses
- Anchors MUST start with `tour.`
- Events MUST start with `tour.event.`
- `env:` references pull from `process.env` at runtime
- `timeout:` is optional, defaults to 10000ms
- `Include fragment:` inlines the contents of `/tourkit/guides/_fragments/<fragment_name>.md`
- `Pause` is like `Wait` but also takes a screenshot (useful for video captures where you want a held frame)
- Lines starting with `#` are comments
- Empty lines are ignored

### Example guide

```markdown
# first-thumbnail.md — Create your first thumbnail

Include fragment: login

Say: Welcome! Let's create your first thumbnail.
Goto routeKey: studio.create
Wait for Studio Ready (tour.event.route.ready) timeout:15000
Snapshot Studio loaded name:studio-ready

Click Manual Tab (tour.studio.create.tab.manual)
Fill Title (tour.studio.create.form.input.title) value:My First Thumbnail
Snapshot Title filled name:title-filled

Click Generate (tour.studio.create.form.btn.generate)
Wait for Generation Complete (tour.event.thumbnail.generation.complete) timeout:60000
Snapshot Results name:generation-complete

Say: Your thumbnails are ready!
```

---

## Step A — Create or locate the guide

### If a guide already exists at `/tourkit/guides/<tourId>.md`:
- Read it and proceed to Step B.

### If no guide exists:
- Create one using the DSL, informed by:
  - The anchors and events available in `/tourkit/maps/tour.map.json`
  - The routes in `/tourkit/config/routes.json`
  - The fragments in `/tourkit/guides/_fragments/`
  - The user's description of what the tour should demonstrate

- Write the guide to `/tourkit/guides/<tourId>.md`

### Identifying needed but missing anchors

While writing the guide, if you need an anchor that does NOT exist in the map:

1. Search the app's source code to find the element you want to anchor
2. If the element exists but has no `data-tour` attribute:
   - Add the `data-tour` attribute to the element (follow naming grammar from `/tourkit/docs/NAMING.md`)
   - Add the anchor to the ANCHOR_EVENT_PLAN.md
   - Note the addition in the guide file as a comment: `# Added anchor: tour.studio.create.form.input.customInstructions`
3. If the element doesn't exist (the feature isn't built yet):
   - Note this in the guide as a comment: `# BLOCKED: tour.studio.create.form.input.customInstructions — element does not exist yet`
   - Skip this step in the guide for now
4. After adding any new anchors, regenerate the map: `npm run tourkit:map`

**Never guess or fabricate anchors. Every anchor in the guide must resolve to a real DOM element.**

---

## Step B — Generate tour JSON

Run the generator:

```
npm run tourkit:gen -- tourkit/guides/<tourId>.md
```

Or if the script doesn't accept args cleanly, run directly:

```
tsx tourkit/scripts/generate-tour-from-guide.ts tourkit/guides/<tourId>.md
```

This should:
1. Parse the guide
2. Resolve all `Include fragment:` directives
3. Validate all anchors against the map
4. Validate all events against events.json
5. Validate all routeKeys against routes.json
6. Write `/tourkit/tours/<tourId>.tour.json`

If validation fails:
- Read the errors carefully
- Fix the guide (wrong anchor name, missing fragment, etc.)
- Rerun the generator
- Do NOT bypass validation

---

## Step C — Add npm scripts for this tour

Add these to `package.json` scripts (ONLY if they don't already exist):

```json
{
  "tour:<tourId>": "cross-env TOUR_FILE=tourkit/tours/<tourId>.tour.json playwright test tests/e2e/tourkit.spec.ts --grep @tour:<tourId> --headed",
  "tour:<tourId>:ci": "cross-env TOUR_FILE=tourkit/tours/<tourId>.tour.json playwright test tests/e2e/tourkit.spec.ts --grep @tour:<tourId>"
}
```

Replace `<tourId>` with the actual tour ID (e.g., `first-thumbnail`).

Also ensure these general scripts exist:
```json
{
  "tour:all": "playwright test tests/e2e/tourkit.spec.ts --grep @tourkit"
}
```

---

## Step D — VERIFY LOOP (mandatory, no exceptions)

You MUST run the tour and make it pass. Do not skip this step.

### Pre-check: Is the app reachable?

Before running the tour, verify the app will be available:
- Check if `webServer` is configured in `playwright.config.*` (it should be from Prompt 00)
- If webServer is configured, Playwright will start it automatically
- If not, start the app manually first

### Run the tour

```
npm run tour:<tourId>:ci
```

### If it PASSES:

1. Confirm artifacts exist in `/tourkit/artifacts/<tourId>/<timestamp>/`:
   - `screens/` directory with screenshots
   - `runlog.txt` with step-by-step log
   - `video.webm` (if TOURKIT_CAPTURE=1)
   - `trace.zip` (if available)

2. Write `/tourkit/artifacts/<tourId>/LATEST.md`:
   ```markdown
   # Tour: <tourId> — PASS
   
   Last successful run: <timestamp>
   Artifacts: tourkit/artifacts/<tourId>/<timestamp>/
   
   Run command: npm run tour:<tourId>
   CI command:  npm run tour:<tourId>:ci
   ```

3. STOP. Tour is complete.

### If it FAILS:

1. **Collect evidence:**
   - The Playwright error output (step number, error message)
   - `/tourkit/artifacts/<tourId>/<timestamp>/runlog.txt` (if it exists)
   - Any screenshots or video captured before failure

2. **Write failure summary** to `/tourkit/artifacts/<tourId>/<timestamp>/failure-summary.md`:
   ```markdown
   # Failure Summary
   
   Tour: <tourId>
   Run: <timestamp>
   
   ## Failing step
   Step <N>: <type> — <anchor or event>
   
   ## Error
   <raw error message>
   
   ## Diagnosis
   <your analysis of why it failed>
   
   ## Fix
   <the exact change you will make>
   ```

3. **Apply the fix.** You are allowed to change:

   | Allowed | Not allowed |
   |---|---|
   | Guide file (wrong anchors, missing waits) | Replacing anchors with text selectors |
   | Generator (parsing bugs) | Silent "best guess" anchor substitutions |
   | Runner (robustness: detach handling, timeouts) | Modifying app business logic |
   | Harness (file loading, tagging) | Removing validation |
   | npm scripts (TOUR_FILE path issues) | Infinite retry loops |
   | Adding missing `data-tour` attributes to app components | Deleting or weakening tests |
   | Adding missing event emissions | |
   | TourKit docs (if a setup step was missing) | |

4. **Rerun**: `npm run tour:<tourId>:ci`

5. **Repeat** up to a maximum of **5 retries**.

### After 5 retries (still failing):

STOP. Do not loop further. Write a final diagnosis:

1. Update the failure summary with all 5 attempts
2. Identify the ROOT CAUSE (not just symptoms)
3. List the exact changes needed (file, line, what to change)
4. Note whether the issue is:
   - A TourKit bug (runner, generator, harness)
   - A missing anchor/event (needs 02B work)
   - An app issue (timing, auth, rendering)
   - An environment issue (env vars, app not running)

---

## Step E — Quality checks

If the tour passes, verify these quality-of-life requirements:

### Error messages are actionable

Test by temporarily breaking things:
- Remove `E2E_EMAIL` from env -> Does the error tell the user exactly what to do?
- Reference a non-existent anchor in the guide -> Does the error show nearest matches?
- Reference a non-existent routeKey -> Does the error list valid routeKeys?

### Logging is useful

Check `runlog.txt` for:
- Every step logged with index, type, anchor/event, current URL
- Timestamps on each step
- Clear error messages on failures

### Artifacts are organized

Confirm the directory structure:
```
/tourkit/artifacts/<tourId>/<timestamp>/
  screens/
    00_studio-ready.png
    01_title-filled.png
    ...
  runlog.txt
  video.webm (if captured)
  trace.zip (if captured)
```

---

## Multi-tour notes

When running this prompt for a SECOND or subsequent tour:

1. **Fragments are already in place** from the first tour (e.g., login fragment). Reuse them.
2. **New anchors may be needed** for features not covered by Tour #1. Follow the "identifying needed but missing anchors" process in Step A.
3. **Regenerate the map** after adding new anchors: `npm run tourkit:map`
4. **Each tour gets its own npm scripts**, artifacts directory, and guide file.
5. **`tour:all` runs ALL tours** tagged `@tourkit`.

---

## Deliverables checklist (must exist when done)

- [ ] `/tourkit/guides/<tourId>.md` (guide file)
- [ ] `/tourkit/tours/<tourId>.tour.json` (generated, validated tour)
- [ ] `package.json` has `tour:<tourId>` and `tour:<tourId>:ci` scripts
- [ ] `/tests/e2e/tourkit.spec.ts` harness runs this tour
- [ ] `/tourkit/artifacts/<tourId>/` contains at least one run's artifacts
- [ ] Tour PASSES or a detailed failure-summary.md exists with exact next steps
- [ ] Any new anchors added to app code are also added to ANCHOR_EVENT_PLAN.md
- [ ] Map regenerated if new anchors were added

---

## Save this prompt

Save THIS EXACT PROMPT verbatim into:

```
/tourkit/prompts/03-Create-Tour.md
```
