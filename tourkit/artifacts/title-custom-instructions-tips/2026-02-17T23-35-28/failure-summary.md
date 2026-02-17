# Failure Summary

Tour: title-custom-instructions-tips
Run: ATTEMPTS_1_TO_5

## Failing step
Step 0: Browser launch — Playwright Chromium executable missing before any tour step executes.

## Error
Error: browserType.launch: Executable doesn't exist at /root/.cache/ms-playwright/chromium_headless_shell-1208/chrome-headless-shell-linux64/chrome-headless-shell

## Diagnosis
The Playwright test process exits before tour execution because browser binaries are not present in this environment.

## Attempts
1. `npm run tour:title-custom-instructions-tips:ci` -> failed at browser launch.
2. `npm run tour:title-custom-instructions-tips:ci` -> failed at browser launch.
3. `npm run tour:title-custom-instructions-tips:ci` -> failed at browser launch.
4. `npm run tour:title-custom-instructions-tips:ci` -> failed at browser launch.
5. `npm run tour:title-custom-instructions-tips:ci` -> failed at browser launch.

## Root cause
Environment issue: Playwright browser download/install is blocked by network policy (CDN returns 403), so Chromium cannot be provisioned.

## Exact changes needed
1. Provide Playwright Chromium binary in CI/dev image, or allow download access.
2. Run `npx playwright install chromium` in a network that can access Playwright CDN (or set internal mirror with `PLAYWRIGHT_DOWNLOAD_HOST`).
3. Re-run: `npm run tour:title-custom-instructions-tips:ci`.

## Classification
- Environment issue (browser provisioning and network policy)
