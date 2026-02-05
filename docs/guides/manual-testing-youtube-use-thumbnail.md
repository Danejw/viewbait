# Manual Testing Guide: Use Thumbnail for My Video (YouTube)

This guide describes how to manually verify the **Use thumbnail for this video** feature on the YouTube tab. The feature lets you pick one of your ViewBait thumbnails and set it as a video’s thumbnail on YouTube. It uses the YouTube Data API (single primary thumbnail per video) and requires the upload scope; existing users may need to reconnect YouTube to gain that permission.

---

## Prerequisites

- **Pro plan:** The set-thumbnail API returns 403 `TIER_REQUIRED` for non-Pro users.
- **YouTube connected:** The studio must be connected to a YouTube channel (Google OAuth). The YouTube tab must show the "My channel" grid of videos.
- **Upload scope (new connections):** New YouTube connections request `youtube.force-ssl` and can set thumbnails. **Existing** connections that were created before this scope was added must **reconnect** (disconnect and connect again, or use the reconnect CTA when the API returns `SCOPE_REQUIRED`) to enable thumbnail upload.
- **At least one thumbnail (for happy path):** Create at least one thumbnail in the **Create** tab so the picker has something to show. For empty-state testing you can use an account with no thumbnails.

---

## Test 1: Button visibility and placement

1. Open the Studio and go to the **YouTube** tab (sidebar).
2. Ensure you are on the **My channel** sub-tab (not "Import by URL").
3. Wait for the video grid to load.
4. Hover over any video card.
5. **Expected:** The hover action bar appears above the card. Among the icon buttons you should see:
   - **Use title**
   - **Use thumbnail for this video** (ImagePlus icon)
   - **Open on YouTube**
   - **Re-roll with video context**
   - **Analyze style and add to instructions**
   - **Video analytics**
   - (If applicable) **Attention heatmap**, **Does this fit my channel?**
6. **Expected:** The "Use thumbnail for this video" button has a tooltip on hover and is not disabled when idle.

---

## Test 2: Happy path — set thumbnail and verify on YouTube

1. Ensure you have at least one thumbnail (Create tab → generate or use an existing one).
2. Go to the **YouTube** tab and locate a video you can safely change (e.g. a test upload).
3. Hover the video card and click **Use thumbnail for this video** (ImagePlus icon).
4. **Expected:** A dialog opens titled **Use thumbnail for this video** with:
   - Short description: "Choose a thumbnail to set as this video's thumbnail on YouTube."
   - A grid of your recent thumbnails (only finished ones; no generating placeholders).
5. Click one thumbnail in the grid.
6. **Expected:** The thumbnail is visually selected (e.g. border/ring). A confirmation row appears below with the thumbnail name and two buttons: **Cancel** and **Set thumbnail**.
7. Click **Set thumbnail**.
8. **Expected:**
   - The dialog shows a loading state (e.g. "Setting…" on the button).
   - After the request completes, a **success toast** appears: "Thumbnail updated on YouTube."
   - The dialog closes.
   - The video list may refetch (if implemented); the card may eventually show the new thumbnail image once YouTube and your cache reflect it.
9. **Verify on YouTube:**
   - Open the same video on YouTube (e.g. click **Open on YouTube** or go to YouTube Studio → Content → that video).
   - **Expected:** The video’s thumbnail on YouTube matches the ViewBait thumbnail you selected.

---

## Test 3: Empty state (no thumbnails)

1. Use an account that has **no** thumbnails (or temporarily move to a project with no thumbnails and ensure the combined list is empty).
2. Go to the **YouTube** tab, hover a video card, and click **Use thumbnail for this video**.
3. **Expected:** The dialog opens and shows:
   - Message: "Create a thumbnail in the Create tab first."
   - A button: **Open Create tab**.
4. Click **Open Create tab**.
5. **Expected:** The dialog closes and the Studio switches to the **Create** (generator) tab.

---

## Test 4: Cancel and deselect

1. Open the picker (YouTube tab → hover a video → **Use thumbnail for this video**).
2. Click a thumbnail so the confirmation row appears.
3. Click **Cancel** (in the confirmation row).
4. **Expected:** Selection is cleared; confirmation row hides. You can select another thumbnail or close the dialog.
5. Select a thumbnail again, then close the dialog via the overlay or close control (if present).
6. **Expected:** Dialog closes; no API call is made; no success toast.

---

## Test 5: SCOPE_REQUIRED — reconnect CTA

This test applies if your YouTube connection was created **before** the app requested the `youtube.force-ssl` scope (i.e. you have not reconnected since that change).

1. On the YouTube tab, hover a video and click **Use thumbnail for this video**.
2. Select a thumbnail and click **Set thumbnail**.
3. **Expected:** The API may return 403 with code `SCOPE_REQUIRED`. The app should show:
   - A **toast error** such as: "Thumbnail upload requires an extra permission. Reconnect your YouTube account to enable it."
   - An **action** on the toast: **Reconnect** (or equivalent).
4. Click **Reconnect** (or go to YouTube tab and use the connect/reconnect flow).
5. **Expected:** You are sent through Google OAuth again; after reconnecting, the same flow (picker → select → Set thumbnail) should **succeed** and show "Thumbnail updated on YouTube."

---

## Test 6: TIER_REQUIRED (non-Pro)

1. Use an account that is **not** on the Pro plan (or temporarily downgrade for testing).
2. Go to the YouTube tab, hover a video, and click **Use thumbnail for this video**.
3. Select a thumbnail and click **Set thumbnail**.
4. **Expected:** A **toast error** appears, e.g. "YouTube integration is available on the Pro plan." The thumbnail is **not** updated on YouTube.

---

## Test 7: NOT_CONNECTED (YouTube disconnected)

1. Disconnect YouTube (e.g. via account/settings or the YouTube tab disconnect option, if present).
2. Ensure the YouTube tab shows the "Connect with Google" (or similar) state rather than the video grid.
3. If the **Use thumbnail for this video** button is still available (e.g. on a cached card), trigger the flow and try to set a thumbnail.
4. **Expected:** The API returns 404 `NOT_CONNECTED`. The app shows an error toast such as "YouTube not connected. Connect your account in the YouTube tab." No thumbnail is set on YouTube.

---

## Test 8: Dialog placement and z-index

1. On the YouTube tab, hover a video card so the action bar (HoverCard) is visible.
2. Click **Use thumbnail for this video** to open the picker dialog.
3. **Expected:** The picker dialog appears **above** the hover card and is fully visible (not clipped or hidden behind it). The overlay dims the rest of the page; you can interact only with the dialog (and close it via overlay or close control).

---

## Test 9: Refetch after success (optional)

1. On the YouTube tab, note the current thumbnail image shown on one video card (or take a screenshot).
2. Use **Use thumbnail for this video** to set a **different** ViewBait thumbnail for that video and complete the flow successfully.
3. **Expected:** After the success toast, the video list may refetch. Once refetched, the same card may display the **new** thumbnail image (matching what you set on YouTube), so the UI stays in sync without a full page reload. (Behavior depends on whether the channel/videos endpoint returns updated thumbnail URLs and whether the client refetches.)

---

## Test 10: Accessibility and keyboard

1. Open the picker dialog (YouTube tab → hover video → **Use thumbnail for this video**).
2. **Expected:** The dialog has a clear title (e.g. "Use thumbnail for this video") and the trigger button has an accessible label ("Use thumbnail for this video" or "Set thumbnail on YouTube").
3. Use **Tab** to move focus through the thumbnail grid and buttons.
4. **Expected:** Focus moves in a logical order; you can select a thumbnail and confirm or cancel with the keyboard. Success and error toasts are announced if you use a screen reader (implementation-dependent).

---

## Quick reference: expected outcomes

| Scenario                    | Expected result                                                                 |
|----------------------------|----------------------------------------------------------------------------------|
| Pro + connected + thumbnails | Picker opens → select → confirm → success toast; thumbnail updated on YouTube.  |
| No thumbnails              | Empty state: "Create a thumbnail…" + "Open Create tab".                          |
| SCOPE_REQUIRED (old scope) | Error toast with Reconnect action; after reconnect, flow succeeds.             |
| Non-Pro                    | Error toast: "YouTube integration is available on the Pro plan."                |
| YouTube not connected      | Error toast: "YouTube not connected…" (or picker/button not shown).             |
| Cancel / close dialog     | No API call; no success toast.                                                  |

---

## References

- Revised plan: [use_thumbnail_for_youtube_video_plan_revised.md](../critiques/use_thumbnail_for_youtube_video_plan_revised.md)
- Implementation: YouTube tab → `YouTubeVideoCard` ("Use thumbnail for this video") → `SetThumbnailPicker` → `POST /api/youtube/videos/[id]/set-thumbnail` (with `thumbnail_id`) → `setVideoThumbnailFromUrl` in YouTube service (upload URL: `https://www.googleapis.com/upload/youtube/v3/thumbnails/set`).
