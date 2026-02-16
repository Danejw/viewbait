# Failure Summary

Tour: first-thumbnail
Run: 2026-02-16T04-48-59

## Attempts
1. 2026-02-16T04-45-46 — failed at Step 8 (`Wait for Auth Success`) timeout waiting for `tour.event.auth.success`.
2. 2026-02-16T04-46-56 — failed at Step 8 (`Wait for Auth Success`) timeout waiting for `tour.event.auth.success`.
3. 2026-02-16T04-47-37 — failed at Step 8 (`Wait for Auth Success`) timeout waiting for `tour.event.auth.success`.
4. 2026-02-16T04-48-17 — failed at Step 8 (`Wait for Auth Success`) timeout waiting for `tour.event.auth.success`.
5. 2026-02-16T04-48-59 — failed at Step 8 (`Wait for Auth Success`) timeout waiting for `tour.event.auth.success`.

## Failing step
Step 8: waitForEvent — `tour.event.auth.success`

## Error
`page.waitForFunction: Test timeout of 30000ms exceeded.`

## Diagnosis
Root cause is an **environment auth backend failure** rather than a TourKit parser/runner issue. Submitting the auth form returns visible UI error text: `Failed to fetch` for the supplied `E2E_EMAIL`/`E2E_PASSWORD`, so no successful session is established and `tour.event.auth.success` never emits.

## Root cause classification
- **Environment issue** (missing or invalid backend auth connectivity/config for this local app run)

## Exact changes needed to make this pass
1. Ensure app auth backend configuration is valid in local runtime env (Supabase URL/key and network reachability from Next app).
2. Ensure `tourkit/.env.tourkit` contains credentials for an existing test account in that backend.
3. Re-run: `npm run tour:first-thumbnail:ci`

## Notes
- Tour guide, generated JSON, map generation, and script wiring succeeded.
- Failures are consistently at login event wait, before studio steps begin.
