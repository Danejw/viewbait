# Subscription-Dependent Behavior

This document audits how subscription tiers are implemented and where tier-dependent behavior appears across the codebase. It covers data sources, client and server usage, API enforcement, and UI gating.

---

## 1. Tier Model and Data Sources

### 1.1 Tier Names and Types

- **Type:** `TierName` = `'free' | 'starter' | 'advanced' | 'pro'`
- **Definition:** [lib/constants/subscription-tiers.ts](viewbait/lib/constants/subscription-tiers.ts)

Tier names are used everywhere (client, server, API responses) and must stay in sync with the database `subscription_tiers.tier_name` and display names (`Free`, `Starter`, `Advanced`, `Pro`).

### 1.2 Tier Configuration (TierConfig)

The canonical shape for “what a tier allows” is `TierConfig` in [lib/constants/subscription-tiers.ts](viewbait/lib/constants/subscription-tiers.ts):

| Field | Purpose |
|-------|---------|
| `name` | Display name (e.g. "Free", "Starter") |
| `product_id` | Stripe product ID (mode-aware: test vs live) |
| `price_id` | Stripe price ID (mode-aware) |
| `credits_per_month` | Monthly credit allowance |
| `allowed_resolutions` | e.g. `['1K']`, `['1K','2K']`, `['1K','2K','4K']` |
| `allowed_aspect_ratios` | e.g. `['16:9']` for free; full set for advanced/pro |
| `has_watermark` | Whether thumbnails get a watermark |
| `has_enhance` | Whether AI title enhancement is allowed |
| `persistent_storage` | Whether thumbnails are kept beyond retention |
| `storage_retention_days` | e.g. 30 for free; null for permanent |
| `priority_generation` | Priority in generation queue |
| `early_access` | Early access to features |
| `price` | Display price |
| `max_variations` | Max variations per generate (1–4) |
| `can_create_custom` | Can create custom styles, palettes, faces |

Tier configuration is **not** hard-coded in the app: it is loaded from the database and (on the client) from the tiers API.

### 1.3 Where Tier Data Comes From

| Layer | Source | Usage |
|-------|--------|--------|
| **Database** | `subscription_tiers` | One row per tier; columns map to `TierConfig`. Optional `allowed_aspect_ratios`; if missing, server uses `ASPECT_RATIOS_BY_TIER` from constants. |
| **Database** | `subscription_settings` | Key-value store for `resolution_credits_1k`, `resolution_credits_2k`, `resolution_credits_4k`, `edit_credit_cost`. |
| **Database** | `user_subscriptions` | Per user: `product_id`, `credits_remaining`, `credits_total`, `status`, period dates. `product_id` links the user to a tier. |
| **Server** | [lib/server/data/subscription-tiers.ts](viewbait/lib/server/data/subscription-tiers.ts) | In-memory cache of tiers and settings (5 min TTL). Exposes `getTierByProductId`, `getTierByName`, `getTierNameByProductId`, `getAllTiers`, `getResolutionCredits`, `getEditCreditCost`. Uses Stripe mode (test vs live) to choose `test_product_id`/`live_product_id`. |
| **Client – tier list** | `GET /api/tiers` → [lib/hooks/useSubscriptionTiers.ts](viewbait/lib/hooks/useSubscriptionTiers.ts) | Fetches all tiers and resolution/edit credit settings. Used for subscription modal and any place that needs tier config by name or by product ID. |
| **Client – current user** | `POST /api/check-subscription` → [lib/services/stripe.ts](viewbait/lib/services/stripe.ts) (server) + [lib/hooks/useSubscription.tsx](viewbait/lib/hooks/useSubscription.tsx) | Returns current user’s `tier`, `product_id`, credits, etc. Subscription hook stores this and derives `tierConfig` via `getTierByProductId(productId)` from `useSubscriptionTiers`. |

So: **tier definitions** come from DB (and cache/API); **current user’s tier** comes from `user_subscriptions` + `getTierByProductId`; **credit costs** come from `subscription_settings` (and API).

### 1.4 Code-Only Constants (No DB)

These are fixed in code and used for behavior that is not stored in the DB:

- **Aspect ratios per tier**  
  [lib/constants/subscription-tiers.ts](viewbait/lib/constants/subscription-tiers.ts): `ASPECT_RATIOS_BY_TIER`, `ASPECT_RATIO_DISPLAY_ORDER`.  
  Server uses these as fallback when `subscription_tiers.allowed_aspect_ratios` is not set.

- **Generate thumbnail cooldown (seconds) per tier**  
  [lib/constants/subscription-tiers.ts](viewbait/lib/constants/subscription-tiers.ts): `GENERATE_COOLDOWN_SECONDS_BY_TIER` (free: 12, starter: 8, advanced: 4, pro: 2).  
  Helper: `getGenerateCooldownMs(tier)`.

- **Minimum tier for N variations**  
  `getRequiredTierForVariations(variations)` (free/starter/advanced/pro for 1/2/3/4).

- **Minimum tier for resolution**  
  `getRequiredTierForResolution(resolution)` (1K→free, 2K→starter, 4K→advanced).

---

## 2. Client-Side Subscription State and Helpers

### 2.1 useSubscription (SubscriptionProvider)

**File:** [lib/hooks/useSubscription.tsx](viewbait/lib/hooks/useSubscription.tsx)

Provides the **current user’s** subscription state and tier-based helpers. Must be used inside `SubscriptionProvider`.

- **State:** `tier`, `tierConfig`, `creditsRemaining`, `creditsTotal`, `subscriptionEnd`, `isSubscribed`, `isLoading`, `productId`.
- **Feature checks (all derived from `tierConfig` and credits):**
  - `canUseResolution(resolution)` — tier’s `allowed_resolutions`
  - `canUseAspectRatio(ratio)` — tier’s `allowed_aspect_ratios`
  - `canUseEnhance()` — tier’s `has_enhance`
  - `hasCredits(amount?)` — `creditsRemaining >= amount`
  - `getResolutionCost(resolution)` — from `useSubscriptionTiers().resolutionCredits`
  - `hasWatermark()` — tier’s `has_watermark`
  - `canCreateCustomAssets()` — tier’s `can_create_custom`
  - `getMaxVariations()` — tier’s `max_variations`
- **Actions:** `refreshSubscription`, `deductCredits`, `openCheckout`, `openCustomerPortal`.

Subscription status is fetched via `POST /api/check-subscription` and refreshed on an interval (60s), on window focus, etc. Tier name is resolved from the API response; `tierConfig` is then obtained from `useSubscriptionTiers().getTierByProductId(productId)`.

### 2.2 useSubscriptionTiers

**File:** [lib/hooks/useSubscriptionTiers.ts](viewbait/lib/hooks/useSubscriptionTiers.ts)

Fetches `GET /api/tiers` and exposes:

- `tiers` — `Record<TierName, TierConfig>`
- `resolutionCredits` — credit cost per resolution (1K/2K/4K)
- `editCreditCost` — credits per edit
- `getTierByProductId(productId)` — tier config for a Stripe product ID
- `getTierByName(tierName)` — tier config by tier name

Used by `useSubscription` (to get `tierConfig` from `productId`) and by the subscription modal (to show plans and features).

---

## 3. Server-Side Tier Resolution

### 3.1 getTierForUser(supabase, userId)

**File:** [lib/server/utils/tier.ts](viewbait/lib/server/utils/tier.ts)

Loads `user_subscriptions` for the user, reads `product_id`, and returns `getTierByProductId(product_id)` (or free tier if no subscription). Use this in API routes when you need the **current user’s tier config** for gating (e.g. resolution, aspect ratio, variations, custom assets).

### 3.2 getTierByProductId(productId) / getTierByName(tierName)

**File:** [lib/server/data/subscription-tiers.ts](viewbait/lib/server/data/subscription-tiers.ts)

Resolve tier configuration from the cached tier list. Product ID is mode-aware (test vs live Stripe). Used by generate, enhance-title, Stripe webhook, etc.

### 3.3 getResolutionCredits() / getEditCreditCost()

**File:** [lib/server/data/subscription-tiers.ts](viewbait/lib/server/data/subscription-tiers.ts)

Read from cached `subscription_settings` (with defaults). Used for credit checks and deductions on generate and edit.

---

## 4. API Routes: Tier and Credit Enforcement

### 4.1 POST /api/generate

**File:** [app/api/generate/route.ts](viewbait/app/api/generate/route.ts)

- **Tier:** `getTierForUser(supabase, user.id)`.
- **Credits:** `user_subscriptions.credits_remaining`; cost = `getResolutionCredits()[resolution] * variations`.
- **Enforcement:**
  - `variations` capped by `tier.max_variations`; otherwise 403 tier limit.
  - If request has custom style/palette/face and `!tier.can_create_custom` → 403 (Starter+ required).
  - Resolution must be in `tier.allowed_resolutions` → 403 if not.
  - Aspect ratio must be in `tier.allowed_aspect_ratios` → 403 if not.
  - Credits must be ≥ total cost; otherwise insufficient-credits response.
- **Side effects:** Sets `has_watermark` on thumbnail row from `tier.has_watermark`. Deducts credits after successful generation.

### 4.2 POST /api/edit

**File:** [app/api/edit/route.ts](viewbait/app/api/edit/route.ts)

- **Credits only:** No tier gating for “can use edit.” Uses `getEditCreditCost()` and `user_subscriptions.credits_remaining`. If remaining < cost, returns insufficient-credits response. Deducts credits on success.

### 4.3 POST /api/enhance-title

**File:** [app/api/enhance-title/route.ts](viewbait/app/api/enhance-title/route.ts)

- **Tier:** `getTierByProductId(subscription.product_id)` (or free if no subscription).
- **Enforcement:** If `!tier.has_enhance` → 403 “Title enhancement is only available for Starter tier and above.”

### 4.4 Custom assets (styles, palettes, faces)

- **POST /api/styles** (create), **POST /api/palettes** (create), **POST /api/faces** (create), **POST /api/faces/upload**, **POST /api/analyze-style**, **POST /api/analyze-palette**  
  All use `getTierForUser(supabase, user.id)` and require `tier.can_create_custom`; otherwise 403 “Custom styles, palettes, and faces require Starter or higher.”

### 4.5 GET /api/tiers

**File:** [app/api/tiers/route.ts](viewbait/app/api/tiers/route.ts)

Returns all active tiers and resolution/edit credit settings. Public; no auth. Used by client to populate tier config and subscription modal.

### 4.6 POST /api/check-subscription

**File:** [app/api/check-subscription/route.ts](viewbait/app/api/check-subscription/route.ts)

Uses Stripe service `checkSubscription(user.id)` which reads `user_subscriptions` and resolves tier name via `getTierByProductId`. Returns `tier`, `product_id`, credits, status, etc. Used by the subscription hook to drive UI and feature flags.

### 4.7 Stripe webhook

**File:** [app/api/webhooks/stripe/route.ts](viewbait/app/api/webhooks/stripe/route.ts)

On subscription events, uses `getTierByProductId(productId)` to get `credits_per_month` and other tier fields when creating/updating `user_subscriptions` (e.g. set credits total, handle tier change or new period).

### 4.8 Cron: cleanup free-tier thumbnails

**File:** [app/api/cron/cleanup-free-tier-thumbnails/route.ts](viewbait/app/api/cron/cleanup-free-tier-thumbnails/route.ts)

Identifies free-tier users by `user_subscriptions.product_id IS NULL` and deletes thumbnails older than 30 days (per free-tier retention).

---

## 5. UI: Where Tier-Dependent Behavior Appears

### 5.1 Generator (studio-generator.tsx)

- **Resolution selector:** `canUseResolution(resolution)` — only allowed resolutions are enabled; others disabled with lock.
- **Aspect ratio selector:** `canUseAspectRatio(ratio)` — same; uses `ASPECT_RATIO_DISPLAY_ORDER`.
- **Variations:** `getMaxVariations()` — options above max are disabled with lock.
- **Generate button:** Disabled when `isGenerating || isButtonDisabled || !thumbnailText.trim()`. `isButtonDisabled` is the tier-based cooldown (see below).
- **Style / palette / face sections:** `canCreateCustomAssets()` — if false, sections are visible but disabled with lock and “Upgrade to unlock.”
- **Subscription modal:** Opened from upgrade prompts; receives `currentTier` and `currentProductId` from `useSubscription()`.

### 5.2 Generate cooldown (tier-based)

- **Constants:** [lib/constants/subscription-tiers.ts](viewbait/lib/constants/subscription-tiers.ts): `GENERATE_COOLDOWN_SECONDS_BY_TIER`, `getGenerateCooldownMs(tier)`.
- **Hook:** [lib/hooks/useThumbnailGeneration.ts](viewbait/lib/hooks/useThumbnailGeneration.ts) accepts `cooldownMs`; after each generate it disables the button for that many ms.
- **Provider:** [components/studio/studio-provider.tsx](viewbait/components/studio/studio-provider.tsx) gets `tier` from `useSubscription()`, computes `cooldownMs = getGenerateCooldownMs(tier)`, passes it to `useThumbnailGeneration({ cooldownMs })`, and syncs `generationState.isButtonDisabled` into `StudioState.isButtonDisabled`.
- **Button:** [components/studio/studio-generator.tsx](viewbait/components/studio/studio-generator.tsx) `StudioGeneratorSubmit` uses `isDisabled = isGenerating || isButtonDisabled || !thumbnailText.trim()`.

So the “generate thumbnail” button is debounced per tier: Free 12s, Starter 8s, Advanced 4s, Pro 2s.

### 5.3 Watermark

- **Provider / modals / cards:** `hasWatermark()` from `useSubscription()`. When true, thumbnail view/download uses watermarked image (e.g. `useWatermarkedImage`, `applyQrWatermark`). Used in studio-provider (view modal, download), thumbnail-edit-modal, delete-confirmation-modal, thumbnail-card.

### 5.4 Credits and plan display

- **Sidebar:** [components/studio/studio-sidebar.tsx](viewbait/components/studio/studio-sidebar.tsx) shows `tierConfig.name`, `creditsRemaining`, `creditsTotal`; click opens subscription modal with `currentTier` and `currentProductId`.
- **Mobile nav:** [components/studio/studio-mobile-floating-nav.tsx](viewbait/components/studio/studio-mobile-floating-nav.tsx) shows credits and opens subscription modal.

### 5.5 “Add” / create custom (styles, palettes, faces)

- **Views:** [components/studio/studio-views.tsx](viewbait/components/studio/studio-views.tsx) (Styles, Palettes, Faces) pass `addDisabled={!canCreateCustomAssets()}` and show lock + “Upgrade to unlock” when disabled. Same pattern in view-controls: add button can be tier-gated.

### 5.6 Subscription modal

- **File:** [components/subscription-modal.tsx](viewbait/components/subscription-modal.tsx)  
  Uses `useSubscriptionTiers()` for tier list and feature text, and `useSubscription()` for `currentTier`, `openCheckout`, etc. Renders tiers from config (credits, resolution, variations, watermark, enhance, custom, storage, priority, early access).

---

## 6. Database Tables Relevant to Tiers

| Table | Role |
|-------|------|
| **subscription_tiers** | One row per tier; defines product/price IDs (test/live), credits, resolutions, aspect ratios (optional), watermark, enhance, storage, priority, early access, max_variations, can_create_custom. |
| **subscription_settings** | Key-value (e.g. `resolution_credits_1k`, `edit_credit_cost`). Used by server and exposed via `/api/tiers`. |
| **user_subscriptions** | Per user: `product_id` (links to tier), `credits_remaining`, `credits_total`, status, Stripe IDs, period. |

---

## 7. Summary: Tier-Dependent Behaviors

| Behavior | Where it’s enforced | Client | Server |
|----------|--------------------|--------|--------|
| Resolution (1K/2K/4K) | Generate | `canUseResolution`; selector disabled | Generate: `tier.allowed_resolutions` |
| Aspect ratio | Generate | `canUseAspectRatio`; selector disabled | Generate: `tier.allowed_aspect_ratios` |
| Max variations | Generate | `getMaxVariations`; selector disabled | Generate: `tier.max_variations` |
| Generate cooldown | Button disable | `getGenerateCooldownMs(tier)` → hook → `isButtonDisabled` | — |
| Custom styles/palettes/faces | Create/analyze | `canCreateCustomAssets`; add disabled + lock | Styles, palettes, faces, analyze: `tier.can_create_custom` |
| AI title enhancement | Enhance title | Can hide Enhance UI via `canUseEnhance()` | Enhance-title: `tier.has_enhance` |
| Watermark | View/download | `hasWatermark`; watermarked URLs | Generate: `has_watermark` on thumbnail row |
| Credits | Generate, edit | `hasCredits`, `getResolutionCost`; UI display | Generate/edit: deduct + insufficient check |
| Edit cost | Edit | `editCreditCost` from tiers API | Edit: `getEditCreditCost()` |
| Free-tier storage cleanup | Cron | — | Cron: `product_id IS NULL` + 30-day delete |

All tier-dependent behavior that affects security or billing is enforced on the server (generate, edit, enhance-title, custom-asset creation, credits). The client uses the same tier and credit data to disable or hide options and to show the correct cooldown and plan info.
