# Case Study: Guided Chat That Fills the Studio Form for You

**Project:** ViewBait.app  
**Link:** https://viewbait.app

**Case study type:** Feature design  
**The task:** Replace raw prompt engineering with a guided assistant that pre-fills the same studio form manual mode uses.  
**What we learned:** Users want a conversation that updates controls, not a chat that bypasses them.  
**Last updated:** June 2026

## Case study at a glance

| | |
|---|---|
| **The task** | Build a studio assistant that interprets natural language and syncs choices to the shared generator form |
| **Who it was for** | All creators in chat mode, plus Pro users who need YouTube-aware assistance |
| **Main constraint** | Chat and manual mode must share one form state so switching modes never loses context |
| **What we built** | Studio Form Sync: chat panel, structured UI sections, form_state_updates, suggestion chips |
| **Outcome** | Creators describe intent in plain language and fine-tune in manual without retyping |

## Background

Early AI image tools trained users to write prompts. ViewBait deliberately moved away from that. The studio form is the product: title, face, style, palette, ratio, resolution, variations.

But some creators still think in sentences. "Make it more dramatic." "Use my gaming style." "Three versions, 16:9." They do not want to hunt toggles. They also do not want a black box that generates without showing settings.

The gap was a **guided layer** that translates language into form fields users can see and adjust.

## The task

1. Add chat mode beside manual mode in the generator
2. Interpret user messages and return helpful replies
3. Surface one or two relevant form sections per turn (not the entire form at once)
4. Pre-fill matching fields via structured `form_state_updates`
5. Keep chat and manual perfectly in sync through shared `StudioProvider` state

Separate Pro-only **YouTube Assistant** view extends the same pattern for channel questions. This case study focuses on the core studio chat used in generation.

## Constraints

- **No prompt exposure:** Server builds image prompts. Chat never asks users to write model syntax.
- **Focused UI:** Return 1 to 2 `ui_components` per response, not every section at once.
- **Always pre-fill:** Surfacing a section without setting its value wastes a turn.
- **Tier-aware replies:** YouTube actions in chat show upgrade chips for non-Pro users instead of failing silently.
- **Persistence:** Chat history survives refresh via session storage so mid-flow creators do not lose context.

## Our approach

Studio Form Sync runs on `POST /api/assistant/chat`. Gemini receives conversation history, current form state, available styles and palettes, and user tier. It returns a human message, optional UI components to render, form updates, and next-step suggestion chips. Client applies updates through `applyFormStateUpdates` in `StudioProvider`. Manual mode immediately reflects chat decisions.

## How we solved it

### Step 1: One form state in StudioProvider

**What we did:** Centralized thumbnail settings in studio state. Both manual controls and chat read and write the same object.

**Decision:** Single source of truth, not a chat-specific duplicate form.

**Why:** Users switch modes constantly. Duplicated state guarantees drift and support tickets.

### Step 2: Structured assistant responses

**What we did:** Function calling returns `human_readable_message`, `ui_components`, `form_state_updates`, and `suggestions`.

**Decision:** Limit components to 1 to 2 per turn with explicit pre-fill mapping in the system prompt.

**Why:** Dumping the whole form overwhelms mobile layouts and feels like a settings page, not a guide.

### Step 3: Dynamic UI renderer

**What we did:** `DynamicUIRenderer` mounts real generator sections (title, face, style, palette, ratio, etc.) inline in the chat thread.

**Decision:** Reuse existing section components, not chat-only stubs.

**Why:** What you set in chat is exactly what manual mode shows. No translation layer for the user.

### Step 4: Name-to-ID resolution

**What we did:** When the model returns a style or palette by name, client resolves to UUID against loaded libraries before applying.

**Decision:** Accept natural names from the model, normalize on the client.

**Why:** Users say "gaming style," not UUIDs. Resolution keeps the database happy without forcing jargon in chat.

### Step 5: Tier-aware YouTube handling

**What we did:** System prompt includes tier and YouTube availability. Non-Pro requests for channel actions return upgrade suggestions with `offer_upgrade: true`.

**Decision:** Explain and upsell in chat instead of generic errors.

**Why:** Chat is a discovery surface for Pro value. Failures should teach what unlocks next.

## What we built

- Manual and Chat tabs in the generator
- Studio chat panel with persistence, attachments, and suggestion chips
- `/api/assistant/chat` with form sync and focused UI surfacing
- Shared `applyFormStateUpdates` for title, face, style, palette, ratio, resolution, variations, custom instructions
- Pro-gated YouTube Assistant view for channel-specific questions (same sync pattern, extended tools)

## Results

**Before:** Creators either typed long custom instructions or clicked every toggle manually.

**After:** "Shocked face, bold style, two variations" pre-fills the form in one message. Manual mode opens ready to tweak or generate.

**How we know it worked:** Chat mode users have similar completion rates to manual with fewer field edits before first generate. Mode switches mid-session increased, which indicates trust in shared state.

## What you can learn

1. **Translate intent into visible state.** Conversational UI should update controls, not hide them.
2. **One section per turn.** Guided does not mean dumping every input at once.
3. **Pre-fill is mandatory.** Surfacing without values feels broken.
4. **Share state across modes.** Chat plus manual is one workflow, not two products.
5. **Upsell in context.** When a message requests a gated feature, explain the tier in the reply.

## Next step

Open [viewbait.app](https://viewbait.app), switch to Chat, say what you want in one sentence, then flip to Manual and generate without re-entering anything. Edit one field and send another message to watch both modes stay aligned.
