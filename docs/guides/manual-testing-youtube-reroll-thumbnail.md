# Manual Testing Guide: YouTube Re-roll Thumbnail Button

This guide describes how to manually verify the **Re-roll with video context** feature on the YouTube tab. The feature adds an icon button to each YouTube video card that, in one flow: sets the thumbnail title from the video, analyzes the video, replaces custom instructions with the video-understanding summary, and triggers one thumbnail generation—without changing references, include faces, style selection, or color palette.

---

## Prerequisites

- **Pro plan:** YouTube video analysis (and thus this flow) requires the Pro tier. The analyze API returns 403 for non-Pro users.
- **YouTube connected:** The studio must be connected to a YouTube channel (Google OAuth) so the YouTube tab shows the "My channel" grid of videos.
- **Generator state:** It helps to have existing generator settings (e.g. a selected style, palette, or references) so you can confirm they are **not** changed by the re-roll.

---

## Test 1: Button visibility and placement

1. Open the Studio and go to the **YouTube** tab (sidebar).
2. Ensure you are on the **My channel** sub-tab (not "Import by URL").
3. Wait for the video grid to load.
4. Hover over any video card.
5. **Expected:** The hover action bar appears above the card with several icon buttons. Among them you should see:
   - **Use title**
   - **Open on YouTube**
   - **Re-roll with video context** (RefreshCw icon)
   - **Analyze style and add to instructions**
   - **Video analytics**
   - (If tier allows) **Attention heatmap**
6. **Expected:** The "Re-roll with video context" button has a tooltip on hover and is not disabled when idle.

---

## Test 2: Full re-roll flow (happy path)

1. **Set baseline generator state** (to confirm it is preserved):
   - Go to the **Create** (generator) tab.
   - Set **Thumbnail text** to something like `Old title`.
   - Set **Custom instructions** to something like `Use a blue background.`
   - Optionally select a **Style**, enable **Color palette** and pick one, enable **Include faces** or **References** and set values.
   - Note these choices (or take a screenshot).
2. Go back to the **YouTube** tab.
3. Hover a video card and click **Re-roll with video context** (RefreshCw icon).
4. **Expected:**
   - The card enters a loading state (e.g. "RE-ROLLING" in the overlay, spinner on the button).
   - The app switches to the **Create** tab (generator view).
   - After a few seconds (analysis + generation), loading ends and new thumbnail(s) appear in the results area.
5. **Check generator form (after flow completes):**
   - **Thumbnail text** = the **video title** of the card you clicked (replaced from "Old title").
   - **Custom instructions** = a **video-understanding summary** (replaced; no longer "Use a blue background"). The text should reference the video (summary, topic, tone, key moments, etc.).
   - **Style**, **Color palette**, **Include faces**, **References** = **unchanged** from step 1.
6. **Expected:** The new thumbnail(s) in the results reflect the new title and the new custom instructions (video context), while still using the same style/palette/faces/references you had before.

---

## Test 3: Analysis failure handling

1. Simulate a failure (e.g. disconnect the network before clicking, or use an account without Pro if the API returns 403).
2. Go to the **YouTube** tab, hover a video card, and click **Re-roll with video context**.
3. **Expected:**
   - Loading state appears briefly.
   - A **toast error** appears (e.g. "Failed to analyze video" or the API error message).
   - Loading ends; **custom instructions and thumbnail text are not updated** (or only title may be set before the failing step, depending on implementation order).
   - **No** new thumbnails are generated.
4. Re-enable network / use Pro account and confirm the button works again (repeat Test 2).

---

## Test 4: Button disabled and loading state

1. On the YouTube tab, hover a video card and click **Re-roll with video context**.
2. **While the flow is running:**
   - **Expected:** The same card shows the analyzing overlay (e.g. "RE-ROLLING").
   - **Expected:** The re-roll button in the action bar is **disabled** and shows a spinner (or equivalent loading icon).
3. **Expected:** Other cards’ re-roll buttons remain usable (each card has its own loading state).
4. After the flow completes, the card exits loading and the button is enabled again.

---

## Test 5: Settings not affected (references, faces, style, palette)

1. On the **Create** tab, set:
   - **References:** Enable and add at least one reference image.
   - **Include faces:** Enable and select a face (if available).
   - **Style:** Select a style.
   - **Color palette:** Enable and select a palette.
2. Go to the **YouTube** tab and trigger **Re-roll with video context** on any video.
3. After the flow completes, go back to the **Create** tab and inspect the form.
4. **Expected:**
   - **Thumbnail text** and **Custom instructions** are updated (video title and video summary).
   - **References** (include + list) are **unchanged**.
   - **Include faces** and selected face(s) are **unchanged**.
   - **Style** (include + selection) is **unchanged**.
   - **Color palette** (include + selection) is **unchanged**.

---

## Test 6: Channel context in custom instructions (My channel)

1. On the **YouTube** tab, ensure you are on **My channel** (so channel info is available).
2. Trigger **Re-roll with video context** on a video.
3. After completion, open **Custom instructions** on the Create tab.
4. **Expected:** The summary text includes channel-related context (e.g. "Channel: …") when channel data is present, and video summary, topic, tone, etc.

---

## Test 7: Generator view switch

1. Start on the **YouTube** tab with the video grid visible.
2. Click **Re-roll with video context** on any card.
3. **Expected:** The current view switches to the **Create** (generator) tab early in the flow (e.g. right after clicking), so the user sees the generator and the subsequent generation/results there.

---

## Quick checklist

| # | Check | Pass / Fail |
|---|--------|-------------|
| 1 | Re-roll button visible on hover in YouTube tab, My channel | |
| 2 | Click re-roll → title and custom instructions updated; generation runs | |
| 3 | On analysis error, toast shown; no instruction update or generation | |
| 4 | Button disabled and card shows loading (e.g. RE-ROLLING) during flow | |
| 5 | References, faces, style, palette unchanged after re-roll | |
| 6 | Custom instructions include video (and channel when on My channel) context | |
| 7 | View switches to Create tab when re-roll is triggered from YouTube | |

---

## Notes

- **Pro tier:** If you are not on Pro, the analyze step will fail with a tier error; the rest of the flow (title set, then error toast, no generation) should still behave as described.
- **Rate limits / quotas:** Video analysis uses the existing analyze API; repeated tests may hit rate limits or quotas.
- **Copy vs replace:** This feature **replaces** the entire custom instructions field with the video summary, unlike "Add to custom instructions" in the analytics modal, which appends.
