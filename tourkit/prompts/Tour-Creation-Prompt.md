CREATE/UPDATE TOURS (guide DSL → tour JSON + runner + per-tour commands + artifacts)

You are implementing the repeatable tour pipeline. This prompt will be used multiple times to create new tours.

You MUST read:
- /tourkit/maps/tour.map.json   (source of truth for anchors + routes + events)
- /tourkit/config/routes.json   (routeKey mapping)
- /tourkit/config/events.json   (canonical events)
All outputs MUST be saved under /tourkit/.

Goal:
Given a guide file, generate a tour JSON (validated) and ensure it can be run via a dedicated npm script that produces organized artifacts (screenshots + video + trace) under /tourkit/artifacts/.

Non-negotiable: Guide DSL (strict)
Guides are “English + explicit anchors/events.” Every actionable line MUST specify either:
- an anchor in parentheses: (tour.…)
- or an event: (tour.event.…)
Examples:
- Say: Welcome to ViewBait.
- Goto routeKey: auth
- Click Open Studio (tour.home.hero.cta.openStudio)
- Fill Email (tour.auth.form.input.email) env:E2E_EMAIL
- Fill Password (tour.auth.form.input.password) env:E2E_PASSWORD
- Click Login (tour.auth.form.btn.submit)
- Wait for Auth Success (tour.event.auth.success) timeout:30000
- Click Manual (tour.studio.create.tabs.tab.manual)
- Snapshot After Manual Selected name:manual-selected
If a line does not include an anchor/event where appropriate, FAIL loudly and tell the user how to fix the guide.

A) Folder layout (create if missing)
- /tourkit/schema/
- /tourkit/guides/
- /tourkit/tours/
- /tourkit/runner/
- /tourkit/artifacts/
- /tourkit/scripts/
- /tourkit/docs/

B) Tour schema
Create/Update: /tourkit/schema/tour.schema.json
Step types (strict):
- say
- goto (routeKey)
- click (anchor)
- fill (anchor, value/valueEnv)
- expectVisible (anchor)
- waitForEvent (name, timeoutMs)
- waitMs
- snapshot (name)
Validate:
- anchor must start with "tour."
- event must start with "tour.event."

C) Runner
Create/Update: /tourkit/runner/runTour.ts
- Loads /tourkit/maps/tour.map.json
- Resolves goto routeKey → path
- Resolves anchor → locator(`[data-tour="${anchor}"]`).first()
- safeClick: MUST require visible before scrollIntoViewIfNeeded before click (avoid hang)
- waitForEvent: listen for window CustomEvent (tour.event.*) and return detail
- snapshot: writes PNG to /tourkit/artifacts/<tourId>/<timestamp>/screens/<stepIndex>_<name>.png
- logs: write /tourkit/artifacts/<tourId>/<timestamp>/runlog.txt
- copy Playwright video + trace:
  Use testInfo.outputDir (from harness) to find video.webm / trace.zip and copy them into the same artifact folder.

D) Playwright harness test
Create/Update: /tests/e2e/tourkit.spec.ts
- Reads TOUR_FILE env var (required)
- Infers tourId from filename
- Sets test tags:
  - @tourkit
  - @tour:<tourId>
- Uses runTour(page, tour, { artifactDir, testInfo }) where artifactDir is under /tourkit/artifacts/

E) Guide → Tour generator
Create/Update: /tourkit/scripts/generate-tour-from-guide.ts
- Input: /tourkit/guides/<tourId>.md
- Output: /tourkit/tours/<tourId>.tour.json
- Validates every referenced anchor exists in /tourkit/maps/tour.map.json
- Validates every referenced event exists in /tourkit/maps/tour.map.json (events list)
- Writes actionable errors listing unknown anchors/events and suggesting nearest matches.

F) Per-tour npm scripts (safe edits)
Update package.json scripts:
- Add (only if missing; never delete/overwrite existing scripts):
  - "tour:<tourId>": "cross-env TOUR_FILE=tourkit/tours/<tourId>.tour.json playwright test tests/e2e/tourkit.spec.ts --grep @tour:<tourId> --headed"
  - "tour:<tourId>:ci": "cross-env TOUR_FILE=tourkit/tours/<tourId>.tour.json playwright test tests/e2e/tourkit.spec.ts --grep @tour:<tourId>"
Also ensure these exist:
- "tour:all": "playwright test tests/e2e/tourkit.spec.ts --grep @tourkit"
- "tourkit:gen": "node tourkit/scripts/generate-tour-from-guide.ts"  (accepts guide path arg)

G) Artifacts
Ensure each run produces:
- /tourkit/artifacts/<tourId>/<YYYYMMDD-HHmmss>/
  - screens/*.png
  - video.webm (copied)
  - trace.zip (copied if exists)
  - runlog.txt

H) Create or update ONE concrete tour from an existing guide
If /tourkit/guides/first-thumbnail.md does not exist, create it using the DSL and the anchors from /tourkit/maps/tour.map.json.
Then generate /tourkit/tours/first-thumbnail.tour.json and verify it runs.

Constraints:
- Tours MUST NOT contain text selectors.
- If an anchor is missing, do not “guess”; fail with a helpful message.
- All outputs under /tourkit/.
