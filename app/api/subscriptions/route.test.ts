import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(),
  requireAuth: vi.fn(),
  createCustomerPortalSession: vi.fn(),
  pauseSubscription: vi.fn(),
  resumeSubscription: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: routeMocks.createClient,
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: routeMocks.createServiceClient,
}));

vi.mock("@/lib/server/utils/auth", () => ({
  requireAuth: routeMocks.requireAuth,
}));

vi.mock("@/lib/services/stripe", () => ({
  createCustomerPortalSession: routeMocks.createCustomerPortalSession,
  pauseSubscription: routeMocks.pauseSubscription,
  resumeSubscription: routeMocks.resumeSubscription,
}));

vi.mock("@/lib/server/utils/logger", () => ({
  logError: routeMocks.logError,
}));

import { POST } from "@/app/api/subscriptions/route";

const existingSubscription = {
  user_id: "user-1",
  status: "free",
  credits_total: 10,
  credits_remaining: 10,
  product_id: null,
};

function createReadQuery(data: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function createWriteQuery(data: unknown) {
  return {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error: null }),
  };
}

function createRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.createClient.mockResolvedValue({});
    routeMocks.requireAuth.mockResolvedValue({ id: "user-1" });
  });

  it("does not update an existing subscription with client-supplied billing fields", async () => {
    const readQuery = createReadQuery(existingSubscription);
    const writeQuery = createWriteQuery({
      ...existingSubscription,
      status: "active",
      product_id: "prod_attacker",
      credits_remaining: 9999,
    });
    const serviceClient = {
      from: vi.fn().mockReturnValueOnce(readQuery).mockReturnValueOnce(writeQuery),
    };
    routeMocks.createServiceClient.mockReturnValue(serviceClient);

    const response = await POST(
      createRequest({
        status: "active",
        product_id: "prod_attacker",
        credits_remaining: 9999,
        credits_total: 9999,
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      subscription: existingSubscription,
    });
    expect(writeQuery.update).not.toHaveBeenCalled();
    expect(writeQuery.insert).not.toHaveBeenCalled();
  });

  it("creates only a free subscription when no subscription exists", async () => {
    const insertedSubscription = {
      ...existingSubscription,
      stripe_customer_id: null,
      subscription_id: null,
      current_period_start: null,
      current_period_end: null,
    };
    const readQuery = createReadQuery(null);
    const writeQuery = createWriteQuery(insertedSubscription);
    const serviceClient = {
      from: vi.fn().mockReturnValueOnce(readQuery).mockReturnValueOnce(writeQuery),
    };
    routeMocks.createServiceClient.mockReturnValue(serviceClient);

    const response = await POST(
      createRequest({
        status: "active",
        product_id: "prod_attacker",
        credits_remaining: 9999,
        credits_total: 9999,
      })
    );

    expect(response.status).toBe(201);
    expect(writeQuery.insert).toHaveBeenCalledWith({
      user_id: "user-1",
      status: "free",
      credits_total: 10,
      credits_remaining: 10,
      stripe_customer_id: null,
      subscription_id: null,
      product_id: null,
      current_period_start: null,
      current_period_end: null,
    });
  });
});
