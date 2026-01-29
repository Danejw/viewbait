# ViewBait — Brand Identity

**Purpose:** This document defines ViewBait’s brand identity for the root/landing page and application. Use it with design tools (e.g. Claude) to iterate on layout, copy, and visuals while staying on-brand.

---

## 1. Product Summary

- **Name:** ViewBait  
- **Tagline (working):** AI-powered thumbnails for creators. Describe what you want; get scroll-stopping results.  
- **One-liner:** ViewBait is an AI-powered thumbnail generator that helps YouTube and video creators produce high-converting thumbnails through conversational AI, face integration, and reusable styles—without design skills.

---

## 2. Target Market & Audience

### Primary audience (who we’re designing for)

- **YouTube creators** — hobbyists to full-time; gaming, vlog, tutorial, reaction, education.  
- **Content marketing teams** — teams that produce video and need consistent thumbnails.  
- **Social media managers** — people who need thumbnails for YouTube, Shorts, and cross-platform.  
- **Course creators & educators** — video lessons that need clear, professional thumbnails.

### What they care about

- **Speed** — “I don’t have time for Photoshop.”  
- **Quality** — Thumbnails that look pro and get clicks.  
- **Ease** — No design degree; describe it, get it.  
- **Consistency** — Same “look” across videos (brand, face, style).  
- **Control** — Their face, their style, their platform (YouTube, Shorts, etc.).

### Design implications

- **Tone:** Confident but approachable; expert without being intimidating.  
- **Visuals:** Dark, focused, “creator studio” feel—not corporate or playful-first.  
- **Trust:** Emphasize “your face, your style,” AI that understands thumbnails, and fast iteration.  
- **Platform cue:** YouTube is the anchor; accent color can nod to YouTube red without copying it.

---

## 3. Color Palette

### Primary palette (application & landing)

| Role | Hex | Usage |
|------|-----|--------|
| **Background** | `#0a0a0b` | Main app/landing background (deep black). |
| **Surface** | `#141415` | Cards, panels, sections. |
| **Surface elevated** | `#1c1c1e` | Modals, dropdowns, popovers. |
| **Border** | `#2a2a2c` | Default borders. |
| **Border hover** | `#3a3a3c` | Hover/active borders. |
| **Text primary** | `#fafafa` | Headings, body. |
| **Text secondary** | `#a1a1a1` | Labels, captions, secondary copy. |
| **Text tertiary** | `#6b6b6b` | Placeholders, disabled. |
| **Accent (primary)** | `#ff0000` | Primary CTAs, links, key UI (YouTube-inspired red). |
| **Accent hover** | `#cc0000` | Hover state for accent. |
| **Accent muted** | `#ff000020` | Subtle accent backgrounds (e.g. hover on cards). |

### Semantic colors

| Role | Hex | Usage |
|------|-----|--------|
| **Success** | `#22c55e` | Success states, confirmations. |
| **Warning** | `#f59e0b` | Warnings, limits. |
| **Error** | `#ef4444` | Errors, destructive actions. |
| **Info** | `#3b82f6` | Informational messages. |

### Why these colors

- **Dark base:** Keeps focus on thumbnail previews; avoids washing them out; feels like a creator tool, not a generic SaaS.  
- **Single strong accent (red):** Recognizable, high-contrast, action-oriented; subtle YouTube association without being a clone.  
- **Neutral grays:** Support hierarchy and readability; don’t compete with generated thumbnails.

### Landing-page specifics

- **Hero:** Dark background (`#0a0a0b`), white/off-white headline (`#fafafa`), accent for primary CTA only.  
- **Sections:** Alternate `#0a0a0b` and `#141415` for rhythm.  
- **CTAs:** Use accent red for primary button; secondary can be outline or surface color.  
- **Trust/features:** Prefer text and icons in primary/secondary text colors; avoid extra accent except for key links.

---

## 4. Typography

- **Font family:** Inter (with system fallbacks: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`).  
- **Scale:**  
  - Hero / big headline: ~30px (e.g. `text-3xl`).  
  - Section titles: ~24px (`text-2xl`).  
  - Subsections: ~20px (`text-xl`).  
  - Body: 16px (`text-base`).  
  - Small/captions: 14px (`text-sm`), 12px (`text-xs`) for labels/badges.  
- **Weights:** 400 body, 500 labels/buttons, 600 headings.  
- **Line height:** ~1.5 body, ~1.2–1.3 headings.

---

## 5. Spacing & Shape

- **Base unit:** 4px. Use 8, 12, 16, 24, 32, 48px for consistency.  
- **Border radius:** 6px (small), 8px (buttons/cards), 12px (panels), 16px (large blocks). Rounded but not pill-shaped.  
- **Shadows:** Minimal; prefer border and background contrast over heavy drop shadows.

---

## 6. Voice & Messaging

- **Tone:** Friendly, capable, a bit of wit. “The expert friend who gets thumbnails.”  
- **Do:** “Let’s make something that stops the scroll.” / “Your face. Your style. One prompt.” / “Describe it. We’ll make it.”  
- **Don’t:** “Please select your preferred thumbnail parameters.” / “Generation complete. Output saved.”  
- **Landing:** Lead with outcome (scroll-stopping thumbnails, fast, no design skills). Support with clarity (conversational AI, face library, styles) and social proof when available.

---

## 7. Visual Principles (for landing and app)

1. **Dark-first** — Default is dark; no bright white backgrounds.  
2. **Accent sparingly** — Red for primary actions and key emphasis only.  
3. **No gradients on UI chrome** — Save visual punch for thumbnail previews and optional marketing imagery.  
4. **No heavy drop shadows** — Prefer flat or light elevation.  
5. **Consistency** — Same palette and type scale on landing and in-app so the transition feels continuous.  
6. **Mobile parity** — Landing and app both work on small screens; touch-friendly, readable.

---

## 8. What to Avoid

- Bright or pure-white backgrounds.  
- Multiple accent colors competing with red.  
- Corporate or playful-first illustration style that doesn’t match “creator tool.”  
- Emojis in UI/marketing copy.  
- Generic “AI” imagery (robots, glowing brains); prefer thumbnails, faces, and creation.  
- Copy that sounds like enterprise software (parameter selection, “output saved,” etc.).

---

## 9. Assets & Iconography

- **App icon:** Currently a frame/thumbnail-style mark with a red gradient (`#991b1b` → `#b91c3c`). Keeps “thumbnail” and “play/video” association.  
- **Landing:** Use product screenshots (dark UI + thumbnails), simple icons for features, and optional short loops/GIFs of the product in action.  
- **Logo lockup:** Use “ViewBait” in Inter (semibold); accent color for “View” or a single element if desired, not the whole word.

---

## 10. Handoff Notes for Design Iteration

When iterating on the root/landing page with Claude (or any designer):

1. **Hero:** Headline + subline + one primary CTA (accent). Optional secondary CTA (outline/surface).  
2. **Social proof:** Placeholder for testimonials, creator logos, or “X thumbnails generated.”  
3. **Feature blocks:** Short benefit-led copy; dark sections; icons or small thumbnails; no clutter.  
4. **Pricing:** Clear tiers; primary CTA on recommended plan in accent.  
5. **Footer:** Links, legal, optional newsletter; keep background `#0a0a0b` or `#141415`.  
6. **Consistency:** Every new section should pull from this palette and type scale so the file stays the single source of truth for brand.

Use this document as the constraint set: colors, audience, and principles are fixed; layout, copy, and imagery can be iterated within these bounds.
