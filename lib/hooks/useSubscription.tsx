"use client";

/**
 * Subscription Hook and Provider
 * 
 * Provides subscription state and tier-based feature checks throughout the app.
 * Auto-refreshes subscription status periodically.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import {
  type TierName,
  type TierConfig,
  type Resolution,
} from "@/lib/constants/subscription-tiers";
import { useSubscriptionTiers as useTiers } from "@/lib/hooks/useSubscriptionTiers";
import { logClientError } from "@/lib/utils/client-logger";

// ============================================================================
// Types
// ============================================================================

export interface SubscriptionContextType {
  // State
  tier: TierName;
  tierConfig: TierConfig;
  creditsRemaining: number;
  creditsTotal: number;
  subscriptionEnd: string | null;
  isSubscribed: boolean;
  isLoading: boolean;
  productId: string | null;

  // Feature checks
  canUseResolution: (resolution: Resolution) => boolean;
  canUseAspectRatio: (ratio: string) => boolean;
  canUseEnhance: () => boolean;
  hasCredits: (amount?: number) => boolean;
  getResolutionCost: (resolution: Resolution) => number;
  hasWatermark: () => boolean;
  canCreateCustomAssets: () => boolean;
  getMaxVariations: () => number;

  // Actions
  refreshSubscription: () => Promise<void>;
  deductCredits: (
    amount: number,
    type: string,
    description: string,
    thumbnailId?: string
  ) => Promise<{ error: Error | null }>;
  openCheckout: (priceId: string) => Promise<{ error: Error | null }>;
  openCustomerPortal: () => Promise<{ error: Error | null }>;
}

// ============================================================================
// Context
// ============================================================================

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(
  undefined
);

// ============================================================================
// Helper to check if Supabase is configured
// ============================================================================

function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

// ============================================================================
// Provider
// ============================================================================

interface SubscriptionProviderProps {
  children: ReactNode;
}

// Auto-refresh interval (60 seconds)
const REFRESH_INTERVAL = 60 * 1000;

export function SubscriptionProvider({ children }: SubscriptionProviderProps) {
  const { user, isAuthenticated, isConfigured: authConfigured } = useAuth();
  const { tiers, resolutionCredits, getTierByProductId } = useTiers();

  const [tier, setTier] = useState<TierName>("free");
  const [creditsRemaining, setCreditsRemaining] = useState(10);
  const [creditsTotal, setCreditsTotal] = useState(10);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);

  const tierConfig = useMemo(() => {
    const config = getTierByProductId(productId);
    return config;
  }, [productId, getTierByProductId]);
  
  const isSubscribed = tier !== "free";
  const isConfigured = authConfigured && isSupabaseConfigured();

  /**
   * Fetch subscription status using React Query with automatic polling
   * React Query handles:
   * - Automatic refetching at intervals (60 seconds)
   * - Pausing when tab is hidden (refetchIntervalInBackground: false)
   * - Refreshing when tab becomes visible (refetchOnWindowFocus: true)
   * - Cleanup and deduplication
   */
  const {
    data: subscriptionData,
    isLoading,
    refetch: refetchSubscription,
  } = useQuery({
    queryKey: ["subscription", user?.id],
    queryFn: async () => {
      if (!user || !isConfigured) {
        return null;
      }

      try {
        const subscriptionsService = await import("@/lib/services/subscriptions");
        const { status, error } = await subscriptionsService.checkSubscription();

        if (error) {
          logClientError(error, {
            operation: "check-subscription",
            component: "useSubscription",
          });
          // Fall back to getting subscription directly
          const { subscription } = await subscriptionsService.getSubscription(
            user.id
          );
          if (subscription) {
            // Get tier name from tier config using hook
            let tierName: TierName = "free";
            if (subscription.product_id) {
              const tierConfig = getTierByProductId(subscription.product_id);
              // Map tier config name to tier name
              const nameToTier: Record<string, TierName> = {
                "Free": "free",
                "Starter": "starter",
                "Advanced": "advanced",
                "Pro": "pro",
              };
              tierName = nameToTier[tierConfig.name] || "free";
            }
            return {
              tier: subscription.status === "free" ? "free" : tierName,
              creditsRemaining: subscription.credits_remaining,
              creditsTotal: subscription.credits_total,
              subscriptionEnd: subscription.current_period_end,
              productId: subscription.product_id,
            };
          }
          return null;
        }

        if (status) {
          return {
            tier: status.tier,
            creditsRemaining: status.credits_remaining,
            creditsTotal: status.credits_total,
            subscriptionEnd: status.subscription_end,
            productId: status.product_id,
          };
        }

        return null;
      } catch (error) {
        logClientError(error, {
          operation: "refresh-subscription",
          component: "useSubscription",
        });
        throw error;
      }
    },
    enabled: isAuthenticated && isConfigured && !!user,
    refetchInterval: REFRESH_INTERVAL, // Poll every 60 seconds
    refetchIntervalInBackground: false, // Pause when tab is hidden
    refetchOnWindowFocus: true, // Refresh when tab becomes visible
    staleTime: 30 * 1000, // Consider data stale after 30 seconds
  });

  /**
   * Update local state from React Query data
   */
  useEffect(() => {
    if (subscriptionData) {
      setTier(subscriptionData.tier);
      setCreditsRemaining(subscriptionData.creditsRemaining);
      setCreditsTotal(subscriptionData.creditsTotal);
      setSubscriptionEnd(subscriptionData.subscriptionEnd);
      setProductId(subscriptionData.productId);
    } else if (!isAuthenticated && !user) {
      // Only reset if we're truly not authenticated (no user) AND we don't have existing subscription state
      // This prevents resetting during temporary auth state changes
      setTier("free");
      setCreditsRemaining(10);
      setCreditsTotal(10);
      setSubscriptionEnd(null);
      setProductId(null);
    }
  }, [subscriptionData, isAuthenticated, user]);

  /**
   * Manual refresh function that uses React Query's refetch
   */
  const refreshSubscription = useCallback(async () => {
    await refetchSubscription();
  }, [refetchSubscription]);

  /**
   * Check if user can use a specific resolution
   */
  const canUseResolution = useCallback(
    (resolution: Resolution): boolean => {
      return tierConfig.allowed_resolutions.includes(resolution);
    },
    [tierConfig]
  );

  /**
   * Check if user can use a specific aspect ratio
   */
  const canUseAspectRatio = useCallback(
    (ratio: string): boolean => {
      return tierConfig.allowed_aspect_ratios?.includes(ratio) ?? false;
    },
    [tierConfig]
  );

  /**
   * Check if user can use AI title enhancement
   */
  const canUseEnhance = useCallback((): boolean => {
    return tierConfig.has_enhance;
  }, [tierConfig]);

  /**
   * Check if user has enough credits
   */
  const hasCredits = useCallback(
    (amount: number = 1): boolean => {
      return creditsRemaining >= amount;
    },
    [creditsRemaining]
  );

  /**
   * Get credit cost for a resolution
   */
  const getResolutionCost = useCallback((resolution: Resolution): number => {
    return resolutionCredits[resolution] || 1;
  }, [resolutionCredits]);

  /**
   * Check if thumbnails will have watermark
   */
  const hasWatermark = useCallback((): boolean => {
    return tierConfig.has_watermark;
  }, [tierConfig]);

  /**
   * Check if user can create custom styles, palettes, and faces
   */
  const canCreateCustomAssets = useCallback((): boolean => {
    return tierConfig.can_create_custom;
  }, [tierConfig]);

  /**
   * Get the maximum number of variations allowed for the user's tier
   */
  const getMaxVariations = useCallback((): number => {
    return tierConfig.max_variations;
  }, [tierConfig]);

  /**
   * Deduct credits for a generation
   */
  const deductCredits = useCallback(
    async (
      amount: number,
      type: string,
      description: string,
      thumbnailId?: string
    ): Promise<{ error: Error | null }> => {
      if (!user || !isConfigured) {
        return { error: new Error("Not authenticated") };
      }

      try {
        const subscriptionsService = await import("@/lib/services/subscriptions");
        const { error } = await subscriptionsService.deductCredits(
          user.id,
          amount,
          type,
          description,
          thumbnailId
        );

        if (!error) {
          // Optimistically update local state
          setCreditsRemaining((prev) => Math.max(0, prev - amount));
        }

        return { error };
      } catch (error) {
        return { error: error as Error };
      }
    },
    [user, isConfigured]
  );

  /**
   * Open Stripe checkout for subscription purchase
   */
  const openCheckout = useCallback(
    async (priceId: string): Promise<{ error: Error | null }> => {
      if (!isConfigured) {
        return { error: new Error("Supabase not configured") };
      }

      try {
        const subscriptionsService = await import("@/lib/services/subscriptions");
        const { url, error } = await subscriptionsService.createCheckout(priceId);

        if (error) {
          return { error };
        }

        if (url) {
          window.location.href = url;
        }

        return { error: null };
      } catch (error) {
        return { error: error as Error };
      }
    },
    [isConfigured]
  );

  /**
   * Open Stripe customer portal for subscription management
   */
  const openCustomerPortal = useCallback(async (): Promise<{
    error: Error | null;
  }> => {
    if (!isConfigured) {
      return { error: new Error("Supabase not configured") };
    }

    try {
      const subscriptionsService = await import("@/lib/services/subscriptions");
      const { url, error } = await subscriptionsService.getCustomerPortal();

      if (error) {
        return { error };
      }

      if (url) {
        window.location.href = url;
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [isConfigured]);

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: SubscriptionContextType = useMemo(() => ({
    tier,
    tierConfig,
    creditsRemaining,
    creditsTotal,
    subscriptionEnd,
    isSubscribed,
    isLoading,
    productId,
    canUseResolution,
    canUseAspectRatio,
    canUseEnhance,
    hasCredits,
    getResolutionCost,
    hasWatermark,
    canCreateCustomAssets,
    getMaxVariations,
    refreshSubscription,
    deductCredits,
    openCheckout,
    openCustomerPortal,
  }), [
    tier,
    tierConfig,
    creditsRemaining,
    creditsTotal,
    subscriptionEnd,
    isSubscribed,
    isLoading,
    productId,
    canUseResolution,
    canUseAspectRatio,
    canUseEnhance,
    hasCredits,
    getResolutionCost,
    hasWatermark,
    canCreateCustomAssets,
    getMaxVariations,
    refreshSubscription,
    deductCredits,
    openCheckout,
    openCustomerPortal,
  ]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Use subscription context
 * Must be used within a SubscriptionProvider
 */
export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);

  if (context === undefined) {
    throw new Error(
      "useSubscription must be used within a SubscriptionProvider"
    );
  }

  return context;
}

