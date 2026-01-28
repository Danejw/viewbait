"use client";

/**
 * Referrals Hook (React Query)
 * 
 * Provides referral code data and operations using React Query for caching.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

export interface ReferralStats {
  pending: number;
  rewarded: number;
  total: number;
}

export interface UseReferralsReturn {
  // State
  referralCode: string | null;
  stats: ReferralStats | null;
  isLoading: boolean;
  error: Error | null;

  // Actions
  applyReferralCode: (code: string) => Promise<{ success: boolean; message: string }>;
  refresh: () => Promise<void>;
}

export function useReferrals(): UseReferralsReturn {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  // Query key for referral code
  const codeQueryKey = ['referral-code', user?.id];
  
  // Query key for referral stats
  const statsQueryKey = ['referral-stats', user?.id];

  // Query for referral code
  const {
    data: codeData,
    isLoading: isLoadingCode,
    error: codeError,
    refetch: refetchCode,
  } = useQuery({
    queryKey: codeQueryKey,
    queryFn: async () => {
      if (!user) {
        return { code: null };
      }

      const response = await fetch('/api/referrals/code');
      if (!response.ok) {
        throw new Error('Failed to fetch referral code');
      }

      const data = await response.json();
      // Extract code string from ReferralCode object
      return { code: data.code?.code || null };
    },
    enabled: isAuthenticated && !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Query for referral stats
  const {
    data: statsData,
    isLoading: isLoadingStats,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: statsQueryKey,
    queryFn: async () => {
      if (!user) {
        return { stats: { pending: 0, rewarded: 0, total: 0 } };
      }

      const response = await fetch('/api/referrals/stats');
      if (!response.ok) {
        throw new Error('Failed to fetch referral stats');
      }

      const data = await response.json();
      return { stats: data.stats || { pending: 0, rewarded: 0, total: 0 } };
    },
    enabled: isAuthenticated && !!user,
    staleTime: 2 * 60 * 1000, // 2 minutes (stats change less frequently)
    gcTime: 10 * 60 * 1000, // 10 minutes
  });

  // Mutation for applying referral code
  const applyMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await fetch('/api/referrals/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply referral code');
      }

      return { success: data.success, message: data.message };
    },
    onSuccess: () => {
      // Invalidate stats query since applying a code might affect stats
      queryClient.invalidateQueries({ queryKey: statsQueryKey });
    },
  });

  // Apply referral code wrapper
  const applyReferralCode = async (
    code: string
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const result = await applyMutation.mutateAsync(code);
      return result;
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to apply referral code',
      };
    }
  };

  // Refresh data
  const refresh = async () => {
    await Promise.all([refetchCode(), refetchStats()]);
  };

  return {
    referralCode: codeData?.code || null,
    stats: statsData?.stats || null,
    isLoading: isLoadingCode || isLoadingStats || applyMutation.isPending,
    error: (codeError || statsError || applyMutation.error) as Error | null,
    applyReferralCode,
    refresh,
  };
}
