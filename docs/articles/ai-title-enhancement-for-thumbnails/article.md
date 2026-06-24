# Case Study: From Rough Topic to Clickable Title Before You Generate

**Project:** ViewBait.app  
**Link:** https://viewbait.app

**Case study type:** Feature design  
**The task:** Help creators turn a vague video topic into strong thumbnail text before they spend credits on image generation.  
**What we learned:** The hook text and the visual are one decision. Improve the words first and the thumbnail job gets easier.  
**Last updated:** June 2026

## Case study at a glance

| | |
|---|---|
| **The task** | Enhance a rough topic into clickable title suggestions, let the user pick, then generate with that text |
| **Who it was for** | YouTube creators on Starter tier and above who know the topic but struggle with the hook |
| **Main constraint** | Titles must feel clickable without misleading viewers about the video content |
| **What we built** | Title Hook Lab: one-click enhancement, multi-select suggestions, direct feed into thumbnail generation |
| **Outcome** | Creators test copy angles before committing to visuals |

## Background

In ViewBait, the title field is not metadata for SEO alone. It is the **text on the thumbnail**. Big main line, optional subtext after a colon, readable at phone size.

We saw a repeated pattern in early usage. Creators typed something flat like "budget camera review" and immediately hit Generate. The image was fine. The hook was not. They regenerated visuals when the real problem was the words.

Thumbnail performance starts with curiosity. We needed title help inside the studio, not in a separate copywriting tool.

## The task

When a creator enters a rough topic:

1. Offer AI title enhancement in one click
2. Return a small set of strong variations (we ship exactly three)
3. Let them select one or more
4. Generate thumbnails using the chosen text

The flow had to feel like part of generation, not a detour.

## Constraints

- **Tier gating:** Title enhancement is Starter tier and above. Free users see the upgrade path. API returns 403 below Starter.
- **Integrity over clickbait:** Suggestions should open a loop the video can close. Misleading hooks hurt retention and trust.
- **Prompt secrecy:** Title prompts live server-side only. Creators get outcomes, not prompt engineering homework.
- **Multi-select value:** Picking two or three titles should produce one thumbnail each for quick comparison.
- **Speed:** Enhancement must be near-instant compared to image generation. Waiting kills the workflow.

## Our approach

We split the problem into **copy iteration** and **visual iteration**. Copy is cheap to test. Images cost credits.

Title Hook Lab sits on the thumbnail text input. Enhance runs a text-only Gemini call with YouTube-specific rules: clear promise, curiosity, no spoiler answers in the title. The user picks winners, then Generate uses those strings as `thumbnailText` in the same form state as manual entry.

Chat mode can set title text too, but enhancement gives a structured shortcut for creators who already know their topic.

## How we solved it

### Step 1: Attach enhancement to the text field

**What we did:** Added an Enhance action on the thumbnail text input in manual mode. One tap, three suggestions returned.

**Decision:** Keep it adjacent to the field being improved, not buried in a menu.

**Why:** The moment of doubt is "is this title good enough?" That moment happens at the keyboard.

### Step 2: Encode title craft in the server prompt

**What we did:** Built a system prompt around YouTube title principles: one clear promise, curiosity without betrayal, concise phrasing, colon splits for main and subtext when useful.

**Decision:** Return exactly three variations per request, not ten.

**Why:** Three is enough to feel like a choice without analysis paralysis. More options slowed decisions in testing.

### Step 3: Enforce tier access in the API

**What we did:** `POST /api/enhance-title` checks `has_enhance` on the user's tier before calling the model.

**Decision:** Gate in UI and API, same pattern as other premium features.

**Why:** Consistent enforcement prevents surprise 403s and makes upgrade value obvious at the point of need.

### Step 4: Pipe selected titles into generation

**What we did:** When multiple titles are selected, generation runs once per title with the same style, face, and palette settings.

**Decision:** Treat each selected title as its own variation axis while keeping visual settings constant.

**Why:** This isolates the hook as the variable. Creators compare which wording wins before polishing the image.

## What we built

- Enhance button on thumbnail text input (Starter+)
- Server route with tier validation and structured title output
- Multi-select chips for chosen suggestions
- Generate path that creates one thumbnail per selected title
- Shared form state so chat and manual modes stay in sync

## Results

**Before:** Creators guessed titles, generated full images, then realized the hook was weak and spent credits again.

**After:** Enhance, pick two titles, generate both, compare in the live feed. Copy testing happens in seconds.

**How we know it worked:** Starter users who enable enhancement generate fewer "wrong hook" regenerations. Title enhancement calls cluster right before first generation in session analytics, which is the intended order.

## What you can learn

1. **Separate cheap iterations from expensive ones.** Text suggestions should come before image generation when text is on the canvas.
2. **Limit options on purpose.** Three strong suggestions beat ten mediocre ones for decision speed.
3. **Gate fairly at the API.** UI hides are not enough for paid features.
4. **Treat words as design inputs.** In thumbnail tools, copy is a visual layer, not an afterthought.
5. **Keep prompts server-side.** Users pay for outcomes, not for learning your prompt library.

## Next step

If you are on Starter or above, open [viewbait.app](https://viewbait.app), enter a rough topic, tap Enhance, select two suggestions, and generate both. Pick the hook that makes you want to click your own video.
