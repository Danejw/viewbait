# Subscription Plan Benefits Matrix

Comparison of what each plan includes (✓) and excludes (✗) across Free, Starter, Advanced, and Pro.

| Feature | Free | Starter | Advanced | Pro |
| :------- | :--- | :------ | :------- | :-- |
| **Monthly cost** | Free | $19.99 /month | $49.99 /month | $99.99 /month |
| **Credits per month** | 10 | 100 | 300 | 700 |
| **1K Resolution** | ✓ | ✓ | ✓ | ✓ |
| **2K Resolution** | ✗ | ✓ | ✓ | ✓ |
| **4K Resolution** | ✗ | ✗ | ✓ | ✓ |
| **Variations per generation** | 1 | Up to 2 | Up to 3 | Up to 4 |
| **No Watermark** | ✗ | ✓ | ✓ | ✓ |
| **AI Title Enhancement** | ✗ | ✓ | ✓ | ✓ |
| **Custom styles, palettes & faces** | ✗ | ✓ | ✓ | ✓ |
| **Permanent Storage** | ✗ (30-day storage) | ✓ | ✓ | ✓ |
| **Priority Generation** | ✗ | ✗ | ✓ | ✓ |
| **Early Access** | ✗ | ✗ | ✗ | ✓ |

---

## Summary

- **Free:** 10 credits/mo, 1K only, 1 variation, watermark, 30-day storage.
- **Starter:** 100 credits/mo, up to 2K, up to 2 variations, no watermark, permanent storage, AI title enhancement, custom styles/palettes/faces.
- **Advanced:** 300 credits/mo, up to 4K, up to 3 variations, plus priority generation.
- **Pro:** 700 credits/mo, up to 4 variations, plus early access.

---

## Tier enforcement

Enforcement is **server-side** (authoritative) and **UI** (UX). Tier config comes from the database via `subscription_tiers`; the client uses `useSubscription()` and `useSubscriptionTiers()`.

| Benefit | Server | UI |
|--------|--------|-----|
| **Credits** | Generate and edit APIs deduct credits; insufficient credits return 403. | Balance shown in sidebar; generate disabled when insufficient. |
| **1K/2K/4K** | `POST /api/generate` checks `tier.allowed_resolutions`. | Generator resolution options filtered by `canUseResolution()`. |
| **Variations (1–4)** | `POST /api/generate` caps `variations` by `tier.max_variations`; returns 403 if exceeded. | Variation selector capped to `getMaxVariations()`. |
| **No watermark** | Thumbnail record `has_watermark` set from tier when creating. | Informational only. |
| **AI Title Enhancement** | `POST /api/enhance-title` returns 403 if `!tier.has_enhance`. | (No dedicated enhance button in current UI.) |
| **Custom styles, palettes, faces** | `POST /api/generate` returns 403 if `!tier.can_create_custom` and request includes style/palette/face. `POST /api/styles`, `POST /api/palettes`, `POST /api/faces`, `POST /api/analyze-style`, `POST /api/analyze-palette`, `POST /api/faces/upload` return 403 if `!tier.can_create_custom`. | Generator hides style/palette/face sections when `!canCreateCustomAssets()`. Create flows in My Styles / My Palettes / My Faces open subscription modal when Free. |
| **Permanent storage** | Cron `cleanup-free-tier-thumbnails` deletes only free-tier thumbnails (product_id IS NULL) older than 30 days. | Informational only. |
| **Priority generation** | Not implemented (no queue). Document as future work. | N/A |
| **Early access** | Not implemented (no feature flags). Document as future work. | N/A |

**Shared server helper:** `getTierForUser(supabase, userId)` in `lib/server/utils/tier.ts` loads the user’s subscription and returns `TierConfig`; used by gated routes for consistent tier resolution.
