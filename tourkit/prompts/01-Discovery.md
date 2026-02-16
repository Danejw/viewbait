# PROMPT 01 — DISCOVERY: Write the Contract

You are working inside this repo. Goal: create a reusable TourKit contract that makes Playwright tours stable by introducing:

- Stable anchors (`data-tour` attributes)
- Explicit events (`window.dispatchEvent(new CustomEvent(...))`)
- Machine-readable config files that subsequent prompts consume
- A multi-tour plan identifying shared flows (fragments) and individual tours

Everything MUST live under `/tourkit/` and be organized. You MUST save every output file to an explicit path.

## Pre-flight (required)

Before doing anything, verify these files exist from Prompt 00:
- `/tourkit/docs/PURPOSE.md`
- `/tourkit/docs/BOOTSTRAP.md`
- `/tourkit/.env.tourkit.example`
- `playwright.config.*` with dotenv loading

If any are missing, STOP and tell the user to run Prompt 00 first.

Then read:
- `package.json` (understand the app)
- The app's routing structure (pages/routes directory)
- The app's auth flow (how login works)
- Key UI components (forms, buttons, modals)

---

## Non-negotiable naming conventions

### A) Anchor attribute: `data-tour="..."`

Every anchor MUST start with `tour.`

### B) Anchor grammar (strict):

```
tour.<route>.<area>.<type>.<name>[.<variant>]
```

| Segment | Meaning | Examples |
|---|---|---|
| `<route>` | Stable route key (NOT literal path) | `home`, `auth`, `studio.create`, `results` |
| `<area>` | Page section or component | `hero`, `nav`, `form`, `sidebar`, `modal`, `grid`, `toolbar` |
| `<type>` | Element type (from allowed list) | `cta`, `btn`, `input`, `select`, `tab`, `card`, `text` |
| `<name>` | Stable identifier | `openStudio`, `email`, `password`, `submit`, `generate` |
| `<variant>` | Optional qualifier | `16_9`, `1k`, `manual` |

**Allowed `<type>` values** (exhaustive):
`cta`, `btn`, `input`, `select`, `tab`, `card`, `grid`, `item`, `modal`, `chip`, `toggle`, `text`, `link`, `label`, `container`, `image`, `badge`, `progress`

### C) Event naming

Events MUST start with `tour.event.`

```
tour.event.<domain>.<name>
```

| Segment | Meaning | Examples |
|---|---|---|
| `<domain>` | Feature area | `route`, `auth`, `studio`, `thumbnail`, `modal`, `results` |
| `<name>` | Lifecycle point | `ready`, `success`, `started`, `complete`, `opened`, `closed`, `failed` |

---

## Your tasks

### 1) Identify ALL user-facing flows worth touring

Inspect the app and identify every flow that would make a useful tour. Think about:
- First-time user onboarding (the critical path)
- Individual feature demonstrations (custom instructions, aspect ratio settings, etc.)
- Key workflows (create thumbnail, view results, etc.)

For each flow, write a one-line description and estimate which routes it touches.

### 2) Identify shared flows (fragments)

Look for flow segments that appear in multiple tours. The most common example is login:

```
home -> auth -> login -> [authenticated state]
```

Any flow segment used by 2+ tours becomes a **fragment**. Fragments live in `/tourkit/guides/_fragments/` and can be included in any guide.

### 3) Choose stable routeKeys

For each route/page involved in ANY planned tour, choose a stable `routeKey`. The routeKey must be:
- Short and descriptive
- Stable (won't change if the URL structure changes)
- Dot-separated for nested routes (`studio.create`, `studio.results`)

### 4) List MINIMUM anchors per route

For each route, list the minimum anchors needed so tours never rely on text selectors. Focus on:
- Interactive elements (buttons, inputs, tabs, selects)
- Navigation targets (CTAs, links)
- Key content areas (result grids, status indicators)
- Elements that tours need to verify exist

### 5) Identify events

For each async wait point, define an event. Do NOT use DOM polling for:
- Route transitions (use `tour.event.route.ready`)
- Auth completion (use `tour.event.auth.success`)
- Generation/processing completion (use appropriate domain events)
- Modal open/close (use `tour.event.modal.opened` / `tour.event.modal.closed`)

### 6) Note implementation locations

For each anchor and event, note WHERE in the codebase it should be added (file path and approximate location). This makes Prompt 02B dramatically easier.

---

## Required output files

### `/tourkit/docs/ANCHOR_EVENT_PLAN.md`

Include:
- The naming rules (anchor grammar, event grammar, allowed types)
- Multi-tour plan: list ALL identified tours with one-line descriptions
- Fragment identification: which flow segments are shared
- Per-route anchor table:

  ```
  ## Route: auth (path: /auth)

  | Anchor | Element | Notes |
  |---|---|---|
  | tour.auth.form.input.email | Email input field | Used in login fragment |
  | tour.auth.form.input.password | Password input field | Used in login fragment |
  | tour.auth.form.btn.submit | Login/Submit button | Used in login fragment |
  ```

- Per-event table:

  ```
  | Event | When to emit | Payload | Implementation location |
  |---|---|---|---|
  | tour.event.auth.success | After successful login, before redirect | `{ userId }` | auth callback/handler |
  ```

- Implementation notes: for each anchor/event, the file path where it should be added

### `/tourkit/config/routes.json`

Format (strict):
```json
{
  "routes": [
    { "routeKey": "home", "path": "/" },
    { "routeKey": "auth", "path": "/auth" },
    { "routeKey": "studio.create", "path": "/studio" }
  ],
  "primaryFlow": "first-thumbnail",
  "plannedTours": [
    {
      "tourId": "first-thumbnail",
      "description": "Create your first thumbnail end-to-end",
      "routes": ["home", "auth", "studio.create", "results"],
      "fragments": ["login"]
    },
    {
      "tourId": "custom-instructions",
      "description": "How to use custom instructions for better thumbnails",
      "routes": ["auth", "studio.create"],
      "fragments": ["login"]
    }
  ]
}
```

Use REAL paths from the app. Do not guess; inspect the repo's routing.

### `/tourkit/config/events.json`

Format (strict):
```json
{
  "events": [
    {
      "name": "tour.event.route.ready",
      "description": "Fired when a route's key anchors are present and the page is interactive",
      "payloadExample": { "routeKey": "auth", "anchorsPresent": ["tour.auth.form.input.email"] }
    },
    {
      "name": "tour.event.auth.success",
      "description": "Fired after successful authentication",
      "payloadExample": { "userId": "..." }
    }
  ]
}
```

### `/tourkit/docs/NAMING.md`

Include:
- Anchor grammar with 5+ concrete examples from this app
- The complete allowed `<type>` list with one-line descriptions
- Event grammar with examples
- Do/Don't rules:
  - DO: anchor the interactive element itself (not a wrapper)
  - DO: emit `tour.event.route.ready` after anchors are present and page is interactive
  - DO: use `tour.event.*` waits instead of DOM polling for async operations
  - DON'T: use text selectors in tours
  - DON'T: poll DOM for generation completion if you can emit an event
  - DON'T: use duplicate anchors on the same page (each anchor must be unique per route)
  - DON'T: anchor elements that are only sometimes rendered without noting the condition

### `/tourkit/guides/_fragments/login.md`

Create the login fragment guide using the DSL (this will be reused by every authenticated tour):

```markdown
# Fragment: login

Say: Logging in to the app.
Goto routeKey: auth
Fill Email (tour.auth.form.input.email) env:E2E_EMAIL
Fill Password (tour.auth.form.input.password) env:E2E_PASSWORD
Click Login (tour.auth.form.btn.submit)
Wait for Auth Success (tour.event.auth.success) timeout:30000
```

Use the ACTUAL anchors and events you defined. Do not use placeholder names.

---

## Constraints

- Do NOT implement code changes in this prompt. Only discovery and writing config/doc files.
- Everything saved under `/tourkit/`.
- Use real file paths from the repo (inspect, don't guess).
- If you are unsure about a route or component, note the uncertainty explicitly rather than guessing.

---

## Save this prompt

Save THIS EXACT PROMPT verbatim into:

```
/tourkit/prompts/01-Discovery.md
```

Create the folder if it does not exist. Do not paraphrase. Save verbatim.
