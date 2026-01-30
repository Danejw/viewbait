# ViewBait — Vision, Audit & Feature Roadmap

This document grounds product direction in the current codebase and proposes forward-looking features that fit the product’s vision and feel inevitable, not random.

---

## 1) Vision Snapshot

| # | Item | Summary |
|---|------|---------|
| 1 | **One-liner** | ViewBait is an AI-powered thumbnail generator that helps YouTube and video creators produce high-converting thumbnails through conversational AI, face integration, and reusable styles—without design skills. |
| 2 | **Target user** | YouTube creators (hobby to full-time), content marketing teams, social media managers, course creators & educators. |
| 3 | **Core promise** | Describe what you want; get scroll-stopping results. Your face, your style, one prompt. |
| 4 | **Primary workflow** | Land → Sign up → Studio → (Manual form or Chat) → Generate → View/Edit/Download or push to YouTube or run A/B experiment. |
| 5 | **Key constraint** | Tier-gated credits, resolution, variations, and custom assets; AI (Gemini) and storage (Supabase) cost; privacy (face/images sent to Gemini). |
| 6 | **Success metric** | Activation (signup → first generation), retention (weekly active creators), conversion (free → paid), time-to-value (time to first “good” thumbnail), reported CTR lift (+340% in messaging). |

---

## 2) Feature Triage Table

| # | Status | Impact | Feature | Effect | Effort | Link to Section |
|---|--------|--------|---------|--------|--------|------------------|
| 1 | Proposed | High | First-run wizard / onboarding | +15–25% activation | M (guided flow + analytics) | § C.1 |
| 2 | Proposed | High | Referral link pre-fill (`/auth?ref=CODE`) | +5–15% referral conversion | S (query param + apply) | § C.2 |
| 3 | Proposed | High | Wire notifications to generation/referral/credits | +5–10% retention | M (event triggers in APIs) | § C.3 |
| 4 | Proposed | High | “Apply to YouTube” from Results (one-click) | +10–20% time-to-value, stickiness | M (YouTube connect CTA + flow) | § C.4 |
| 5 | Proposed | Medium | Chat: “Generate now” suggestion / CTA | +5–10% time-to-value | S (suggestion chip + focus) | § C.5 |
| 6 | Proposed | Medium | Experiment from thumbnail (create from Gallery) | +10–15% experiment adoption | M (entry point + experiment create) | § C.6 |
| 7 | Proposed | Medium | Credits low / renewal in-app alerts | +5% conversion, retention | S (notification events + copy) | § C.7 |
| 8 | Proposed | Medium | Style/palette from thumbnail (save as template) | +5–10% consistency, retention | M (analyze + save flow) | § C.8 |
| 9 | Proposed | Medium | Prompt templates / quick prompts | +10% time-to-value | S (presets + UI) | § C.9 |
| 10 | Proposed | Medium | Favorites filter + bulk export | +5% weekly usage | S (filter + export API/UI) | § C.10 |
| 11 | Proposed | Medium | Share thumbnail (read-only link) | +5% sharing, virality | M (public link + view page) | § C.11 |
| 12 | Proposed | Low–Medium | Chat history per session (server-side) | +5% retention for power users | L (API + storage + UI) | § C.12 |
| 13 | Proposed | Low | Free-tier “first 3 gens” highlight | +5% activation | S (copy + banner) | § C.13 |
| 14 | Proposed | Low | A/B result summary in Studio | +5% experiment completion | S (dashboard card or sidebar) | § C.14 |
| 15 | Proposed | Low | Cookie consent + policy link (legal) | Risk reduction, trust | S (banner + link) | § C.15 |

*Effect = estimated % improvement to a core metric (activation, retention, conversion, time-to-value, weekly usage). Effort: S = small (days), M = medium (1–2 sprints), L = large (multi-sprint).*

---

## A) Project Understanding

### What the product is trying to accomplish

ViewBait aims to be the default AI thumbnail studio for video creators. It removes the need for design tools (e.g. Photoshop) by letting users describe intent in plain language or via chat, optionally attach their face (Face Library), styles, and palettes, and generate one or more thumbnail variations in under ~30 seconds. Quality is framed around “scroll-stopping” thumbnails and reported CTR lift. The product also connects to YouTube (OAuth, channel, videos) so users can set thumbnails and run A/B experiments (experiments table: draft → running → completed with winner import). Monetization is tier-based (Free / Starter / Advanced / Pro) with credits, resolution, variations, watermark, and custom assets gated by tier.

### Who it’s for (and who it’s not for)

- **For:** YouTube creators (gaming, vlog, tutorial, reaction, education), content teams that need consistent thumbnails, social managers producing for YouTube/Shorts/cross-platform, course creators. They care about speed, quality, ease, consistency, and control (“my face, my style”).
- **Not for:** Users who need full image editing, non-video use cases, or enterprises requiring strict data residency without clarity on Gemini usage (see Privacy Policy).

### The core loop (what users do repeatedly)

1. **Enter Studio** (landing → auth → `/studio`).
2. **Set intent** via Manual form (thumbnail text, style, palette, face, aspect ratio, resolution, variations) or Chat (assistant suggests 1–2 form sections and pre-fills state).
3. **Generate** (API deducts credits, enforces tier limits, calls Gemini; cooldown by tier).
4. **Consume output**: view in Results/Gallery, edit (crop/overlay, costs edit credits), favorite, download, optionally “Apply to YouTube” or create/run an experiment.

Repeat for each new video or iteration. Secondary loops: manage Faces/Styles/Palettes, check credits/subscription, use referrals, respond to notifications (infrastructure exists; few events wired).

### Main friction points in the current experience

- **Activation:** New users may not complete first generation (no guided first-run; form has many options).
- **Discovery:** Chat vs Manual is a mode switch; “Generate now” is not surfaced as a clear CTA after chat pre-fill.
- **YouTube value:** Set-thumbnail and experiments exist but are not prominent from Results; YouTube connect is easy to miss.
- **Referrals:** Apply is best-effort on signup; no shareable link to pre-fill code.
- **Retention:** No notifications for “generation done,” “credits low,” or “referral rewarded”; notification pipeline is underused.
- **Experiments:** Creating an experiment requires video/channel context; no one-click “Create experiment from this thumbnail” in Gallery.
- **Consistency:** No “save this thumbnail’s look as a style” from Results.

### Constraints we must respect

- **Tech:** Next.js App Router, Supabase (auth, DB, storage, RLS), Stripe (subscriptions, webhooks), Gemini (generation + chat). Tier and credit logic must stay server-authoritative.
- **Brand:** Dark-first UI, single accent (red), creator tone, no generic “AI” imagery (see `docs/brand_identity.md`).
- **Privacy:** Face/reference images and prompts sent to Gemini; Privacy Policy and Terms govern processing and retention; free-tier 30-day thumbnail retention.
- **Cost:** Credits and tier limits cap usage; generation and edit costs are defined in `subscription_settings` and enforced in API.
- **Platform:** Web (desktop + mobile-responsive); Studio is SPA-like with sidebar/main/settings layout; no native app.

---

## B) Opportunity Map

### 1) Make the core loop faster (reduce time-to-value)

- First-run wizard or minimal onboarding so first generation happens sooner.
- Prompt templates / quick prompts so users can generate with one click from presets.
- Chat suggestion “Generate now” (or focus Generate button) after assistant pre-fills form.
- “Apply to YouTube” surfaced from Results so the value of generation is realized immediately (connect → pick video → set thumbnail).
- Experiment creation from Gallery (“Run A/B with this thumbnail”) so experiments don’t require starting from a separate flow.

### 2) Make results better (quality, trust, consistency)

- Style/palette “from this thumbnail”: save a winning thumbnail’s look as a reusable style or palette.
- A/B result summary in Studio (experiment winner, watch-time share) so creators see outcome without leaving the app.
- Free-tier “first 3 generations” messaging to set expectations and reduce perceived risk.
- Optional: quality or “thumbnail score” signal (if we add a lightweight model or heuristic) to guide iteration.

### 3) Make it stick (retention, sharing, habit, collaboration)

- Wire notifications to real events: generation complete, credits low, referral rewarded, subscription renewal.
- Credits low / renewal in-app alerts (and optional email) to reduce churn and nudge upgrade.
- Share thumbnail (read-only link) so creators can share drafts with collaborators or audience.
- Favorites filter + bulk export to make the gallery more useful and encourage re-use.
- Referral link (`/auth?ref=CODE`) to pre-fill referral code and improve referral conversion.
- Optional: server-side chat history per session for power users who want to resume or reference past conversations.

### 4) Legal / trust (risk reduction)

- Cookie consent + link to Cookie Policy where required (e.g. EU); align with existing legal docs.

---

## C) Feature Proposals

### C.1 First-run wizard / onboarding

- **Why:** New users often don’t complete first generation; the form has many options and no guidance.
- **What:** A short, dismissible wizard on first Studio load: e.g. “Describe your video in one line” → show Thumbnail Text field; “Add your face (optional)” → show Face section; “Generate your first thumbnail” → focus Generate. No extra backend; state in `localStorage` or profile flag.
- **Success metric:** % of new users who generate at least one thumbnail within 24h (activation).
- **MVP scope:** 3-step modal or inline steps; “Don’t show again”; track step completion (client event or simple API).
- **Risks:** Annoying if not skippable; must not block users who prefer to explore.
- **Dependencies:** Studio layout, `StudioProvider`, analytics (if we add events).

---

### C.2 Referral link pre-fill (`/auth?ref=CODE`)

- **Why:** Referral apply is best-effort on signup; many users don’t paste the code. A link that pre-fills the code increases apply rate.
- **What:** Support `?ref=CODE` (or `ref=CODE`) on `/auth`. On load, if `ref` is present and valid format (8–12 alphanumeric), pre-fill the referral code field and optionally show a short message (“You were referred by a friend”). On submit, existing apply logic runs.
- **Success metric:** Referral apply rate (or qualified referral rate) increase.
- **MVP scope:** Read `ref` from query, validate, set input value; no new API. Optional: persist in session until apply so refresh doesn’t lose it.
- **Risks:** Abuse (e.g. spam links); keep validation and server-side apply rules.
- **Dependencies:** Auth page, `POST /api/referrals/apply`.

---

### C.3 Wire notifications to generation / referral / credits

- **Why:** Notification system exists but no feature creates notifications; users miss “generation done” or “referral rewarded.”
- **What:** From server-side flows, call notification create (e.g. `POST /api/notifications` with service role) for: (1) generation complete (per user), (2) referral qualified/rewarded, (3) credits below threshold (e.g. &lt;10). Use existing types (`reward`, `info`, `warning`) and `action_url` to deep-link (e.g. to Studio or billing).
- **Success metric:** Notification open/click rate; retention (D7) for users who received at least one notification.
- **MVP scope:** Add 3 event types; minimal copy and one `action_url` each. No new tables.
- **Risks:** Noise if too frequent; respect notification preferences when we add them.
- **Dependencies:** `generate` route, Stripe webhook (referral), check-subscription or cron; notifications API and RLS.

---

### C.4 “Apply to YouTube” from Results (one-click)

- **Why:** Set-thumbnail and YouTube integration are high value but not obvious from Results; users may not connect YouTube or find the action.
- **What:** In Results/Gallery view, add a clear “Apply to YouTube” (or “Use on YouTube”) on thumbnail cards or in the edit modal. If not connected: open YouTube connect flow, then return to “pick video → set thumbnail.” If connected: open video picker (or deep-link to experiment flow) and then call set-thumbnail API.
- **Success metric:** % of generated thumbnails that get “set” on a video (or used in experiment); time-to-value (first gen → first set).
- **MVP scope:** Button in Results and/or thumbnail card; connect CTA when not connected; reuse existing `set-thumbnail` and YouTube APIs.
- **Risks:** YouTube quota and errors; clear error states and retry.
- **Dependencies:** `StudioResults`, thumbnail card, YouTube connect, `POST /api/youtube/videos/[id]/set-thumbnail`.

---

### C.5 Chat: “Generate now” suggestion / CTA

- **Why:** In chat mode, the assistant pre-fills form state but doesn’t trigger generation; users may not notice the Generate button.
- **What:** When the assistant returns a response that includes form_state_updates (and optionally `GenerateThumbnailButton` in `ui_components`), add a prominent suggestion chip or inline CTA: “Generate now.” Clicking it focuses/triggers the Generate button in the form (same as manual generate). No server change; client-only.
- **Success metric:** % of chat sessions that result in a generation (conversion from chat to gen).
- **MVP scope:** One “Generate now” chip or button in chat panel when last message had form updates; onClick triggers existing generate action.
- **Risks:** Double-submit if user clicks twice; use same disabled state as manual Generate.
- **Dependencies:** `StudioChatPanel`, `DynamicUIRenderer`, `StudioProvider` generate action.

---

### C.6 Experiment from thumbnail (create from Gallery)

- **Why:** Experiments require a video and channel; starting from a thumbnail the user already likes (e.g. in Gallery) is a natural entry point.
- **What:** From Gallery (or thumbnail card), add “Run A/B test” (or “Create experiment”). User selects video (and channel if multiple); we create an experiment with that video and attach the current thumbnail as one variant (e.g. A), then guide to add B/C or go to experiment view. Reuse existing experiment create API.
- **Success metric:** Number of experiments created per active user; experiment start rate.
- **MVP scope:** “Create experiment” on thumbnail card or Gallery; modal/sheet to pick video; POST to create experiment with one variant from thumbnail; redirect or open experiment view.
- **Risks:** YouTube video list and permissions; clear errors when video isn’t eligible.
- **Dependencies:** Gallery/thumbnail card, `POST /api/experiments`, YouTube videos list, experiment UI.

---

### C.7 Credits low / renewal in-app alerts

- **Why:** Users hit “insufficient credits” or forget to renew; in-app nudges can reduce churn and support upgrades.
- **What:** When credits fall below a threshold (e.g. 10 or 5), create a notification (“Running low on credits”) with action to open subscription/billing. Optionally, when subscription is near end of period, create a “Renewal soon” notification. Reuse notification create (service role); thresholds can be configurable.
- **Success metric:** Conversion (upgrade or add credits) after low-credits notification; renewal rate.
- **MVP scope:** In Stripe webhook or check-subscription flow (or cron), if credits_remaining &lt; threshold, create one notification per user per “period” to avoid spam.
- **Risks:** Over-notifying; use a cooldown (e.g. once per week per user for “low credits”).
- **Dependencies:** Notifications API, subscription/credits data, Stripe webhook or cron.

---

### C.8 Style/palette from thumbnail (save as template)

- **Why:** Creators want consistency; reusing the “look” of a winning thumbnail is a natural request.
- **What:** From a thumbnail in Gallery or Results, add “Save as style” or “Save as palette.” For style: optionally call analyze-style with the thumbnail image, then open Style editor with pre-filled data and save. For palette: analyze-palette with thumbnail image, then save as new palette. Reuse existing analyze and create APIs.
- **Success metric:** Number of styles/palettes created “from thumbnail”; retention (re-use of those assets).
- **MVP scope:** “Save as style” / “Save as palette” on thumbnail card; call analyze API with thumbnail URL; open create modal with pre-filled fields; save.
- **Risks:** Analyze can fail or be slow; show loading and errors.
- **Dependencies:** Thumbnail card, analyze-style, analyze-palette, style/palette create APIs and editors.

---

### C.9 Prompt templates / quick prompts

- **Why:** Reduces time-to-value for users who don’t know what to type; encourages first generation.
- **What:** A set of 5–10 preset prompts (e.g. “Shocked face + bold text: NEVER EXPECTED THIS”, “Gaming: epic moment with red and black”) that the user can click to fill Thumbnail Text (and optionally set style or aspect ratio). Shown on Manual tab or in onboarding. Stored in constants or a small config; no backend initially.
- **Success metric:** Use of templates; activation (first gen) for users who used a template.
- **MVP scope:** List of presets in UI; onClick sets thumbnailText (and optionally 1–2 other fields); no new API.
- **Risks:** Presets can feel generic; allow editing after apply.
- **Dependencies:** Studio generator state, Thumbnail Text (and optional style/aspect) setters.

---

### C.10 Favorites filter + bulk export

- **Why:** Users with many thumbnails want to filter by favorites and sometimes export several at once.
- **What:** In Gallery (or Results), add a “Favorites” filter/tab so only favorited thumbnails are shown. Add “Export selected” or “Export all (favorites)”: download as ZIP or trigger multiple download links. Filter uses existing favorites API; export can be client-side (multiple download) or a simple server endpoint that returns signed URLs for selected IDs.
- **Success metric:** Use of Favorites filter; export actions per user (weekly usage).
- **MVP scope:** Favorites filter in gallery controls; multi-select (or “select all on page”) + “Download” that fetches signed URLs and triggers downloads or packs into a ZIP via client or small API.
- **Risks:** Large exports (rate limit or max N items).
- **Dependencies:** Gallery, favorites API, storage signed URLs, optional export API.

---

### C.11 Share thumbnail (read-only link)

- **Why:** Creators want to share a draft with collaborators or audience without giving account access.
- **What:** For a thumbnail that has a public or shareable URL (e.g. we already have public thumbnail routes), add “Copy share link.” If no public URL exists, add an optional “Make shareable” that creates a time-limited or permanent public link (e.g. `/t/[id]` or signed URL) and store preference. View page shows thumbnail only (read-only), optional branding.
- **Success metric:** Share links created and opens (if we can measure); user-reported collaboration.
- **MVP scope:** “Copy link” button that copies existing public URL, or create shareable link via API (e.g. set is_public or create short-lived token); minimal view page.
- **Risks:** Abuse (public links); respect privacy and retention (free-tier thumbnails may be deleted after 30 days).
- **Dependencies:** Thumbnails table (is_public or share token), `GET /api/thumbnails/public` or similar, view route.

---

### C.12 Chat history per session (server-side)

- **Why:** Power users want to resume or reference past conversations; localStorage is device-only and can be lost.
- **What:** Persist chat messages per “session” or “thread” on the server. On load, optionally load last thread or list of threads; on send, append to current thread (create if none). New API: e.g. GET/POST threads, GET/POST messages for a thread. Client stores current thread id and sends it with chat request.
- **Success metric:** Retention (returning users who use chat); threads per user.
- **MVP scope:** New table or reuse (e.g. chat_threads, chat_messages); 2–3 API routes; Studio chat panel sends thread id and appends to thread; list of threads in sidebar or modal (minimal).
- **Risks:** Cost (storage, tokens if we ever replay); privacy (store only what’s needed).
- **Dependencies:** DB, `POST /api/assistant/chat` (accept thread id), Studio chat UI.

---

### C.13 Free-tier “first 3 gens” highlight

- **Why:** Free users may not realize they get a few free generations; highlighting it can reduce anxiety and increase first gen.
- **What:** On Studio sidebar or generator area, for free tier, show a short message: “Your first 3 generations are on us” or “You have X free generations left” (if we track “first N” separately) or simply “10 credits this month — try a generation.” Dismissible or always visible in a compact strip.
- **Success metric:** First-generation rate for free users.
- **MVP scope:** Copy + small UI block; optionally use credits_remaining for “X left” if we don’t track “first 3” separately.
- **Risks:** Confusion if credits differ from “3” (e.g. 10/mo); keep copy consistent with tier config.
- **Dependencies:** useSubscription, tier config, Studio sidebar or generator.

---

### C.14 A/B result summary in Studio

- **Why:** Experiment results (winner, watch-time share) live in experiment detail; surfacing a summary in Studio increases completion and learning.
- **What:** In sidebar or a “Experiments” section, show a compact card: “Latest experiment: B won (+12% watch time)” with link to experiment detail. Or small list of recent experiments with status and winner. Read from existing experiments + result APIs.
- **Success metric:** Clicks to experiment detail; experiment completion rate.
- **MVP scope:** One card or list item that fetches recent experiments (e.g. GET /api/experiments?limit=1 or 3) and result; link to existing experiment view.
- **Risks:** None significant.
- **Dependencies:** Experiments API, result/analytics, Studio layout.

---

### C.15 Cookie consent + policy link (legal)

- **Why:** Cookie policy exists (`app/legal/cookie-policy.md`); some regions expect consent and a clear link.
- **What:** Add a minimal cookie consent banner (e.g. “We use cookies… [Accept] [Learn more]”) that sets a consent flag in localStorage and hides the banner. “Learn more” links to `/legal/cookie-policy`. Footer already has Privacy and Terms; add Cookie policy link there too.
- **Success metric:** Compliance; reduced legal risk.
- **MVP scope:** Banner component, localStorage, link to cookie policy; footer link.
- **Risks:** Banner fatigue; keep it minimal and dismissible.
- **Dependencies:** Layout, `cookie-policy.md`, footer.

---

## D) Implementation Prompts (agent-ready)

### D.1 First-run wizard

- **Problem:** New users often don’t complete their first thumbnail generation; the Studio has many options and no guided path.
- **Current state:** User lands on `/studio`; left sidebar has Manual/Chat and full form; no onboarding.
- **Goal state:** On first visit (or first visit after signup), show a short dismissible wizard (e.g. 3 steps: describe text → optional face → generate) that pre-focuses or fills fields and ends at “Generate your first thumbnail.” User can skip or “Don’t show again.”
- **Acceptance criteria:**
  - [ ] Wizard appears only when a “completed onboarding” flag is false (e.g. localStorage key or profile).
  - [ ] Step 1: Thumbnail text prompt; focus or pre-fill Thumbnail Text.
  - [ ] Step 2: Optional “Add your face”; scroll or highlight Face section.
  - [ ] Step 3: CTA to click Generate; wizard closes and Generate is focused or triggered.
  - [ ] “Skip” or “Don’t show again” sets flag and closes wizard.
  - [ ] No breaking change for existing users (flag not set = show once, then set on completion or skip).
- **Unit test:** (Integration) With flag unset, load Studio; expect wizard to be visible. Complete or skip; reload; expect wizard not visible when flag is set.
- **Implementation prompt:** Implement a first-run onboarding wizard for the ViewBait Studio. Use a 3-step flow: (1) Thumbnail text, (2) Optional face, (3) Generate CTA. Store “onboarding completed” in localStorage (key e.g. `viewbait_onboarding_done`). Wizard must be dismissible and skippable; after completion or skip, set the flag so it does not show again. Reuse existing StudioProvider state for thumbnailText and focus the Generate button on step 3. Match existing dark UI and accent from `docs/brand_identity.md`.

---

### D.2 Referral link pre-fill

- **Problem:** Referral codes are shared as text; users often don’t paste them on signup, so apply rate is low.
- **Current state:** Auth page has optional referral code field; apply is called after signup with user input only.
- **Goal state:** Support `/auth?ref=CODE`. When present and valid (8–12 alphanumeric), pre-fill the referral field and optionally show “You were referred by a friend.” On signup, existing apply logic uses the pre-filled value.
- **Acceptance criteria:**
  - [ ] `ref` query param is read on auth page load.
  - [ ] If `ref` matches `^[A-Za-z0-9]{8,12}$`, pre-fill the referral input (normalize to uppercase).
  - [ ] Optional: show short message that referral was pre-filled.
  - [ ] Form submit still calls `POST /api/referrals/apply` with the same validation; no change to API.
  - [ ] If `ref` is invalid, do not pre-fill and do not show error (ignore).
- **Unit test:** Render auth page with `?ref=ABC12XYZ`; expect referral input value to be `ABC12XYZ` (or normalized). Submit signup; expect apply to be called with that code (mock).
- **Implementation prompt:** Add referral link pre-fill to the ViewBait auth page. Read `ref` from the URL query (e.g. `searchParams.get('ref')`). If the value matches 8–12 alphanumeric characters, normalize to uppercase and set it as the value of the referral code input. Optionally display a short line such as “You were referred by a friend.” Do not change the existing apply API or validation; ensure form submission still sends the referral code and that invalid `ref` values are ignored without showing an error.

---

### D.3 Notifications for generation / referral / credits

- **Problem:** The notification system exists but no feature creates notifications; users don’t get “generation done” or “referral rewarded.”
- **Current state:** Notifications are created only via manual POST or broadcast; generation, referral reward, and credits are not triggering notifications.
- **Goal state:** When a generation completes, create a notification for the user (e.g. “Thumbnail ready”). When a referral is rewarded, create a notification for the referrer. When credits fall below 10, create a “Credits low” notification (with cooldown, e.g. once per week).
- **Acceptance criteria:**
  - [ ] After successful `POST /api/generate` response (server-side, after credits deducted), create one notification for the user: type e.g. `info` or `reward`, title “Thumbnail ready,” action_url to Studio or Results.
  - [ ] In Stripe webhook, after `recordPurchaseAndProcessReferrals` grants referrer credits, create a notification for the referrer: “Referral rewarded: you earned 10 credits.”
  - [ ] In a place that has access to credits_remaining (e.g. check-subscription or a cron), if credits_remaining < 10, create a “Credits low” notification at most once per user per week (store last_sent in DB or use notification created_at).
  - [ ] All creates use service role and existing `POST /api/notifications` or equivalent server-side insert; types and severity follow existing schema.
- **Unit test:** (Integration) Mock generate success; verify notification insert is called with correct user_id and body. Mock referral reward; verify referrer gets notification.
- **Implementation prompt:** Wire ViewBait’s in-app notifications to three events: (1) Thumbnail generation complete — after a successful generate in the generate route, insert a notification for the requesting user with a title like “Thumbnail ready” and an action_url to the studio or results. (2) Referral rewarded — in the Stripe webhook path that calls recordPurchaseAndProcessReferrals, after credits are granted to the referrer, insert a notification for the referrer (e.g. “Referral rewarded: you earned 10 credits”). (3) Credits low — when credits_remaining is below 10 (e.g. in check-subscription or a small cron), insert a “Credits low” notification for that user, with a cooldown of once per week per user (use existing notifications table or a small key-value to record last sent). Use the existing notification schema and service-role insert; do not expose notification create to the client.

---

### D.4 “Apply to YouTube” from Results

- **Problem:** High-value action “set thumbnail on YouTube” is not obvious from Results; users may not connect YouTube or find the action.
- **Current state:** Results show thumbnails; YouTube set-thumbnail exists via API but is not prominently offered from Results.
- **Goal state:** Each thumbnail in Results (or Gallery) has an “Apply to YouTube” (or “Use on YouTube”) action. If user is not connected: show connect CTA and then return to “pick video → set thumbnail.” If connected: open video picker, then call set-thumbnail for selected video.
- **Acceptance criteria:**
  - [ ] “Apply to YouTube” (or equivalent label) is visible on thumbnail cards in Results (and optionally Gallery).
  - [ ] If YouTube is not connected, clicking opens YouTube connect flow (existing); after success, return to same view and show video picker or set-thumbnail flow.
  - [ ] If connected, clicking opens video picker (list user’s videos); user selects video; call `POST /api/youtube/videos/[id]/set-thumbnail` with the thumbnail’s image URL; show success/error toast.
  - [ ] Use existing set-thumbnail API (image_url, 2MB limit, etc.); handle errors (quota, not connected) with clear messages.
- **Unit test:** (Integration) With YouTube connected, click “Apply to YouTube” on a thumbnail, select a video, submit; expect set-thumbnail to be called with correct video id and image_url. With YouTube not connected, expect connect flow to be triggered.
- **Implementation prompt:** Add an “Apply to YouTube” action to thumbnail cards in the ViewBait Studio Results view. When clicked: if the user does not have YouTube connected, trigger the existing YouTube connect flow and, after successful connection, show the video picker and then call the set-thumbnail API for the chosen video. When the user is already connected, show a video picker (use existing YouTube videos list API), then call POST /api/youtube/videos/[id]/set-thumbnail with the thumbnail’s image URL. Handle errors (e.g. not connected, quota, invalid file) with clear toasts. Reuse existing components and APIs; do not change the set-thumbnail API contract.

---

### D.5 Chat “Generate now” CTA

- **Problem:** In chat mode, the assistant pre-fills the form but users may not notice the Generate button, so they don’t generate.
- **Current state:** Chat returns ui_components and form_state_updates; user must scroll to the form and click Generate manually.
- **Goal state:** When the last assistant message has form_state_updates (or includes GenerateThumbnailButton), show a “Generate now” suggestion chip or button in the chat panel. Clicking it triggers the same generate action as the Manual Generate button (no new API).
- **Acceptance criteria:**
  - [ ] When the latest assistant message contains form_state_updates (or GenerateThumbnailButton in ui_components), a “Generate now” chip or button is visible in the chat panel.
  - [ ] Clicking “Generate now” calls the same generate action from StudioProvider (same as Manual tab Generate).
  - [ ] While generation is in progress, the button is disabled (same state as Manual Generate).
  - [ ] No new API or backend change.
- **Unit test:** (Integration) Simulate an assistant message with form_state_updates; render chat panel; expect “Generate now” to be visible. Click it; expect generate to be invoked (mock StudioProvider action).
- **Implementation prompt:** In the ViewBait Studio chat panel, when the most recent assistant message includes form_state_updates (or the GenerateThumbnailButton in ui_components), display a “Generate now” suggestion chip or button. On click, invoke the same generate action that the Manual tab’s Generate button uses (from StudioProvider). Disable the chip/button while generation is in progress, using the same isGenerating (or equivalent) state. No backend or API changes; client-only.

---

### D.6 Experiment from thumbnail (Gallery)

- **Problem:** Experiments require a video; starting from a thumbnail the user already likes in Gallery is a natural entry point.
- **Current state:** Experiments are created via API with video_id and channel_id; no “Create experiment” from Gallery.
- **Goal state:** On a thumbnail card in Gallery, add “Run A/B test.” User picks video (and channel if needed); create experiment with that video and attach current thumbnail as one variant; open experiment view or redirect.
- **Acceptance criteria:** [ ] “Run A/B test” or “Create experiment” on thumbnail card. [ ] Modal/sheet to pick YouTube video (use existing videos API). [ ] POST /api/experiments with video_id, channel_id, and attach thumbnail as variant A. [ ] Redirect or open experiment detail. [ ] Handle “YouTube not connected” and errors.
- **Unit test:** (Integration) With YouTube connected, click “Run A/B test” on a thumbnail, select video, submit; expect experiment create with correct video and thumbnail variant.
- **Implementation prompt:** Add a “Run A/B test” (or “Create experiment”) action to thumbnail cards in the ViewBait Studio Gallery. On click, open a modal that lists the user’s YouTube videos (existing API). User selects a video; call POST /api/experiments with video_id and channel_id, and attach the current thumbnail as one variant (e.g. A). Then redirect to the experiment detail view or open it. Handle “YouTube not connected” by showing connect CTA. Reuse existing experiment create API and types.

---

### D.7 Credits low / renewal notifications

- **Problem:** Users hit “insufficient credits” or forget to renew; in-app nudges can reduce churn.
- **Current state:** Notifications can be created server-side; no automatic “credits low” or “renewal soon” events.
- **Goal state:** When credits_remaining < threshold (e.g. 10), create a “Credits low” notification (cooldown once per week). Optionally when subscription period is near end, create “Renewal soon” notification. Use existing notification create (service role).
- **Acceptance criteria:** [ ] In check-subscription or cron, if credits_remaining < 10, create notification with action_url to billing; cooldown 7 days per user. [ ] Optional: near period end, create “Renewal soon” notification. [ ] Use existing types (e.g. warning, billing) and RLS.
- **Unit test:** (Integration) Mock user with credits_remaining = 5; run check or cron; expect notification insert; run again within 7 days; expect no duplicate.
- **Implementation prompt:** In the ViewBait subscription/check flow (e.g. check-subscription route or a small cron), when credits_remaining is below 10, insert a “Credits low” notification for the user with an action_url to the subscription/billing page. Enforce a cooldown of once per 7 days per user (e.g. store last_sent in a small table or derive from existing notifications). Optionally, when subscription period end is within N days, insert a “Renewal soon” notification. Use service role for insert; use existing notification schema and types.

---

### D.8 Style/palette from thumbnail

- **Problem:** Creators want to reuse the “look” of a winning thumbnail as a style or palette.
- **Current state:** Styles and palettes are created via forms; analyze-style and analyze-palette accept reference images.
- **Goal state:** On thumbnail card, add “Save as style” and “Save as palette.” Call analyze API with thumbnail image URL; open style or palette editor with pre-filled data; user saves. Reuse existing analyze and create APIs.
- **Acceptance criteria:** [ ] “Save as style” and “Save as palette” on thumbnail card. [ ] Fetch thumbnail image (signed URL if needed); call analyze-style or analyze-palette with that image. [ ] Open style or palette create modal with pre-filled fields from analyze result. [ ] On save, call existing create API. [ ] Loading and error states.
- **Unit test:** (Integration) Click “Save as style” on a thumbnail; mock analyze response; expect style editor to open with pre-filled data; save; expect style create API called.
- **Implementation prompt:** Add “Save as style” and “Save as palette” actions to thumbnail cards in ViewBait Studio. For “Save as style”: get the thumbnail’s image URL (use existing signed URL or public URL), call POST /api/analyze-style with that image, then open the Style editor (create flow) with the analyze result pre-filled; on save, call POST /api/styles. For “Save as palette”: same flow using analyze-palette and palette create. Handle loading and errors (e.g. analyze failure). Reuse existing analyze and create APIs; do not change their contracts.

---

### D.9 Prompt templates / quick prompts

- **Problem:** New users don’t know what to type; presets reduce time-to-value.
- **Current state:** Thumbnail Text is free-form; no presets.
- **Goal state:** Show 5–10 preset prompts (e.g. “Shocked face + bold text: NEVER EXPECTED THIS”); clicking one sets thumbnailText (and optionally style or aspect ratio). Stored in constants or config; no new API.
- **Acceptance criteria:** [ ] List of presets visible in Manual tab (e.g. below Thumbnail Text or in a “Quick prompts” section). [ ] Clicking a preset sets thumbnailText; optionally set 1–2 other fields (style, aspect ratio) if defined. [ ] User can edit after apply. [ ] No new API.
- **Unit test:** (Integration) Click a preset; expect thumbnailText in StudioProvider to match preset text; optional fields updated if defined.
- **Implementation prompt:** Add prompt templates to the ViewBait Studio Manual tab. Define 5–10 preset strings in a constant (e.g. in lib/constants or next to studio-generator). Render them as chips or buttons (e.g. “Quick prompts”). On click, set thumbnailText to the preset text via StudioProvider; optionally set selectedStyle or selectedAspectRatio if the preset defines them. User can still edit the field after apply. No new API; client-only. Match existing dark UI from brand_identity.md.

---

### D.10 Favorites filter + bulk export

- **Problem:** Users with many thumbnails want to filter by favorites and export several at once.
- **Current state:** Gallery shows thumbnails; favorites API exists; no filter or bulk export.
- **Goal state:** Add “Favorites” filter/tab in Gallery; add “Export selected” or “Export all (favorites)” that downloads selected items (signed URLs or ZIP). Use existing favorites list; optional small export API that returns signed URLs for given IDs.
- **Acceptance criteria:** [ ] Favorites filter/tab in gallery controls; when on, only favorited thumbnails shown. [ ] Multi-select (or “select all on page”) and “Download” or “Export” button. [ ] Export: fetch signed URLs for selected IDs (existing storage API or new GET that returns URLs); trigger downloads or build client-side ZIP. [ ] Optional: limit export to N items to avoid abuse.
- **Unit test:** (Integration) Enable Favorites filter; expect only favorited items in list. Select 2 thumbnails, click Export; expect 2 download requests or ZIP with 2 files (mock signed URLs).
- **Implementation prompt:** In ViewBait Studio Gallery, add a “Favorites” filter (or tab) that shows only thumbnails where isFavorite is true, using the existing favorites API or filtered list. Add multi-select (checkboxes or “select all on page”) and an “Export” or “Download selected” button. When clicked, fetch signed URLs for the selected thumbnail images (use existing signed-url API or a new endpoint that accepts an array of thumbnail IDs and returns URLs); then trigger browser downloads for each URL or use a client-side library to build a ZIP. Optionally cap export at e.g. 50 items. Reuse existing storage and thumbnail APIs.

---

### D.11 Share thumbnail (read-only link)

- **Problem:** Creators want to share a draft with collaborators without giving account access.
- **Current state:** Thumbnails may have public URLs or not; no explicit “share link” flow.
- **Goal state:** “Copy share link” on thumbnail card. If no public URL, optional “Make shareable” that creates a link (e.g. /t/[id] or signed URL); view page shows thumbnail only. Respect is_public or share token; free-tier retention still applies.
- **Acceptance criteria:** [ ] “Copy share link” button on thumbnail card. [ ] If thumbnail has public/shareable URL, copy that URL. [ ] If not, optional “Make shareable” that sets is_public or creates token and returns link; copy that link. [ ] View route (e.g. /t/[id]) shows thumbnail image only; read-only; optional branding. [ ] Free-tier thumbnails may be deleted after 30 days; document or show “link may expire.”
- **Unit test:** (Integration) Thumbnail with is_public true; click “Copy share link”; expect clipboard to contain correct URL. Open /t/[id]; expect thumbnail image to render.
- **Implementation prompt:** Add “Copy share link” to ViewBait thumbnail cards. If the thumbnail already has a public URL (e.g. from GET /api/thumbnails/[id]/public or is_public), copy that URL to clipboard. If not, add an optional “Make shareable” that sets is_public on the thumbnail (PATCH) or creates a short-lived share token and stores it; then copy the resulting link (e.g. origin + /t/[id] or /t?token=…). Add a view route (e.g. app/t/[id]/page.tsx) that fetches the public thumbnail and renders only the image (read-only). Respect RLS and retention (free-tier thumbnails may be deleted after 30 days). Show a toast on copy success.

---

### D.12 Chat history per session (server-side)

- **Problem:** Chat is only in localStorage; power users want to resume or reference past conversations.
- **Current state:** Chat messages in StudioChatPanel are stored in localStorage under a single key; no server persistence.
- **Goal state:** Persist messages per thread on server. New tables: e.g. chat_threads (id, user_id, created_at), chat_messages (id, thread_id, role, content, created_at). API: GET/POST threads, GET/POST messages for thread. Client sends thread_id with chat request; appends new message to thread after send. Optional: list threads in sidebar or modal.
- **Acceptance criteria:** [ ] New tables (or equivalent) for threads and messages; RLS so user sees only own data. [ ] Create thread on first send if none; append message to thread. [ ] GET threads (list), GET messages for thread; POST message (append). [ ] Studio chat panel sends thread_id with POST /api/assistant/chat; on complete, append assistant message to thread via POST. [ ] Optional: thread picker in UI to load a thread.
- **Unit test:** (Integration) Send first message; expect thread created and message stored. Send second message; expect same thread, two messages. List threads; expect current thread in list.
- **Implementation prompt:** Implement server-side chat history for ViewBait Studio. Add tables chat_threads (id, user_id, created_at, updated_at) and chat_messages (id, thread_id, role, content, created_at) with RLS for user_id/thread ownership. API: POST /api/chat/threads (create, return id), GET /api/chat/threads (list for user), GET /api/chat/threads/[id]/messages, POST /api/chat/threads/[id]/messages (append). Modify POST /api/assistant/chat to accept optional thread_id; after generating response, append user and assistant messages to that thread (create thread if none). In StudioChatPanel, maintain currentThreadId; on send, pass thread_id; on response, append to thread. Optionally add a thread list in the chat sidebar to switch threads. Keep localStorage as fallback for “current draft” if desired; do not remove existing chat UI behavior.

---

### D.13 Free-tier “first 3 gens” highlight

- **Problem:** Free users may not realize they get a few free generations; highlighting can increase first gen.
- **Current state:** Sidebar shows tier and credits; no specific “first N” messaging.
- **Goal state:** For free tier, show a short message in sidebar or generator: “Your first 3 generations are on us” or “X credits this month — try a generation.” Dismissible or compact strip. Use credits_remaining if we don’t track “first 3” separately.
- **Acceptance criteria:** [ ] For tier “free,” show a compact message (e.g. “10 credits this month — try a generation” or “Your first generations are on us”). [ ] Place in sidebar or above generator; dismissible or always visible. [ ] Copy consistent with tier config (e.g. credits_per_month from tiers API).
- **Unit test:** (Integration) Mock free tier; expect message visible. Mock paid tier; expect message not shown (or different copy).
- **Implementation prompt:** In ViewBait Studio, for users on the free tier (use useSubscription().tier === 'free'), display a short, compact message in the sidebar or above the generator: e.g. “10 credits this month — try a generation” (use creditsTotal or tier config from useSubscriptionTiers). Optionally “Your first generations are on us.” Make it dismissible (localStorage) or always visible. Do not show for paid tiers (or show different copy). Match existing dark UI and typography from brand_identity.md.

---

### D.14 A/B result summary in Studio

- **Problem:** Experiment results (winner, watch-time) live only in experiment detail; surfacing in Studio increases completion and learning.
- **Current state:** Experiments list and detail exist; no summary in main Studio layout.
- **Goal state:** In sidebar or “Experiments” section, show a compact card: “Latest experiment: B won (+12% watch time)” with link to experiment. Or list last 1–3 experiments with status and winner. Use GET /api/experiments and result/analytics.
- **Acceptance criteria:** [ ] Fetch recent experiments (e.g. GET /api/experiments?limit=3). [ ] For each, if completed, fetch result (winner, watch_time_share). [ ] Render compact card(s) in sidebar or dedicated section: experiment title/video, winner variant, optional watch time delta; link to experiment detail. [ ] Handle “no experiments” and loading.
- **Unit test:** (Integration) Mock experiments API with one completed experiment and result; expect card to show winner and link.
- **Implementation prompt:** Add an “Experiments” summary to ViewBait Studio (sidebar or a small section). Call GET /api/experiments with limit 3 (or 1). For each experiment, if status is completed, fetch the result (e.g. from experiment detail or GET /api/experiments/[id] which includes result). Render a compact card per experiment: video/title, winner variant (e.g. “B won”), optional watch time share delta; link to the experiment detail page. Handle no experiments (hide section or show “No experiments yet”) and loading state. Reuse existing experiments and analytics APIs.

---

### D.15 Cookie consent + policy link

- **Problem:** Cookie policy exists; some regions expect consent and a clear link.
- **Current state:** Footer has Privacy and Terms; cookie-policy.md exists; no banner or footer link for cookies.
- **Goal state:** Minimal cookie consent banner (“We use cookies… [Accept] [Learn more]”); Accept sets a flag in localStorage and hides banner. “Learn more” links to /legal/cookie-policy. Footer adds “Cookies” link to same page.
- **Acceptance criteria:** [ ] Banner component; show on first visit (no localStorage key). [ ] “Accept” sets key (e.g. cookie_consent=accepted) and hides banner. [ ] “Learn more” links to /legal/cookie-policy. [ ] Footer includes “Cookies” link to /legal/cookie-policy. [ ] Banner is minimal and dismissible only via Accept (or add “Dismiss” that also sets key).
- **Unit test:** (Integration) Load app without key; expect banner visible. Click Accept; expect banner hidden and key set. Reload; expect banner not shown.
- **Implementation prompt:** Add a minimal cookie consent banner to the ViewBait app. Use the root layout or a client component that checks localStorage for a key (e.g. viewbait_cookie_consent). If not set, show a compact banner: “We use cookies to improve your experience. [Accept] [Learn more].” Accept sets the key and hides the banner. “Learn more” links to /legal/cookie-policy (existing page). Add “Cookies” to the footer next to Privacy and Terms, linking to /legal/cookie-policy. Keep the banner minimal and non-intrusive; do not block usage. Match dark UI from brand_identity.md.

---

## E) Roadmap Recommendation

Recommended order for the **first 5 features** to build, to reduce risk and compound value:

1. **Referral link pre-fill (C.2)** — **Effort: S.** Unblocks growth with minimal change; no new backend; immediate impact on referral conversion. Low risk.
2. **Chat “Generate now” CTA (C.5)** — **Effort: S.** Short path from chat to revenue (generation uses credits); improves time-to-value and conversion from chat. Client-only.
3. **Wire notifications (C.3)** — **Effort: M.** Makes the existing notification system useful; supports retention and future features (credits low, referral). Establishes the habit of “check bell.”
4. **First-run wizard (C.1)** — **Effort: M.** Directly targets activation; best done after referral and chat CTA so new users have a clear path and we can measure wizard vs no-wizard cohorts.
5. **“Apply to YouTube” from Results (C.4)** — **Effort: M.** Ties generation to outcome (thumbnail on video); increases perceived value and stickiness. Depends on connect flow and set-thumbnail already being stable.

**Why this order:**  
- Start with two small, high-leverage changes (referral link, chat CTA) that don’t depend on each other and ship fast.  
- Then activate the notification pipeline so that when we add more triggers later, users are already used to the bell.  
- Then invest in onboarding (wizard) when we have better referral and chat conversion; we can A/B or measure activation with and without wizard.  
- Finally, surface “Apply to YouTube” so that the full loop (generate → use on YouTube) is obvious and we can measure time-to-value and retention.

---

*Document generated from codebase and docs audit. Update this file when vision or constraints change.*
