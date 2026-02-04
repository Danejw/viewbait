# Sound effects for Remotion promo

Optional short sound effects play at the start of each card when enabled in the composition.

## Enabling SFX

1. Add a short (e.g. 0.2–0.5s) sound file here:
   - **`transition.mp3`** – plays on each card transition (tick, whoosh, or soft click).

2. In `remotion/ViewBaitPromo.tsx`, set:
   ```ts
   const ENABLE_SFX = true;
   ```

## Suggested sounds

- **transition.mp3**: Single “tick”, “whoosh”, or “slide” (e.g. from [freesound.org](https://freesound.org) or similar). Keep it short so the 60s video doesn’t get noisy.
- Use one file; the composition plays it at the start of each of the 30 cards (trimmed to ~0.2s per play).

## Without SFX

If you don’t add any files, leave `ENABLE_SFX = false` in `ViewBaitPromo.tsx`. The video renders and plays normally without sound effects.
