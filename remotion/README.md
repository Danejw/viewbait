# ViewBait promo video (Remotion)

One-minute (~60s) promo that introduces ViewBait: problem → solution → features → social proof → CTA. Built from the original ViewBaitPromoVideo JSX, converted to Remotion with frame-based sequencing and optional sound effects.

## Quick start

```bash
# From viewbait/
npm run remotion:studio
```

Then pick the **ViewBaitPromo** composition and press Play.

## Render to file

```bash
# From viewbait/
npx remotion render ViewBaitPromo viewbait-promo.mp4
```

Optional: specify codec, quality, or image sequence; see [Remotion CLI](https://www.remotion.dev/docs/cli).

## Structure

- **`index.ts`** – Entry point; registers the root.
- **`Root.tsx`** – Registers the `ViewBaitPromo` composition (duration, fps, dimensions).
- **`ViewBaitPromo.tsx`** – Main composition: `<Series>` of 30 cards, progress bar, optional SFX.
- **`PromoCard.tsx`** – Renders a single card; all motion uses `useCurrentFrame()` / `interpolate` / `spring` (no CSS animations).
- **`cardData.ts`** – Card content and per-card duration in frames (~60s total at 30fps).

## Sound effects

SFX are off by default. To enable:

1. Add a short sound file at `public/sfx/transition.mp3` (e.g. a 0.2–0.5s whoosh or tick).
2. In `ViewBaitPromo.tsx`, set `ENABLE_SFX = true`.

See `public/sfx/README.md` for details.

## Dimensions

Default composition is **1080×1920** (portrait). Change `width` and `height` in `Root.tsx` if you want landscape (e.g. 1920×1080).
