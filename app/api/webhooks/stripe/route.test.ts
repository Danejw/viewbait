import { beforeEach, describe, expect, it, vi } from "vitest";

const webhookMocks = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  createServiceClient: vi.fn(),
  processCheckoutSession: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(function StripeMock() {
    return {
      webhooks: {
        constructEvent: webhookMocks.constructEvent,
      },
      subscriptions: {
        retrieve: vi.fn(),
      },
      prices: {
        retrieve: vi.fn(),
      },
    };
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: webhookMocks.createServiceClient,
}));

vi.mock("@/lib/services/stripe", () => ({
  processCheckoutSession: webhookMocks.processCheckoutSession,
}));

vi.mock("@/lib/server/utils/logger", () => ({
  logError: webhookMocks.logError,
}));

vi.mock("@/lib/server/data/subscription-tiers", () => ({
  getTierByName: vi.fn(),
  getTierByProductId: vi.fn(),
}));

vi.mock("@/lib/services/subscription-lifecycle", () => ({
  deriveAppStatusFromStripe: vi.fn(),
}));

function createWebhookEventLookup(insertMock: ReturnType<typeof vi.fn>) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: insertMock,
    }),
  };
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_mock";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_mock";
  });

  it("returns 500 when a subscription checkout event cannot be processed", async () => {
    const insertMock = vi.fn().mockResolvedValue({ error: null });
    webhookMocks.createServiceClient.mockReturnValue(createWebhookEventLookup(insertMock));
    webhookMocks.constructEvent.mockReturnValue({
      id: "evt_checkout_failed",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_failed",
          mode: "subscription",
          metadata: { user_id: "user-1" },
        },
      },
    });
    webhookMocks.processCheckoutSession.mockResolvedValue({
      success: false,
      error: new Error("database unavailable"),
    });

    const { POST } = await import("@/app/api/webhooks/stripe/route");

    const response = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        headers: { "stripe-signature": "sig_mock" },
        body: "{}",
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Webhook processing failed",
    });
    expect(insertMock).not.toHaveBeenCalled();
  });
});
