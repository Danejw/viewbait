# Failure Summary

Tour: first-thumbnail
Run: ATTEMPTS_1_TO_5

## Failing step
Step 0: Browser launch — Playwright Chromium executable missing before first test step executes.

## Error
Error: browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell

## Diagnosis
The tour cannot execute because this environment does not contain Playwright browser binaries. Installing with `npx playwright install chromium` is blocked by CDN policy (HTTP 403 Domain forbidden), so every retry fails before navigation.

## Attempts
1. `npm run tour:first-thumbnail:ci` -> failed at browser launch (missing executable).
2. `npm run tour:first-thumbnail:ci` -> same failure.
3. `npm run tour:first-thumbnail:ci` -> same failure.
4. `npm run tour:first-thumbnail:ci` -> same failure.
5. `npm run tour:first-thumbnail:ci` -> same failure.

## Root cause
Environment issue: Playwright runtime browser binaries are unavailable and cannot be downloaded from the current network.

## Fix
1. In an environment with Playwright CDN access, run:
   - `npx playwright install chromium`
2. Re-run:
   - `npm run tour:first-thumbnail:ci`
3. If CDN remains blocked, configure an internal mirror via `PLAYWRIGHT_DOWNLOAD_HOST` or provide a pre-bundled browser cache mounted at `~/.cache/ms-playwright`.

## Classification
- Issue type: Environment issue (browser provisioning/network policy)
- Not a TourKit parser/runner logic bug.
