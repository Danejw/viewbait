# Referral Code System — Implementation Guide

This document describes how the referral code system is implemented in this application so you can replicate it in another client-side application in a similar way.

---

## 1. Overview

The referral system has three main flows:

1. **Apply a referral code** — New users (or existing users who haven’t applied one) enter a code; a `referrals` row is created with status `pending`.
2. **Create a referral code** — Subscribed users can create their own code (opt-in via UI). Codes are stored in `referral_codes`.
3. **Reward on purchase** — When a referred user makes a purchase, the referral is qualified and both referrer and referred user receive credits via `rpc_grant_referral_credits`.

**Design choices:**

- **One code per user** — Each user can have at most one referral code (unique on `user_id` in `referral_codes`).
- **One referral per referred user** — Each user can apply at most one referral code (unique on `referred_user_id` in `referrals`).
- **Code creation is opt-in** — Users get a code only after subscribing and clicking “Create Referral Code” in the UI (not automatically on first purchase).
- **Rewards are credits** — Default 10 credits each for referrer and referred user, granted when the referred user’s first purchase is recorded (Stripe webhook).

---

## 2. Data Model

### 2.1 Tables (Supabase/Postgres)

**`referral_codes`**

| Column         | Type        | Notes |
|----------------|-------------|--------|
| `id`           | UUID        | PK, default `gen_random_uuid()` |
| `user_id`      | UUID        | NOT NULL, UNIQUE, FK → `auth.users(id)` ON DELETE CASCADE |
| `code`         | TEXT        | NOT NULL, UNIQUE — 8–12 alphanumeric (e.g. from `generate_referral_code()`) |
| `created_at`   | TIMESTAMPTZ | DEFAULT now() |
| `updated_at`   | TIMESTAMPTZ | DEFAULT now() |
| `is_active`    | BOOLEAN     | DEFAULT true |
| `deactivated_at` | TIMESTAMPTZ | nullable |
| `metadata`     | JSONB       | DEFAULT '{}' |

**`referrals`**

| Column                   | Type        | Notes |
|--------------------------|-------------|--------|
| `id`                     | UUID        | PK |
| `referrer_user_id`       | UUID        | FK → auth.users (owner of the code) |
| `referred_user_id`       | UUID        | UNIQUE, FK → auth.users (user who applied the code) |
| `referral_code`          | TEXT        | Snapshot of the code string used |
| `created_at`             | TIMESTAMPTZ | |
| `status`                 | TEXT        | `pending` \| `qualified` \| `rewarded` \| `invalid` |
| `qualified_at`           | TIMESTAMPTZ | Set when referred user makes a purchase |
| `rewarded_at`            | TIMESTAMPTZ | Set when credits are granted |
| `reward_referrer_credits`| INTEGER     | Default 10 |
| `reward_referred_credits`| INTEGER     | Default 10 |
| `reward_idempotency_key` | TEXT        | UNIQUE, used to avoid double-granting |
| `metadata`               | JSONB       | |

**`user_purchases`** (used for qualification and idempotency)

| Column                    | Type   | Notes |
|---------------------------|--------|--------|
| `id`                      | UUID   | PK |
| `user_id`                 | UUID   | FK → auth.users |
| `stripe_payment_intent_id`| TEXT   | UNIQUE |
| `amount_cents`            | INTEGER| |
| `currency`                | TEXT   | Default 'usd' |
| `created_at`              | TIMESTAMPTZ | |

**Credit grants** — Stored in `credit_transactions` with `type = 'referral_reward'` and `metadata->>'idempotency_key'` to prevent duplicates. Balances live in `user_subscriptions.credits_remaining`.

### 2.2 TypeScript types (for client parity)

```ts
// ReferralCode — row from referral_codes
interface ReferralCode {
  id: string
  user_id: string
  code: string
  created_at: string
  updated_at: string
  is_active: boolean
  deactivated_at: string | null
  metadata: Json
}

// Referral — row from referrals
interface Referral {
  id: string
  referrer_user_id: string
  referred_user_id: string
  referral_code: string
  created_at: string
  status: 'pending' | 'qualified' | 'rewarded' | 'invalid'
  qualified_at: string | null
  rewarded_at: string | null
  reward_referrer_credits: number
  reward_referred_credits: number
  reward_idempotency_key: string | null
  metadata: Json
}
```

---

## 3. Database Functions (RPCs)

All live in Postgres; call them from API routes or server-only code (e.g. Stripe webhook), not from the client.

### 3.1 `generate_referral_code()` → TEXT

- **Purpose:** Generate a unique 8-character code (extends to 9+ on collision).
- **Alphabet:** Unambiguous (e.g. `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` — no 0/O, 1/I).
- **Usage:** Called server-side when creating a new row in `referral_codes`. Check for existing code in `referral_codes`; retry with new code if collision.
- **Security:** No SECURITY DEFINER; safe utility.

### 3.2 `rpc_apply_referral_code(code_input TEXT)` → JSON

- **Purpose:** Apply a referral code for the **current authenticated user**.
- **Returns:** `{ status: 'success' | 'error', message: string }`.
- **Logic:**
  - Require `auth.uid()`.
  - If user already has a row in `referrals` as `referred_user_id` → error “You have already applied a referral code”.
  - Look up `referral_codes` by `code = code_input` and `is_active = true`; if not found → “Invalid or inactive referral code”.
  - If `referral_codes.user_id = auth.uid()` → “You cannot refer yourself”.
  - Insert into `referrals`: `referrer_user_id`, `referred_user_id = auth.uid()`, `referral_code = code_input`, `status = 'pending'`.
- **Security:** SECURITY DEFINER, `SET search_path = public`.
- **Client usage:** Only via `POST /api/referrals/apply` (authenticated).

### 3.3 `rpc_grant_referral_credits(referral_id_input, referrer_user_id_input, referred_user_id_input, credits_amount DEFAULT 10)` → JSON

- **Purpose:** Grant credits to both referrer and referred user for a given referral; idempotent.
- **When:** Called server-side after recording a purchase for the referred user (e.g. in Stripe webhook handler).
- **Logic:**
  - Idempotency keys: e.g. `referral_reward:referrer:<referred_user_id>`, `referral_reward:referred:<referred_user_id>`.
  - If referral already `status = 'rewarded'` with `reward_idempotency_key` set → return success (already granted).
  - Insert `credit_transactions` with `metadata.idempotency_key`; unique index on `metadata->>'idempotency_key'` prevents double insert.
  - Update `user_subscriptions.credits_remaining` for both users (or create subscription row if missing).
  - Set referral `status = 'rewarded'`, `rewarded_at = now()`, `reward_idempotency_key`.
- **Security:** SECURITY DEFINER, `SET search_path = public`. Must only be called from server (e.g. webhook or backend job).

---

## 4. API Routes

All routes require an authenticated user unless noted. Auth is done via Supabase session (e.g. `requireAuth(supabase)`).

| Method | Path                     | Purpose |
|--------|--------------------------|--------|
| POST   | `/api/referrals/apply`   | Apply a referral code for the current user |
| GET    | `/api/referrals/code`   | Get the current user’s referral code (object or null) |
| GET    | `/api/referrals/stats`  | Get referral stats (pending, rewarded, total) for the current user as referrer |
| POST   | `/api/referrals/create` | Create a referral code for the current user (requires active subscription) |

### 4.1 POST `/api/referrals/apply`

- **Body:** `{ code: string }`.
- **Validation:** Code required; format `^[A-Z0-9]{8,12}$` (normalize to uppercase before calling RPC).
- **Implementation:** Call `supabase.rpc('rpc_apply_referral_code', { code_input: normalizedCode })`. Map JSON result to 200 + `{ success, message }` or 400 + `{ error, code: 'APPLY_ERROR' }`.

### 4.2 GET `/api/referrals/code`

- **Returns:** `{ code: ReferralCode | null, hasCode: boolean }`.
- **Implementation:** Query `referral_codes` where `user_id = auth.uid()` and `is_active = true`, `.single()`. Treat PGRST116 (no row) as “no code” (200 with `code: null`).

### 4.3 GET `/api/referrals/stats`

- **Returns:** `{ stats: { pending: number, rewarded: number, total: number } }`.
- **Implementation:** Query `referrals` where `referrer_user_id = auth.uid()`, select `status`. Compute counts for `status === 'pending'` and `status === 'rewarded'`, and total.

### 4.4 POST `/api/referrals/create`

- **Returns:** `{ code: string, message?: string }` or 403/500 with error.
- **Implementation:**
  1. If user already has an active referral code, return it and “Referral code already exists”.
  2. Check subscription (e.g. Stripe/subscription service). If not subscribed → 403 “You must have an active subscription to create a referral code.”
  3. Call server-only `createReferralCode(userId)`: generate code via `generate_referral_code()`, insert into `referral_codes` (service role). On unique violation (code collision), retry once with a new code.

---

## 5. Service Layer

**File:** `lib/services/referrals.ts`

- **Client-callable (via API):**
  - `applyReferralCode(code)` → calls `POST /api/referrals/apply`, returns `{ success, message, error }`.
  - `getReferralCode()` → calls `GET /api/referrals/code`, returns `{ code: ReferralCode | null, error }`.
  - `getReferralStats()` → calls `GET /api/referrals/stats`, returns `{ stats: { pending, rewarded, total } | null, error }`.
- **Server-only (no direct client call):**
  - `checkUserHasPurchased(userId)` — query `user_purchases` (e.g. for conditional logic).
  - `getReferralCodeByCode(code)` — lookup active referral code by string (service client).
  - `createReferralCode(userId)` — ensure one code per user; call `generate_referral_code()` RPC; insert into `referral_codes` with service client; retry on code collision.

Use a shared API client (e.g. `apiGet`, `apiPost`) for client-side calls so errors and status codes are handled in one place.

---

## 6. React Hook: `useReferrals`

**File:** `lib/hooks/useReferrals.ts`

- **Auth:** Depends on `useAuth()`; all queries/mutations run only when `isAuthenticated && user` (e.g. `enabled` in React Query).
- **Queries (React Query):**
  - **Referral code:** `queryKey: ['referral-code', user?.id]`, fetch `GET /api/referrals/code`, expose `referralCode` as the code string (e.g. `data.code?.code ?? null`).
  - **Stats:** `queryKey: ['referral-stats', user?.id]`, fetch `GET /api/referrals/stats`, expose `stats: { pending, rewarded, total }`.
- **Mutation:** Apply code → `POST /api/referrals/apply` with body `{ code }`. On success, invalidate `['referral-stats', user?.id]`.
- **Returned:** `referralCode`, `stats`, `isLoading`, `error`, `applyReferralCode(code)`, `refresh()` (refetch code + stats).

Caching: e.g. 5 min stale for code, 2 min for stats; adjust as needed for your app.

---

## 7. UI Integration

### 7.1 Applying a referral code (signup)

- **Where:** Signup form (e.g. `AuthModal`).
- **Behavior:**
  - Optional field: “Referral Code (Optional)”, max length 12, normalize to uppercase on change.
  - After successful signup (e.g. `signUp(email, password, { full_name })`), if `referralCode.trim()` and not already applied:
    - `POST /api/referrals/apply` with `{ code: referralCode.trim() }`.
    - On success: set “Referral code applied successfully” (or similar); do not block signup.
    - On failure: log and show generic “Account created” message so signup still succeeds.
  - Disable the referral input after successful apply (e.g. `referralCodeApplied`).

This keeps “apply” server-driven and consistent with your RPC rules (one referral per user, no self-referral).

### 7.2 Showing and creating a referral code (sidebar / account)

- **Where:** Sidebar or account section (e.g. “Referral Code” card with Gift icon).
- **Data:** `useReferrals()` → `referralCode`, `stats`, `isLoading`, `refresh`.
- **If user has a code:** Show the code string and a “Copy” button (e.g. `navigator.clipboard.writeText(referralCode)`).
- **If user is subscribed but has no code:** Show “Create Referral Code” button that calls `POST /api/referrals/create`, then `refresh()` to show the new code. On error, show message and optionally retry.
- **If user is not subscribed:** Show “Unlock by making a purchase” (or similar).
- **Stats:** Optionally show “X friends joined” (e.g. `stats.rewarded`) under the code.

---

## 8. Purchase Flow and Referral Rewards

When a user completes a purchase (e.g. Stripe PaymentIntent succeeded):

1. **Webhook handler** (e.g. `app/api/webhooks/stripe/route.ts`) identifies the user and payment (e.g. `userId`, `paymentIntentId`, `amountCents`, `currency`).
2. Call **`recordPurchaseAndProcessReferrals(userId, paymentIntentId, amountCents, currency)`** (lives in `lib/services/stripe.ts` or equivalent server-only module):
   - **Record purchase:** Insert into `user_purchases` (idempotent on `stripe_payment_intent_id`).
   - **Find pending referral:** `referrals` where `referred_user_id = userId` and `status = 'pending'`, `.single()`.
   - If found:
     - Update referral: `status = 'qualified'`, `qualified_at = now()`.
     - Call `rpc_grant_referral_credits(referral.id, referrer_user_id, referred_user_id, 10)` (or your configured amount).
   - Return success; do not fail the webhook if referral grant fails (log and optionally retry later).

Referral code **creation** is not tied to purchase; it’s opt-in via “Create Referral Code” in the UI and gated by subscription.

---

## 9. Business Rules Summary

| Rule | Implementation |
|------|----------------|
| One referral code per user | Unique on `referral_codes.user_id`; `createReferralCode` checks existing before insert. |
| One applied referral per user | Unique on `referrals.referred_user_id`; `rpc_apply_referral_code` checks and insert. |
| No self-referral | RPC compares `referral_codes.user_id` to `auth.uid()`. |
| Code format | 8–12 alphanumeric (e.g. A–Z, 0–9); normalized to uppercase in API. |
| Who can create a code | Only users with an active subscription; enforced in `POST /api/referrals/create`. |
| When rewards are granted | When referred user’s first purchase is recorded in webhook; referral status: pending → qualified → rewarded. |
| Idempotency | `rpc_grant_referral_credits` uses idempotency keys in `credit_transactions.metadata` and referral `reward_idempotency_key`. |

---

## 10. Replication Checklist for Another Client App

Use this to mirror behavior in a new client-side application:

- [ ] **Database:** Create tables `referral_codes`, `referrals`, `user_purchases` (or equivalent); RLS so users see only their own code/referrals; service role for inserts/updates from backend.
- [ ] **RPCs:** Implement `generate_referral_code()`, `rpc_apply_referral_code(code_input)`, `rpc_grant_referral_credits(...)` with same semantics and idempotency.
- [ ] **Credit system:** Ensure `credit_transactions` and `user_subscriptions` (or equivalent) support `referral_reward` and idempotency key in metadata.
- [ ] **API routes:** `POST /api/referrals/apply`, `GET /api/referrals/code`, `GET /api/referrals/stats`, `POST /api/referrals/create` with same request/response shapes and auth.
- [ ] **Service layer:** Thin client that calls these APIs; server-only helpers for `createReferralCode`, purchase recording, and calling `rpc_grant_referral_credits`.
- [ ] **Hook:** `useReferrals()` with React Query (or equivalent) for code, stats, apply mutation, and refresh.
- [ ] **Signup UI:** Optional referral code field; apply after signup via API; do not block signup on referral failure.
- [ ] **Sidebar/account UI:** Show code + copy; “Create Referral Code” when subscribed and no code; show “X friends joined” from stats.
- [ ] **Webhook:** After recording purchase, look up pending referral for buyer, qualify it, then call `rpc_grant_referral_credits`.

Keeping request/response shapes and RPC contracts aligned with this doc will make the two apps behave the same from a user and backend perspective.
