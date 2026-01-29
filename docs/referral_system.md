# Referral System

This document describes how the referral program is implemented in the ViewBait application: data model, APIs, UI, and reward flow.

---

## Overview

- **Referrer**: A user with an active subscription who creates a referral code and shares it.
- **Referred user**: A new user who signs up and optionally enters a referral code; they qualify the referrer (and receive their own reward) when they make their first purchase.
- **Reward**: 10 credits to the referrer per qualified referral; the referred user gets 10 free credits when they sign up and make a purchase (as described in the UI).

Referral code creation is **opt-in**: only users with an active subscription can create a code, and they do so via the Referral modal (not automatically on first purchase).

---

## Data Model

### Tables (Supabase)

**`referral_codes`**

| Column         | Type      | Description                          |
|----------------|-----------|--------------------------------------|
| `id`           | uuid      | Primary key                          |
| `user_id`      | uuid      | Owner of the code                    |
| `code`         | text      | Unique alphanumeric code (8–12 chars)|
| `created_at`   | timestamp |                                      |
| `updated_at`   | timestamp |                                      |
| `is_active`    | boolean   |                                      |
| `deactivated_at` | timestamp \| null |                       |
| `metadata`     | jsonb     |                                      |

**`referrals`**

| Column                   | Type      | Description                                  |
|--------------------------|-----------|----------------------------------------------|
| `id`                     | uuid      | Primary key                                  |
| `referrer_user_id`       | uuid      | User who owns the referral code              |
| `referred_user_id`       | uuid      | User who applied the code                    |
| `referral_code`           | string    | Code that was applied                        |
| `created_at`             | timestamp |                                              |
| `status`                 | enum      | `pending` \| `qualified` \| `rewarded` \| `invalid` |
| `qualified_at`           | timestamp \| null | When referred user first purchased   |
| `rewarded_at`            | timestamp \| null | When credits were granted            |
| `reward_referrer_credits`| number    | Credits granted to referrer                  |
| `reward_referred_credits`| number    | Credits granted to referred user             |
| `reward_idempotency_key` | string \| null | For idempotent credit grants        |
| `metadata`               | jsonb     |                                              |

**Status flow**

1. **pending** – Referred user has signed up with the code but has not yet made a purchase.
2. **qualified** – Referred user made a purchase; referral is marked qualified before granting credits.
3. **rewarded** – Credits have been granted to both referrer and referred user (via RPC).
4. **invalid** – Referral was invalidated (e.g. self-referral, already applied, etc.).

---

## Database RPCs (Supabase)

The app assumes these RPCs exist in the database (they are not defined in the repo migrations):

| RPC                        | Purpose |
|----------------------------|--------|
| `rpc_apply_referral_code`  | Applies a referral code for the current user. Validates code, prevents self-referral and duplicate application, creates a row in `referrals` with status `pending`. Called with `code_input` (normalized 8–12 alphanumeric). |
| `rpc_grant_referral_credits`| Idempotent grant of referral credits. Called after the referred user’s first purchase with `referral_id_input`, `referrer_user_id_input`, `referred_user_id_input`, `credits_amount` (e.g. 10). Updates referral to `rewarded` and grants credits to both users. |
| `generate_referral_code`   | Returns a new unique referral code string (e.g. 8–12 alphanumeric). Used when creating a new code in `referral_codes`. |

---

## API Routes

All under `/api/referrals/`. Auth is required unless noted.

| Method | Route                     | Description |
|--------|---------------------------|-------------|
| GET    | `/api/referrals/code`     | Returns the authenticated user’s referral code (object or null). 404 if no code. |
| GET    | `/api/referrals/stats`    | Returns `{ stats: { pending, rewarded, total } }` for the current user as referrer. |
| POST   | `/api/referrals/apply`    | Applies a referral code. Body: `{ code: string }`. Validates 8–12 alphanumeric; calls `rpc_apply_referral_code`. |
| POST   | `/api/referrals/create`   | Creates a referral code for the current user. Requires active subscription; calls referral service `createReferralCode(userId)`. |

- **Apply** is used on signup (auth page) and must be called **after** the user is created (user must be authenticated).
- **Create** is used from the Referral modal when the user clicks “Create Referral Code”.

---

## Services

### `@/lib/services/referrals`

- **Client-oriented (call API):**  
  `applyReferralCode(code)`, `getReferralCode()`, `getReferralStats()`  
  Use these from the client; they hit the API routes above.

- **Server-only (Supabase service client):**  
  `checkUserHasPurchased(userId)`, `getReferralCodeByCode(code)`, `createReferralCode(userId)`  
  Used by API routes or server logic (e.g. create route, Stripe flow).  
  `createReferralCode` uses RPC `generate_referral_code` and inserts into `referral_codes`, with a single retry on unique violation.

### `@/lib/services/stripe`

- **`recordPurchaseAndProcessReferrals(userId, paymentIntentId, amountCents, currency)`**  
  - Inserts into `user_purchases` (idempotent on unique `stripe_payment_intent_id`).  
  - Finds a **pending** referral where `referred_user_id = userId`.  
  - If found: updates that referral to `qualified`, then calls `rpc_grant_referral_credits` with `credits_amount: 10`.  
  - Invoked from the Stripe webhook after successful checkout (see below).

---

## Stripe Webhook Integration

In **`/api/webhooks/stripe`**:

- On `checkout.session.completed` with `session.mode === 'subscription'`:
  - After `processCheckoutSession(session.id)` succeeds, the handler reads `session.metadata?.user_id` and resolves a payment intent (or subscription’s latest invoice payment intent).
  - It then calls **`recordPurchaseAndProcessReferrals(userId, paymentIntentId, amountCents, currency)`** so that:
    - The purchase is recorded in `user_purchases`.
    - Any pending referral for that user is qualified and rewarded via `rpc_grant_referral_credits`.

So referral rewards are triggered by the **first successful subscription checkout** for the referred user.

---

## Frontend

### Auth page (`/auth`)

- Sign-up form includes an optional **Referral Code** field.
- On successful sign-up, if the user entered a code, the client calls `POST /api/referrals/apply` with the normalized code (trim + uppercase).  
- Sign-up is **not** blocked if apply fails; errors are logged to console.

### Referral modal (`ReferralModal`)

- **Location:** Opened from:
  - **Studio sidebar** (desktop): Gift icon in the user section (collapsed and expanded).
  - **Studio mobile floating nav**: Gift icon in the floating action menu.
- **Behavior:**
  - If the user already has a referral code: shows the code, copy button, and stats (e.g. “X friends joined · Y pending”).
  - If the user has no code but has an active subscription: shows “Create Referral Code”; on confirm, calls `createReferralCode()` (which hits `POST /api/referrals/create`).
  - If the user has no code and no subscription: shows “Make a purchase to unlock your own referral code” and a “View plans” button that closes the modal (user can open subscription/credits from the sidebar).
- **Copy:** Copies the referral code to the clipboard and shows a toast.
- **Data:** Uses `useReferrals()` (code + stats) and `useSubscription()` (for `isSubscribed`).

### Hook: `useReferrals`

- **Queries (React Query):**  
  - `['referral-code', user?.id]` → GET `/api/referrals/code` (stale 5 min).  
  - `['referral-stats', user?.id]` → GET `/api/referrals/stats` (stale 2 min).
- **Mutations:**  
  - Apply referral code (invalidates stats).  
  - Create referral code (invalidates code query).
- Exposes: `referralCode`, `stats`, `isLoading`, `isCreating`, `applyReferralCode`, `createReferralCode`, `refresh`, `error`.

---

## End-to-end Flow

1. **Referrer**  
   - Has an active subscription → opens Referral modal → creates a code (or already has one).  
   - Shares the code (e.g. copy from modal).

2. **Referred user**  
   - Signs up on `/auth` and optionally enters the referral code.  
   - After sign-up, client calls `POST /api/referrals/apply` with that code.  
   - Backend `rpc_apply_referral_code` creates a `referrals` row with status `pending`.

3. **Qualification and reward**  
   - When the referred user completes their first subscription checkout, the Stripe webhook runs.  
   - `recordPurchaseAndProcessReferrals` runs: records the purchase, finds the pending referral for that user, sets it to `qualified`, then calls `rpc_grant_referral_credits` (e.g. 10 credits to referrer and referred user).  
   - The RPC is expected to set the referral to `rewarded` and perform the credit grants idempotently.

4. **Referrer stats**  
   - In the Referral modal, “X friends joined · Y pending” comes from `GET /api/referrals/stats`, which counts referrals by status (`pending` vs `rewarded`).

---

## File Reference

| Layer        | Path |
|-------------|------|
| Types       | `lib/types/database.ts` (ReferralCode, Referral, ReferralInsert, ReferralUpdate, ReferralCodeInsert, ReferralCodeUpdate) |
| Service     | `lib/services/referrals.ts` |
| Stripe flow | `lib/services/stripe.ts` (`recordPurchaseAndProcessReferrals`) |
| Hook        | `lib/hooks/useReferrals.ts` |
| UI          | `components/referral-modal.tsx` |
| Entry points| `components/studio/studio-sidebar.tsx`, `components/studio/studio-mobile-floating-nav.tsx` |
| Auth apply  | `app/auth/page.tsx` (sign-up → apply) |
| API         | `app/api/referrals/code/route.ts`, `app/api/referrals/stats/route.ts`, `app/api/referrals/apply/route.ts`, `app/api/referrals/create/route.ts` |
| Webhook     | `app/api/webhooks/stripe/route.ts` (checkout.session.completed) |
| Schema      | `supabase/tables/referral_codes.json`, `supabase/tables/referrals.json` |

---

## Validation and Edge Cases

- **Apply:** Code must be 8–12 alphanumeric (regex `^[A-Z0-9]{8,12}$`); body is normalized with trim + uppercase before validation and RPC.
- **Create:** Requires active subscription (`checkSubscription`); duplicate code creation is avoided (existing code returns 200 with “Referral code already exists”).
- **Idempotency:** Purchase insert and referral credit grant are designed to be idempotent (unique constraint on purchase, RPC handling already-rewarded referrals).
- **Self-referral / already applied:** Handled inside `rpc_apply_referral_code`; API returns 400 with message from RPC.

---

## Possible Improvements

- **Auth apply:** The apply call on sign-up is best-effort only; consider showing a toast on failure or retrying once the session is ready.
- **Referred user credits:** The UI says friends get “10 free credits when they sign up and make a purchase”; the actual grant to the referred user is implemented inside `rpc_grant_referral_credits` (not visible in app code). Ensure the RPC grants both referrer and referred credits if that’s the product intent.
- **Referral link:** Currently only a code is shared; a shareable link (e.g. `/auth?ref=CODE`) could pre-fill the referral field and improve conversion.
- **Migrations:** Document or add SQL migrations for `rpc_apply_referral_code`, `rpc_grant_referral_credits`, and `generate_referral_code` so the schema is fully reproducible.
