# Stripe Subscription Management Notes

This document captures the Stripe capabilities and app decisions used by ViewBait subscription management.

## Verified Stripe capabilities

- Stripe supports pausing **payment collection** on existing subscriptions via `pause_collection`.
- Stripe supports resuming collection by unsetting `pause_collection`.
- Stripe supports cancellation at period end via `cancel_at_period_end`.
- Stripe customer portal supports deep-link flows for `subscription_update` and `subscription_cancel`.
- Stripe supports idempotent `POST` requests via request idempotency keys.
- Stripe webhook processing should dedupe on `event.id` and treat events as potentially out of order.

## ViewBait lifecycle semantics

- **Pause** keeps remaining paid credits until current paid period ends.
- At the next period rollover while paused, account transitions to **paused_free** and uses free-tier credits.
- **Resume** restarts paid billing from resume date (`billing_cycle_anchor=now`).
- If resume payment fails, status becomes **past_due_locked** and paid features remain blocked.
- Accounts are limited to one active managed subscription at a time. Plan changes must update the existing subscription.

## Operational best practices applied

- Use Stripe webhooks as authoritative billing lifecycle signals.
- Keep app state in `user_subscriptions` synchronized from Stripe subscription events.
- Use customer portal deep links for cancel/change-plan management.
- Prevent duplicate subscription creation by redirecting already-subscribed users to update flow.
