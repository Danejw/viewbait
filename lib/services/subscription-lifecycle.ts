import type { TierName } from "@/lib/constants/subscription-tiers";

export type StripeSubscriptionStatus =
  | "trialing"
  | "active"
  | "incomplete"
  | "incomplete_expired"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export type AppSubscriptionStatus =
  | "free"
  | "active"
  | "paused_until_period_end"
  | "paused_free"
  | "past_due_locked"
  | "cancelled";

interface DeriveAppStatusInput {
  stripeStatus: StripeSubscriptionStatus;
  hasPauseCollection: boolean;
  isNewBillingPeriod: boolean;
}

/**
 * Maps Stripe status + pause collection state into app-level lifecycle status.
 * This keeps access and credits behavior deterministic inside the app.
 */
export function deriveAppStatusFromStripe(input: DeriveAppStatusInput): AppSubscriptionStatus {
  const { stripeStatus, hasPauseCollection, isNewBillingPeriod } = input;

  if (hasPauseCollection) {
    return isNewBillingPeriod ? "paused_free" : "paused_until_period_end";
  }

  if (stripeStatus === "past_due" || stripeStatus === "unpaid" || stripeStatus === "incomplete") {
    return "past_due_locked";
  }

  if (stripeStatus === "canceled" || stripeStatus === "incomplete_expired") {
    return "cancelled";
  }

  return "active";
}

/**
 * Returns the access tier used for feature gates.
 * Some statuses force free-tier access regardless of paid product_id.
 */
export function deriveAccessTierFromStatus(
  resolvedTierFromProduct: TierName,
  status: AppSubscriptionStatus
): TierName {
  if (status === "paused_free" || status === "past_due_locked" || status === "cancelled" || status === "free") {
    return "free";
  }

  return resolvedTierFromProduct;
}

export function shouldBlockPaidFeatures(status: AppSubscriptionStatus): boolean {
  return status === "past_due_locked";
}

