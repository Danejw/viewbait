# Case Study: Tweak a Thumbnail After Generation Without Starting Over

**Project:** ViewBait.app  
**Link:** https://viewbait.app

**Case study type:** Feature design  
**The task:** Let creators adjust a generated thumbnail with a short instruction instead of regenerating from scratch.  
**What we learned:** Most iterations are small edits. Full regeneration wastes credits and throws away good composition.  
**Last updated:** June 2026

## Case study at a glance

| | |
|---|---|
| **The task** | Post-generation AI edit: change one thing on an existing thumbnail without a full new generate |
| **Who it was for** | All subscribed creators iterating on near-winners in the gallery |
| **Main constraint** | Edits must preserve what works while applying a focused change, and charge credits fairly |
| **What we built** | Thumbnail Refine: edit modal, prompt-based image edit API, new gallery entry linked to source |
| **Outcome** | Small fixes happen in one step instead of four new variations |

## Background

Generation is probabilistic. You get 80 percent of the thumbnail in one run. The face is right. The hook text placement is off. Or the background is too busy. Or you want warmer lighting.

Full regeneration risks losing the good parts. Creators told us they wanted **surgical edits**: "brighten the background," "move text left," "make expression more shocked."

That is a different job from blank-canvas generation.

## The task

1. Open any saved thumbnail in an edit modal
2. Enter a short natural-language edit instruction (max 500 characters)
3. Optionally attach reference images
4. Produce a new thumbnail derived from the original
5. Charge credits only on successful edit completion, same fairness principles as generate

## Constraints

- **Preserve composition:** Edit API uses the source image as the base, not a text-only regen.
- **Credit cost:** Edits consume credits by resolution tier, tracked atomically like generation.
- **New record:** Edited result saves as a new thumbnail row. Original stays in gallery for comparison.
- **Idempotency:** Retry-safe handling when clients double-submit.
- **Model choice:** Support user image model selection where tier allows, same as generate path.

## Our approach

Thumbnail Refine adds an edit action on gallery cards. Modal collects edit prompt and optional references. `POST /api/edit` loads the source thumbnail, validates ownership, deducts credits, calls Gemini or OpenAI image edit depending on model, stores variants, and returns the new asset to the live feed.

Regenerate from the modal can also reuse edit pathway with the current thumbnail as reference when users want a stronger rework without returning to the full form.

## How we solved it

### Step 1: Edit modal on gallery assets

**What we did:** ThumbnailEditModal opens from card actions with preview, prompt field, reference chips, and submit.

**Decision:** Edit from gallery context, not only from the generator results panel.

**Why:** Iteration happens after browsing history. Users compare old and new winners side by side.

### Step 2: Image-to-image edit API

**What we did:** Server fetches source image, builds edit request with user prompt, calls image edit model, uploads result to storage, generates 400w and 800w variants.

**Decision:** Separate `/api/edit` route from `/api/generate` with shared credit and storage patterns.

**Why:** Different validation, different model calls, same trust boundaries. Keeps generate logic simpler.

### Step 3: Atomic credits

**What we did:** Check balance before edit. Deduct on success. Refund path on failure where appropriate, matching generate fairness.

**Decision:** Same "pay for what lands" philosophy as variation batches.

**Why:** Users tolerate AI failure when billing is honest. Edits are no exception.

### Step 4: Track edit analytics

**What we did:** Events for edit started and completed for product analytics.

**Decision:** Measure edit as a first-class workflow, not an hidden power feature.

**Why:** High edit rates signal where generation prompts still need studio-level controls.

## What we built

- Edit action and modal on thumbnail cards
- `POST /api/edit` with auth, ownership check, credit deduction, variant generation
- Optional reference images on edit
- New thumbnail record per successful edit
- Regenerate shortcut using edit pathway from modal

## Results

**Before:** A small text placement fix meant regenerating up to four variations and hoping one matched the previous composition.

**After:** One edit prompt, one new image, original preserved for A/B comparison.

**How we know it worked:** Edit sessions often follow generate sessions within minutes on the same thumbnail ID family. That timing matches "almost right, fix one thing" behavior.

## What you can learn

1. **Separate generate and refine.** Full creation and targeted edit are different user jobs.
2. **Keep originals.** New records beat destructive overwrite for creative tools.
3. **Limit prompt length.** Short edits stay focused. Long prompts drift toward regen.
4. **Reuse billing patterns.** Users learn one fairness rule across features.
5. **Expose edit where comparison happens.** Gallery beats generator for iteration memory.

## Next step

Generate two variations at [viewbait.app](https://viewbait.app), pick the closer one, open Edit, ask for one specific change, and compare the result to a full regenerate. Use the cheaper path when the composition is already right.
