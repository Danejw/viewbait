# PROMPT 02B — INSTRUMENT THE APP

You are adding `data-tour` anchors and `tour.event.*` emissions to the app's existing components. This is the only prompt that modifies production app code. Work carefully, route by route, verifying as you go.

## Pre-flight (required)

Read ALL of these before modifying any app code:

- `/tourkit/docs/ANCHOR_EVENT_PLAN.md` — this is your primary reference for WHAT to add WHERE
- `/tourkit/config/routes.json` — route paths
- `/tourkit/config/events.json` — events to emit
- `/tourkit/app/tourEvents.browser.ts` — the `emitTourEvent` helper you'll import
- `/tourkit/app/TourOverlay.tsx` — the overlay you'll mount
- `package.json` (understand the app framework)

If `/tourkit/docs/ANCHOR_EVENT_PLAN.md` does not exist, STOP and tell the user to run Prompt 01 first.
If `/tourkit/app/tourEvents.browser.ts` does not exist, STOP and tell the user to run Prompt 02A first.

---

## Principles

1. **Minimal changes**: Add only `data-tour` attributes and `emitTourEvent()` calls. Do not refactor, restyle, or restructure existing components.

2. **No behavioral changes**: Adding a `data-tour` attribute to a `<button>` must not change how the button works. Adding an event emission after login must not change the login flow.

3. **SSR safety**: `emitTourEvent()` is already SSR-safe (no-ops on server). But when adding event emissions in server components or server actions, make sure the call happens client-side (in an effect, callback, or client component).

4. **One route at a time**: Instrument each route in the order listed in the primary flow, verifying after each one before moving to the next.

---

## Step 1 — Mount the Tour Overlay

Add the `TourOverlay` component to the app's root layout (or equivalent app shell).

**Rules:**
- Import from `/tourkit/app/TourOverlay`
- The component already guards itself with `isTourMode()`, so you don't need to add conditional logic in the layout
- Place it at the END of the layout's children (so it renders on top of everything)
- If the app uses Next.js App Router, add it to `app/layout.tsx`
- If the app uses Pages Router, add it to `_app.tsx`

**Verify**: Start the app with `?tour=1` in the URL. You should see the overlay UI (even if no anchors exist yet, the toggle button should appear).

---

## Step 2 — Instrument route by route

Work through each route in the primary flow order from `/tourkit/docs/ANCHOR_EVENT_PLAN.md`.

For each route:

### A) Add `data-tour` attributes

Open the component file(s) for this route. For each anchor listed in the plan:

```tsx
// Before:
<button onClick={handleLogin}>Sign In</button>

// After:
<button data-tour="tour.auth.form.btn.submit" onClick={handleLogin}>Sign In</button>
```

**Rules:**
- Add the attribute to the INTERACTIVE element (the `<button>`, `<input>`, `<a>`), NOT a wrapper `<div>`
- For `<input>` elements, add it directly: `<input data-tour="tour.auth.form.input.email" ... />`
- If the element is rendered by a third-party component that doesn't forward props, wrap it in a `<div data-tour="...">` as a fallback and note this in the plan
- Every anchor in the plan for this route MUST be added. If you can't find the right element, note it explicitly

### B) Add event emissions

For each event listed in the plan for this route:

```tsx
import { emitTourEvent } from "@/tourkit/app/tourEvents.browser";

// After successful login:
emitTourEvent("tour.event.auth.success", { userId: user.id });
```

**Rules:**
- Import `emitTourEvent` from the TourKit helper
- Place the emission at the correct lifecycle point (after success, after render, etc.)
- For `tour.event.route.ready`: emit AFTER the route's key anchors are rendered and the page is interactive. In React, this typically means inside a `useEffect` with appropriate dependencies.

### C) Emit `tour.event.route.ready`

Every instrumented route should emit `tour.event.route.ready` when its key anchors are present. This is how tours know the page is ready for interaction.

```tsx
useEffect(() => {
  emitTourEvent("tour.event.route.ready", {
    routeKey: "auth",
    anchorsPresent: ["tour.auth.form.input.email", "tour.auth.form.input.password"]
  });
}, []); // empty deps = fire once on mount
```

### D) Verify this route

After instrumenting each route:

1. Start the app (if not already running)
2. Visit the route with `?tour=1` in the URL
3. Confirm the overlay shows the expected anchors with correct labels
4. If any anchor is missing or misplaced, fix it before moving on

**If a component change causes a render error:**
- Revert that specific file immediately
- Document what went wrong
- Try an alternative approach (different element, wrapper, etc.)
- Do NOT leave broken code and move on

---

## Step 3 — Verify full flow manually

After all routes are instrumented:

1. Start the app
2. Visit the home page with `?tour=1`
3. Walk through the primary flow manually (click through home -> auth -> create -> etc.)
4. At each route, confirm anchors appear in the overlay
5. Open browser console and confirm events fire (look for `tour.event.*` in the console or use the event buffer)

Note any issues found in `/tourkit/docs/INSTRUMENT_LOG.md` (create this file):
- Which routes were instrumented
- Which anchors were added
- Any anchors from the plan that could not be added (and why)
- Any events that needed special handling

---

## Constraints

- ONLY add `data-tour` attributes and `emitTourEvent()` calls
- Do NOT refactor existing code
- Do NOT change existing styling
- Do NOT change existing behavior
- Do NOT add new dependencies (the helpers from 02A are sufficient)
- If you need to import `emitTourEvent`, use the appropriate import path for this repo's module resolution (check how existing imports work)

---

## Deliverables checklist

- [ ] TourOverlay mounted in app layout
- [ ] All anchors from ANCHOR_EVENT_PLAN.md added to their respective components
- [ ] All events from events.json emitting at the correct lifecycle points
- [ ] `tour.event.route.ready` emitting on each instrumented route
- [ ] `/tourkit/docs/INSTRUMENT_LOG.md` documenting what was done
- [ ] No render errors or broken functionality

---

## Save this prompt

Save THIS EXACT PROMPT verbatim into:

```
/tourkit/prompts/02B-Instrument.md
```
