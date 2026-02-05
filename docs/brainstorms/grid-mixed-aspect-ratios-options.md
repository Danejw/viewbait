# Grid Mixed Aspect Ratios – Options

## Context

The app currently favors **16:9** in all thumbnail grids:

- **ThumbnailCard**, **SharedGalleryCard**, and skeletons use hardcoded `aspect-video` (16:9).
- **ThumbnailGrid** uses `grid-cols-[repeat(auto-fill,minmax(200px,1fr))]` and `containIntrinsicSize: "0 180px"` (≈16:9 height for ~320px width).
- Images use `object-cover`, so non–16:9 content is cropped inside a 16:9 cell.

**Existing plumbing:** Thumbnails already have `aspect_ratio: string | null` in the DB (e.g. `"16:9"`, `"1:1"`, `"9:16"`). Generation and tiers support it; grids and cards do not yet use it. **PublicThumbnailData** does not include `aspect_ratio` today (needed for shared gallery if cards are ratio-aware).

**Goal:** Support mixed aspect ratios so any chosen ratio displays correctly in the grid without feeling broken or heavily cropped.

---

## Path 1: Intrinsic-Ratio Grid (Variable Row Height)

**Concept:** Each grid cell gets its height from the thumbnail’s aspect ratio. Column width stays uniform (current `minmax(200px,1fr)`); row height varies per item.

**High-level architecture:**

- **Data:** Ensure `aspect_ratio` is available wherever the grid is used (Studio ThumbnailGrid, shared gallery). Add `aspect_ratio` to `PublicThumbnailData` and to the public thumbnails select if not already present. Default `null` → `"16:9"` for backward compatibility.
- **Cards:** In **ThumbnailCard** and **SharedGalleryCard**, replace fixed `aspect-video` with a ratio derived from `thumbnail.aspect_ratio` (e.g. `aspect-[16/9]`, `aspect-square`, `aspect-[9/16]`), or use inline `style={{ aspectRatio: normalizedRatio }}`. Keep `object-cover` so the image fills its (now ratio-correct) box.
- **Grid:** Keep current CSS Grid; no need for masonry. Optionally relax or make dynamic `containIntrinsicSize` in **thumbnail-grid.tsx** (e.g. per-item intrinsic height or a single “tall” default) to avoid layout thrash for very tall items.
- **Skeletons:** ThumbnailCardSkeleton / SharedGalleryCardSkeleton can stay 16:9 or accept an optional ratio prop; empty slots can default to 16:9.

**Pros & cons:**

- ✅ No cropping; each thumbnail is shown in its true aspect ratio.
- ✅ Fits existing data model and grid structure; no new layout engine.
- ⚖️ Rows are no longer aligned: items in the same row can have different heights (“ragged” grid). Some users prefer this; others find it less tidy.
- ⚖️ Slight risk of cumulative layout shift if many tall items (e.g. 9:16) appear; `containIntrinsicSize` tuning helps.

**Complexity:** Low–Medium

**Strategic fit:** Best when you want minimal change and “honest” representation of each aspect ratio. Good first step before investing in masonry or letterboxing.

---

## Path 2: Uniform Cell with Letterboxing / Pillarboxing

**Concept:** Keep a single, uniform cell size (e.g. all 16:9 or all 1:1). Non-matching content is shown with **letterboxing** (bars top/bottom) or **pillarboxing** (bars left/right) so the full image is visible and nothing is cropped.

**High-level architecture:**

- **Grid:** Unchanged: same column layout and fixed cell aspect (e.g. 16:9). Optionally make the “cell aspect” configurable (e.g. project or gallery setting: “prefer 16:9” vs “prefer 1:1”).
- **Cards:** Card container remains one aspect. Inner image wrapper uses `object-contain` instead of `object-cover`, with a neutral background (e.g. `bg-muted`) so bars are visible. Bars are implicit (empty space), not separate DOM elements.
- **Data:** Still use `aspect_ratio` only to decide how the image is fitted (portrait vs landscape vs square); no change to grid structure.
- **UX:** Optional: subtle border or blur in the letterbox area so it doesn’t feel like a bug.

**Pros & cons:**

- ✅ Clean, aligned grid; every row lines up.
- ✅ No cropping; full image visible in every cell.
- ⚖️ Wasted space for mismatched ratios (e.g. 9:16 in a 16:9 cell has large top/bottom bars).
- ⚖️ Choosing the “cell” ratio (16:9 vs 1:1) is a product decision; wrong default can make many items look small or bar-heavy.

**Complexity:** Low

**Strategic fit:** Best when visual alignment and a “strict grid” matter more than optimal use of space. Good for galleries that are mostly one ratio with a few outliers.

---

## Path 3: Masonry / Wrapped Flow Layout (Left → Right, Top → Down)

**Concept:** Use a **masonry** layout so items flow in columns and take their **intrinsic height** based on aspect ratio. Item order is **left to right, top down**: first item top-left, then 2, 3, 4… along the row, then the next row, so reading order matches list order. Width can be fixed (e.g. 200px) or responsive; height is determined by each image’s ratio—no cropping and a Pinterest-style packed layout.

**High-level architecture:**

- **Implementation options:**
  - **Library (recommended for left→right, top→down):** e.g. `react-masonry-css` or similar. Items are placed in DOM order; the layout packs them so the next item goes into the column that currently has the shortest height. Visual order stays **left to right, then top down** (row-like), which matches user expectation for “first item top-left, second next to it,” etc. Configurable column count, responsive, maps cleanly to the existing zoom slider. Adds a dependency and bundle size.
  - **CSS columns:** `column-count` + `break-inside: avoid`. Simple, no deps, but **order is top-to-bottom within each column** (1, 4, 7… in col 1; 2, 5, 8… in col 2). Use only if you explicitly want that order; for “left to right, top down” prefer a masonry library.
- **Cards:** Each card gets width from the masonry container (or column); height from `aspect_ratio` (e.g. `aspectRatio` style or Tailwind aspect classes). Image: `object-cover` within that box.
- **Grid visibility / above-the-fold:** Current `gridItemAboveFoldClass` and `containIntrinsicSize` are grid-specific; masonry would need an equivalent strategy (e.g. first N items “visible” for content-visibility or lazy load).
- **Public page zoom:** The shared gallery’s zoom slider (column count) maps cleanly to masonry column count; behavior stays intuitive.

**Pros & cons:**

- ✅ No cropping; each item shows at correct aspect ratio.
- ✅ Efficient use of space; no large letterbox bars. Visually familiar (Pinterest, Unsplash).
- ⚖️ Different UX from a strict grid: no row alignment, possible reflow as images load if height isn’t known up front.
- ⚖️ Need to ensure `aspect_ratio` is available before paint (or reserve space) to avoid layout shift. Server/client must expose it everywhere the masonry is used (e.g. PublicThumbnailData for shared gallery).

**Complexity:** Medium–High

**Strategic fit:** Best when you want a modern, dense, ratio-accurate gallery and are okay with a layout that doesn’t look like a classic aligned grid. Choose after validating that intrinsic-ratio (Path 1) or letterboxing (Path 2) don’t meet needs.

---

## Summary Table

| Path              | Layout         | Cropping     | Row alignment | Complexity   |
|-------------------|----------------|-------------|---------------|-------------|
| 1. Intrinsic ratio| Same grid      | None        | Ragged        | Low–Medium  |
| 2. Letterbox       | Same grid      | None        | Aligned       | Low         |
| 3. Masonry         | Masonry flow   | None        | N/A           | Medium–High |

---

## Data and Shared Surfaces

Regardless of path:

- **Studio:** Thumbnail list already returns `aspect_ratio` (e.g. via `THUMBNAIL_FIELDS`). Ensure **ThumbnailCard** and any other grid cards receive and use it.
- **Shared gallery:** Add `aspect_ratio` to **PublicThumbnailData** and to the server query that returns public thumbnails so **SharedGalleryCard** can size or fit correctly.
- **Fallback:** Treat `aspect_ratio == null` or invalid as `"16:9"` everywhere so legacy thumbnails and new ones without the field still render as today.

---

## Recommended Starting Point

- **Path 1 (Intrinsic-ratio grid)** is the best first step: the codebase already has `aspect_ratio` on thumbnails and a simple grid; you only need to pass ratio into the card and set the card’s aspect from it. Delivers “correct ratio, no crop” with minimal change. If the ragged grid is acceptable, you can stop here.
- If alignment is mandatory, add **Path 2 (letterboxing)** next: same grid and cards, switch to `object-contain` and a default cell ratio.
- Consider **Path 3 (masonry)** only if you want a denser, Pinterest-style layout and are willing to introduce a new layout pattern and possibly a dependency.

Implementing Path 1 first keeps the door open to later trying Path 2 (same components, different image fit) or Path 3 (swap the grid wrapper for a masonry component) without throwing away work.
