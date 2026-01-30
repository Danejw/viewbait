# Onboarding Proposal: Thumbnail Generation Walkthrough

This document proposes an initial user onboarding plan for ViewBait. The onboarding is a **multi-step, self-contained workflow** that walks users through generating their first thumbnail: **name → (optional) face upload → pick style → generate**. It lives on its own `/onboarding` page and does not depend on or alter the main Studio or other app functionality.

---

## 1. The Smallest Core Behavior ("Aha Moment")

**Core behavior:** A new user **generates their first thumbnail** and sees the result on screen.

**Minimal path to that moment:**

- User gives a **name/title** for the thumbnail (e.g. "YOU WON'T BELIEVE THIS").
- User **optionally** uploads a face (can skip).
- User **picks a style** (from public/default styles so it works for free tier).
- User clicks **Generate** and sees the generated image.

The "aha moment" is: *"I described something, chose a look, and got a real thumbnail in seconds."* Everything in the onboarding flow should optimize for reaching this outcome quickly and clearly.

**Inferred from the codebase:**

- `thumbnailText` in Studio is the primary prompt/title (`studio-provider.tsx`, `studio-generator.tsx`).
- Generation requires `thumbnailText`; `generateThumbnails` returns early with "Please enter thumbnail text" if empty (`studio-provider.tsx`).
- Public/default styles are available without auth for display and are usable for generation (`public_styles`, `useStyles` / `getPublicStyles`).
- Face is optional; generation works with `faceCharacters` undefined (`studio-provider.tsx`, `app/api/generate/route.ts`).

So the **smallest core behavior** is: **enter name → select style → generate → see thumbnail.** Face is an optional enhancement step.

---

## 2. Main Steps: From Initial Access to Core Behavior

Outline of the steps that take the user from landing on onboarding to completing the core behavior.

| Step | Goal | User action |
|------|------|-------------|
| **0. Entry** | User reaches onboarding | Navigate to `/onboarding` (link from landing, auth, or email). |
| **1. Name** | Set thumbnail title/prompt | Enter a short name or phrase (e.g. "MIND BLOWN", "SECRET REVEALED"). |
| **2. Face (optional)** | Add a face to the thumbnail | Upload 1+ face images **or** skip. |
| **3. Style** | Choose visual style | Pick one style from a small set (public/default styles). |
| **4. Generate** | Create the thumbnail | Click Generate; show loading then result. |
| **5. Complete** | Celebrate and transition | Show success, optional download/share, CTA to Studio or "Create another". |

**Flow rules:**

- **Linear steps:** One step visible at a time (or clearly grouped: e.g. Name + optional Face, then Style, then Generate).
- **No branching from Studio:** Onboarding uses only local/onboarding state and dedicated UI. It does not read or write `StudioProvider`, `currentView`, or sidebar state.
- **Re-run every time:** Visiting `/onboarding` always shows the same flow from step 1. No "already onboarded" skip inside the page (middleware or marketing can still send users to `/studio` by default after signup if desired).

**Data flow (contained):**

- State: React state (or a small context) scoped to the onboarding page: `name`, `faceUrls` (or `faceId` if reusing faces API), `selectedStyleId`, `generatedThumbnailUrl` / `generatedThumbnailId`.
- Generation: Call existing `POST /api/generate` with:
  - `title`: from step 1 (name).
  - `style`: from step 3 (public style id).
  - `faceCharacters`: from step 2 if user uploaded and we have images; otherwise omit.
  - Omit or fix: project, palette, resolution, aspect ratio to safe defaults so onboarding stays simple and does not depend on Studio project/settings.

This keeps the flow self-contained while reusing the same backend contract as Studio.

---

## 3. Strategies to "Hold the User's Hand"

**3.1 Progress and orientation**

- **Step indicator:** e.g. "Step 1 of 4" or a stepper (Name → Face → Style → Generate) so users always know where they are and how many steps remain.
- **Short step titles:** e.g. "Name your thumbnail", "Add your face (optional)", "Pick a style", "Generate".
- **One primary action per step:** One main button ("Next", "Skip", "Generate") to avoid choice overload.

**3.2 Clarity and guidance**

- **Copy per step:** One sentence explaining what to do (e.g. "This text will appear on your thumbnail or guide the image.").
- **Placeholders and examples:** Placeholder in the name input (e.g. "e.g. MIND BLOWN") and 2–3 example names as chips or links that fill the input.
- **Style step:** Show 4–8 public/default styles as cards with thumbnail preview and name; selection is obvious (border or checkmark).

**3.3 Optional steps**

- **Face step:** Clearly label "Optional". Buttons: "Upload face" and "Skip". Skip goes to Style without requiring upload.
- **Skip should feel safe:** e.g. "You can add a face later in Studio."

**3.4 Validation and errors**

- **Name:** Require non-empty trim; disable "Next" or "Generate" until valid. Inline message: "Please enter a name or phrase."
- **Generate:** If API returns an error, show a short message near the button and optionally retry. Do not leave the user stuck.

**3.5 Avoid overwhelming**

- No tabs (Manual/Chat), no custom instructions, no resolution/variations/aspect ratio in the main flow.
- No sidebar, no gallery, no projects in the onboarding UI.
- Optional: "Advanced options" collapsible on the Generate step (e.g. resolution) only if product wants it; default = hide.

---

## 4. Making Steps Easy and Intuitive

**4.1 Defaults**

- **Name:** Pre-fill with a harmless example only if you want (e.g. "My First Thumbnail"); otherwise leave empty so the user types something personal.
- **Style:** No pre-selection, or pre-select the first public style so "Generate" works with one click after name.
- **Resolution / aspect ratio:** Use API defaults (e.g. 16:9, 1K) so the request body stays minimal.

**4.2 Encouragement**

- **Micro-copy:** After name: "Great, that’ll pop on the thumbnail." After style: "Nice choice. Ready to generate?"
- **Generate button:** Primary CTA, e.g. "Generate my thumbnail". During load: "Creating your thumbnail…" and a spinner or skeleton.

**4.3 Rewarding completion**

- **Success state:** Full-width or large preview of the generated image with a short message: "Your thumbnail is ready."
- **Actions:** "Download" and "Open in Studio" (link to `/studio`). Optional: "Create another" that resets to step 1 (same session).
- **Light celebration:** Simple confetti or a checkmark animation on first success (no sound unless user preference).

**4.4 Accessibility and mobile**

- **Focus:** On step change, move focus to the main input or primary button.
- **Labels:** All inputs and buttons have clear labels/aria-labels.
- **Touch:** Buttons and style cards have enough tap area; spacing between "Skip" and "Upload" so mobile users don’t mis-tap.

---

## 5. Implementation Outline (Inferred from Codebase)

**5.1 Route and containment**

- **Route:** `app/onboarding/page.tsx` → `/onboarding`.
- **No Studio stack:** Do not wrap the page in `StudioProvider`, `StudioDndContext`, or any studio layout. Use the app layout (e.g. `layout.tsx`) only for global chrome (header/footer) if desired, or a minimal onboarding layout (logo + optional "Back to home").
- **Auth:** If generation requires auth, redirect unauthenticated users to `/auth?redirect=/onboarding` (reuse existing middleware pattern). Middleware: add `/onboarding` to the same protection as `/studio` if both require login, or keep onboarding public and call an API that allows anonymous generation if such a contract exists; today `requireAuth` is used in `app/api/generate/route.ts`, so onboarding should run only when the user is signed in.

**5.2 Page structure**

- **State:** `useState` for `step` (1–4 or 1–5), `name`, `faceImageUrls` (or one face from onboarding upload), `selectedStyleId`, `isGenerating`, `generatedResult`, `error`.
- **Steps:** Render one step per `step` value; "Next" / "Skip" advance `step`; "Generate" calls the API then shows result (and optionally a 5th "Complete" step).
- **APIs:**
  - **Styles:** Reuse public styles: `GET /api/styles` (or use `useStyles`/`getPublicStyles` from a small hook) and filter to a subset (e.g. first 8 or "default" only) for the Style step.
  - **Face:** Option A — In onboarding only, allow a single temporary upload to storage (e.g. a dedicated bucket or path like `onboarding-faces/{userId}/{sessionId}.jpg`) and pass that URL in `faceCharacters` for `POST /api/generate`. Option B — Reuse `POST /api/faces/upload` and create a face, then use that face’s images in `faceCharacters`; this ties onboarding to the real Faces feature (may require tier check). Option A keeps onboarding more contained.
  - **Generate:** `POST /api/generate` with `title: name`, `style: selectedStyleId`, `faceCharacters` if user added face, and minimal other fields (or defaults).

**5.3 UI components**

- Reuse existing primitives: `Button`, `Input`, `Card`, `Label` from `@/components/ui`. Use existing `ViewBaitLogo` for branding.
- Style grid: Simple grid of cards (image + name), same pattern as `StyleThumbnailCard` or `style-grid` but without Studio context.
- No need to import `StudioGenerator`, `StudioSidebar`, or `studio-views` on the onboarding page.

**5.4 Middleware**

- If `/onboarding` should be protected: in `middleware.ts`, add `"/onboarding"` to `PROTECTED_ROUTES` so unauthenticated users are sent to `/auth?redirect=/onboarding`. This keeps behavior consistent with Studio and ensures generation is always authenticated.

**5.5 Navigation to onboarding**

- From landing: optional "Try the walkthrough" or "First time? Start here" link to `/onboarding`.
- From auth: after signup/login, redirect to `redirect` query param; marketing or app logic can set `redirect=/onboarding` for new users.
- Direct: Anyone opening `/onboarding` goes through the full flow every time (no "already completed" shortcut on the page).

---

## 6. Summary

| Item | Proposal |
|------|----------|
| **Aha moment** | User generates their first thumbnail (name + style + optional face) and sees the result. |
| **Steps** | 1) Name → 2) Face (optional) → 3) Style → 4) Generate → 5) Success + CTA to Studio. |
| **Hand-holding** | Stepper, one action per step, short copy, validation, skip for optional face. |
| **Ease** | Defaults, example names, clear success state, Download + "Open in Studio". |
| **Containment** | Dedicated `/onboarding` page; own state; no StudioProvider/studio views; reuse `/api/generate` and public styles only. |
| **Re-run** | Visiting `/onboarding` always runs the full flow; no in-page "already onboarded" skip. |

This structure gives a clear, safe onboarding path that demonstrates the core value of ViewBait without coupling it to the main Studio feature set.
