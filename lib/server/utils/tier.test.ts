import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TierConfig } from "@/lib/constants/subscription-tiers";

import { getTierForUser, getTierNameForUser } from "@/lib/server/utils/tier";

const tierMocks = vi.hoisted(() => ({
  getTierByProductId: vi.fn(),
  getTierNameByProductId: vi.fn(),
}));

vi.mock("@/lib/server/data/subscription-tiers", () => ({
  getTierByProductId: tierMocks.getTierByProductId,
  getTierNameByProductId: tierMocks.getTierNameByProductId,
}));

const freeTier: TierConfig = {
  name: "Free",
  product_id: null,
  price_id: null,
  credits_per_month: 10,
  allowed_resolutions: ["1K"],
  allowed_aspect_ratios: ["16:9"],
  has_watermark: true,
  has_enhance: false,
  persistent_storage: false,
  storage_retention_days: 30,
  priority_generation: false,
  early_access: false,
  price: 0,
  max_variations: 1,
  can_create_custom: false,
};

const proTier: TierConfig = {
  ...freeTier,
  name: "Pro",
  product_id: "prod_pro",
  credits_per_month: 500,
  allowed_resolutions: ["1K", "2K", "4K"],
  has_watermark: false,
  has_enhance: true,
  persistent_storage: true,
  storage_retention_days: null,
  priority_generation: true,
  early_access: true,
  price: 79,
  max_variations: 4,
  can_create_custom: true,
};

function createSubscriptionSupabaseMock(subscription: {
  product_id: string | null;
  status: string | null;
}): SupabaseClient {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: subscription, error: null }),
  };

  return {
    from: vi.fn().mockReturnValue(query),
  } as unknown as SupabaseClient;
}

describe("tier utilities", () => {
  beforeEach(() => {
    tierMocks.getTierByProductId.mockImplementation(
      async (productId: string | null) =>
        productId === "prod_pro" ? proTier : freeTier
    );
    tierMocks.getTierNameByProductId.mockImplementation(
      async (productId: string | null) => (productId === "prod_pro" ? "pro" : "free")
    );
  });

  it("forces free tier access for paused-free subscriptions with a paid product", async () => {
    const supabase = createSubscriptionSupabaseMock({
      product_id: "prod_pro",
      status: "paused_free",
    });

    const tier = await getTierForUser(supabase, "user-1");

    expect(tier.name).toBe("Free");
    expect(tier.product_id).toBeNull();
  });

  it("keeps paid tier access while pause is pending current period end", async () => {
    const supabase = createSubscriptionSupabaseMock({
      product_id: "prod_pro",
      status: "paused_until_period_end",
    });

    const tier = await getTierForUser(supabase, "user-1");

    expect(tier.name).toBe("Pro");
  });

  it("forces free tier names for past-due locked subscriptions", async () => {
    const supabase = createSubscriptionSupabaseMock({
      product_id: "prod_pro",
      status: "past_due_locked",
    });

    await expect(getTierNameForUser(supabase, "user-1")).resolves.toBe("free");
  });
});
