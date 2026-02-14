/**
 * Tests for useSubscriptionTiers and SubscriptionProvider.
 * Validates that tiers are not fetched when enabled is false and are fetched when enabled is true.
 * SubscriptionProvider passes enabled: !authLoading && isAuthenticated, so unauthenticated users do not trigger /api/tiers.
 */

import { render, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { useSubscriptionTiers } from "@/lib/hooks/useSubscriptionTiers";

vi.mock("@/lib/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockTiersResponse = {
  tiers: {
    free: {
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
    },
  },
  resolution_credits: { "1K": 1, "2K": 2, "4K": 4 },
  edit_credit_cost: 2,
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useSubscriptionTiers", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockTiersResponse), { status: 200 })
    );
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("does not call /api/tiers when enabled is false", async () => {
    const wrapper = createWrapper();
    renderHook(() => useSubscriptionTiers({ enabled: false }), { wrapper });

    await waitFor(() => {
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  it("calls /api/tiers once when enabled is true", async () => {
    const wrapper = createWrapper();
    renderHook(() => useSubscriptionTiers({ enabled: true }), { wrapper });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith("/api/tiers");
    });
  });

  it("calls /api/tiers once when no options passed (enabled defaults to true)", async () => {
    const wrapper = createWrapper();
    renderHook(() => useSubscriptionTiers(), { wrapper });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(fetchSpy).toHaveBeenCalledWith("/api/tiers");
    });
  });

  it("returns tier data when enabled and fetch succeeds", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useSubscriptionTiers({ enabled: true }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.tiers).toEqual(mockTiersResponse.tiers);
      expect(result.current.getTierByProductId(null).name).toBe("Free");
    });
  });
});

describe("SubscriptionProvider tiers fetch (via useAuth)", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockTiersResponse), { status: 200 })
    );
    const { useAuth } = await import("@/lib/hooks/useAuth");
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      profile: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      isConfigured: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      refreshProfile: vi.fn(),
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("does not call /api/tiers when unauthenticated", async () => {
    const { SubscriptionProvider } = await import("@/lib/hooks/useSubscription");
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionProvider>
          <div data-testid="child" />
        </SubscriptionProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const tiersCalls = fetchSpy.mock.calls.filter(
        (call) => typeof call[0] === "string" && String(call[0]).includes("/api/tiers")
      );
      expect(tiersCalls.length).toBe(0);
    });
  });

  it("calls /api/tiers when authenticated", async () => {
    const { useAuth } = await import("@/lib/hooks/useAuth");
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1" } as never,
      profile: null,
      session: null,
      isLoading: false,
      isAuthenticated: true,
      isConfigured: true,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      resetPassword: vi.fn(),
      updatePassword: vi.fn(),
      refreshProfile: vi.fn(),
    });

    const { SubscriptionProvider } = await import("@/lib/hooks/useSubscription");
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SubscriptionProvider>
          <div data-testid="child" />
        </SubscriptionProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      const tiersCalls = fetchSpy.mock.calls.filter(
        (call) => typeof call[0] === "string" && String(call[0]).includes("/api/tiers")
      );
      expect(tiersCalls.length).toBeGreaterThanOrEqual(1);
    });
  });
});
