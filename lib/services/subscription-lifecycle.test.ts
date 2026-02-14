import { describe, expect, it } from "vitest";

import {
  deriveAccessTierFromStatus,
  deriveAppStatusFromStripe,
  shouldBlockPaidFeatures,
  type AppSubscriptionStatus,
  type StripeSubscriptionStatus,
} from "@/lib/services/subscription-lifecycle";

describe("subscription-lifecycle", () => {
  describe("deriveAppStatusFromStripe", () => {
    it("should keep paused-until-period-end before rollover", () => {
      const result = deriveAppStatusFromStripe({
        stripeStatus: "active",
        hasPauseCollection: true,
        isNewBillingPeriod: false,
      });

      expect(result).toBe("paused_until_period_end");
    });

    it("should switch to paused-free at rollover", () => {
      const result = deriveAppStatusFromStripe({
        stripeStatus: "active",
        hasPauseCollection: true,
        isNewBillingPeriod: true,
      });

      expect(result).toBe("paused_free");
    });

    it("should map failed resume status to past-due-locked", () => {
      const statuses: StripeSubscriptionStatus[] = ["past_due", "unpaid", "incomplete"];

      for (const status of statuses) {
        const result = deriveAppStatusFromStripe({
          stripeStatus: status,
          hasPauseCollection: false,
          isNewBillingPeriod: false,
        });

        expect(result).toBe("past_due_locked");
      }
    });
  });

  describe("deriveAccessTierFromStatus", () => {
    it("should force free access for paused-free", () => {
      const result = deriveAccessTierFromStatus("pro", "paused_free");
      expect(result).toBe("free");
    });

    it("should keep paid access while paused until period end", () => {
      const result = deriveAccessTierFromStatus("pro", "paused_until_period_end");
      expect(result).toBe("pro");
    });
  });

  describe("shouldBlockPaidFeatures", () => {
    it("should only block paid features for past_due_locked", () => {
      const blockedStatuses: AppSubscriptionStatus[] = ["past_due_locked"];
      const unblockedStatuses: AppSubscriptionStatus[] = [
        "active",
        "paused_until_period_end",
        "paused_free",
        "cancelled",
        "free",
      ];

      for (const status of blockedStatuses) {
        expect(shouldBlockPaidFeatures(status)).toBe(true);
      }

      for (const status of unblockedStatuses) {
        expect(shouldBlockPaidFeatures(status)).toBe(false);
      }
    });
  });
});
