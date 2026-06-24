# Case Study: Build Color Palettes From Scratch or From Reference Images

**Project:** ViewBait.app  
**Link:** https://viewbait.app

**Case study type:** Feature design  
**The task:** Let creators define thumbnail colors manually or extract a palette from any reference image.  
**What we learned:** Hex pickers alone are too slow. Most people already have a reference that looks right.  
**Last updated:** June 2026

## Case study at a glance

| | |
|---|---|
| **The task** | Create custom palettes by hand or by analyzing colors in an uploaded image |
| **Who it was for** | Starter tier and above creators building repeatable brand color treatment |
| **Main constraint** | Extracted palettes must be editable and reusable like manually built ones |
| **What we built** | Palette Capture: manual hex editor plus AI extraction from reference images |
| **Outcome** | Brand colors enter the generator in one step instead of trial and error |

## Background

Thumbnails live or die on contrast at small size. Style handles mood. **Palette handles readability.** Red on black. Neon on dark blue. White text on a controlled background.

We shipped default palettes early. Power users wanted their own. Manual hex entry worked but felt tedious when they already had a logo, a brand sheet, or a thumbnail that nailed the colors.

## The task

1. Let users create palettes with name and hex colors in a palette editor
2. Let users upload a reference image and extract dominant colors automatically
3. Save palettes to My Palettes for reuse in the generator and chat assistant
4. Gate custom palette creation at Starter tier and above (`can_create_custom`)

## Constraints

- **Same asset model:** Extracted and manual palettes must save to the same table and appear identically in the generator dropdown.
- **Editable extraction:** AI suggests colors and optional name or description. User adjusts before save.
- **Server-side analysis:** Palette analysis runs in `POST /api/analyze-palette`, not in the browser.
- **Starter gate:** Free users browse defaults. Creating or analyzing custom palettes requires upgrade.
- **Chat integration:** Assistant resolves palette names to IDs when users say "use my brand colors."

## Our approach

Palette Capture lives in My Palettes and the palette editor. Manual path: pick colors, name it, save. Extract path: upload image, analyze, tweak swatches, save. Both paths produce a `DbPalette` the generator consumes through `selectedPalette` in shared studio state.

## How we solved it

### Step 1: Unified palette editor

**What we did:** One editor component for create and edit with color strips, hex inputs, name field, and save actions.

**Decision:** Single editor UX for manual and post-extraction flows.

**Why:** Users should not learn two interfaces for the same asset type.

### Step 2: Image upload analysis route

**What we did:** `POST /api/analyze-palette` accepts an image file, checks `can_create_custom`, returns color hex array plus optional name and description from vision analysis.

**Decision:** Return structured colors, not a finished palette record.

**Why:** Creators often want to drop one swatch or push contrast before save. Analysis is a draft.

### Step 3: Tier enforcement

**What we did:** API returns tier limit response when Free users attempt analysis or custom create.

**Decision:** Match gate used for custom styles and faces.

**Why:** Custom brand assets are a Starter value prop. Consistent gating reduces confusion.

### Step 4: Wire into generator and chat

**What we did:** Palettes list in studio state. Chat `ColorPaletteSection` sets `selectedColor` by name or ID.

**Decision:** Expose palette names to the assistant system prompt.

**Why:** "Use my crimson palette" should work without opening My Palettes.

## What we built

- My Palettes view with create, edit, delete
- Manual hex palette builder
- AI palette extraction from uploaded reference images (Starter+)
- Default palettes for Free tier browsing
- Generator and chat integration with name resolution

## Results

**Before:** Creators guessed hex values or reused one default palette for everything.

**After:** Upload a brand image once, save extracted colors, reuse on every video in the series.

**How we know it worked:** Custom palette creation spikes after style extraction and face upload in onboarding. Users build visual identity in clusters, which matches intended brand setup behavior.

## What you can learn

1. **Offer manual and extract paths.** Some users tweak hex. Most have a reference image ready.
2. **Treat AI output as draft data.** Always let users edit before save.
3. **Unify asset types.** Extracted and hand-built items should be indistinguishable downstream.
4. **Align tier gates across custom assets.** Styles, faces, and palettes share one upgrade story.
5. **Name assets for conversation.** Chat resolves names when IDs are not human-friendly.

## Next step

On Starter or above, open [viewbait.app](https://viewbait.app), upload a reference with colors you love, extract a palette, save it, and generate one thumbnail with that palette and a saved style.
