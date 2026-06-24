# Case Study: See Where Viewers Look First on Any Thumbnail

**Project:** ViewBait.app  
**Link:** https://viewbait.app

**Case study type:** Feature design  
**The task:** Show creators where attention likely lands on a thumbnail before they publish, for both generated images and existing YouTube uploads.  
**What we learned:** Creators trust thumbnails more when they can sanity-check focal points, not just aesthetic taste.  
**Last updated:** June 2026

## Case study at a glance

| | |
|---|---|
| **The task** | Overlay a predicted attention heatmap on any thumbnail and let users compare with the original |
| **Who it was for** | Advanced and Pro subscribers who want layout feedback beyond "it looks good to me" |
| **Main constraint** | Heatmaps must run on the exact image shown, including YouTube cards, without a separate upload step |
| **What we built** | Attention Lens: one-click heatmap generation on gallery and YouTube cards, toggle overlay on and off |
| **Outcome** | Creators catch weak focal hierarchy before upload |

## Background

A thumbnail can be beautiful and still fail. Text sits in a dead zone. The face competes with the background. The boldest color pulls the eye away from the hook.

Creators often judge thumbnails at full size on a desktop. Viewers see them small, crowded, and fast. We needed a lightweight way to ask: **where will the eye go first?**

This is not a replacement for real A/B testing on YouTube. It is a pre-flight check inside the studio, right where decisions happen.

## The task

Build attention heatmaps that:

1. Work on ViewBait-generated thumbnails in the gallery and live feed
2. Work on existing YouTube video thumbnails in the connected channel view
3. Generate from the exact image currently displayed
4. Toggle overlay on and off for side-by-side judgment
5. Respect tier access (Advanced and Pro only)

## Constraints

- **Premium feature:** Free and Starter users should not see dead-end UI. Heatmap actions hide in the client. API returns 403 with upgrade messaging for lower tiers.
- **Card-level UX:** Heatmaps must be one tap from the thumbnail card, not a separate analysis page.
- **Cost control:** Each heatmap is an AI call. Cache results per thumbnail so repeat toggles do not re-spend.
- **Two image sources:** Generated thumbnails use stored URLs. YouTube cards use live thumbnail URLs, sometimes fetched as base64 when needed.
- **Honest positioning:** Present as predicted attention, not guaranteed viewer behavior.

## Our approach

We added a heatmap action to thumbnail cards and YouTube video cards. Click once to generate. Click again to toggle the overlay. Results cache in the client query layer so returning to a card is instant.

Server route `POST /api/thumbnails/heatmap` validates tier, accepts image data or URL, returns a heatmap image the UI overlays at full card size.

## How we solved it

### Step 1: Put the action on the card

**What we did:** Added a heatmap icon on gallery thumbnails and YouTube video cards, visible only when `tier === 'advanced' || tier === 'pro'`.

**Decision:** Icon on the asset being judged, not a global tool.

**Why:** Context disappears when you send users elsewhere. The question is always "this thumbnail, right now."

### Step 2: Generate from the displayed pixels

**What we did:** Pass the same URL or base64 payload the card renders. The model returns a heatmap aligned to that image.

**Decision:** Prefer the exact rendered asset over a higher-res alternate that might differ.

**Why:** YouTube serves multiple thumbnail sizes. Judging a different file than the user sees creates false confidence.

### Step 3: Cache and toggle

**What we did:** Store heatmap data URLs in React Query cache keyed by thumbnail or video ID. Overlay toggles without new API calls.

**Decision:** Default overlay on after first successful generation on YouTube cards. Gallery behavior matches.

**Why:** The first question after generation is usually immediate. Reduce friction for that moment.

### Step 4: Enforce tier on the server

**What we did:** API checks tier before calling Gemini. UI and server use the same Advanced and Pro rule.

**Decision:** Follow the product-wide pattern: hide in UI, enforce in API.

**Why:** Prevents client bypass and keeps upgrade messaging consistent.

## What we built

- Heatmap icon on generated thumbnail cards and YouTube video cards
- `POST /api/thumbnails/heatmap` with tier gate
- Client-side cache and overlay toggle
- Works on gallery generations and live YouTube thumbnails

## Results

**Before:** Creators picked thumbnails by gut feel at desktop size, then wondered why small previews felt flat.

**After:** Advanced and Pro users spot when text, face, or background wins attention incorrectly and adjust before publish.

**How we know it worked:** Heatmap usage clusters on final shortlist thumbnails, not first drafts. That matches the intended "sanity check before upload" moment.

## What you can learn

1. **Judgment tools belong on the asset.** Feedback should appear where the decision happens.
2. **Cache expensive AI overlays.** Users toggle repeatedly while comparing options.
3. **Tier-gate consistently.** Hide and enforce together so premium value is clear and secure.
4. **Label predictions honestly.** "Likely attention" sets better expectations than fake precision.
5. **Support multiple sources.** The same feature on generated and external thumbnails doubles utility without doubling code paths in the UI.

## Next step

On Advanced or Pro, open [viewbait.app](https://viewbait.app), generate two variations, and run Attention Lens on both. Toggle the overlay and pick the layout that pulls focus to your hook, not just the brightest color.
