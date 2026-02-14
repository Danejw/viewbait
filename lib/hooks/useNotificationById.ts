"use client";

/**
 * useNotificationById
 *
 * Fetches a single notification by id with cache-first behavior:
 * prefers the existing notifications list cache (same queryKey as useNotifications),
 * only calls GET /api/notifications/[id] when not in cache or when refetch is needed.
 */

import { useQuery } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/useAuth";
import * as notificationsService from "@/lib/services/notifications";
import type { Notification } from "@/lib/types/database";

const NOTIFICATIONS_LIST_LIMIT = 10;

export interface UseNotificationByIdReturn {
  notification: Notification | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Fetch a single notification. Cache-first: check list cache, then GET by id if needed.
 */
export function useNotificationById(id: string | null): UseNotificationByIdReturn {
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: notification,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["notifications", "byId", user?.id ?? "", id ?? ""],
    queryFn: async (): Promise<Notification | null> => {
      if (!id || !user?.id) return null;

      // Cache-first: check existing list cache (infinite query shape from useNotifications)
      const listData = queryClient.getQueryData<{
        pages: { notifications: Notification[]; count: number; unreadCount: number }[];
        pageParams: number[];
      }>(["notifications", user.id, NOTIFICATIONS_LIST_LIMIT]);
      const allFromList = listData?.pages?.flatMap((p) => p.notifications) ?? [];
      const fromList = allFromList.find((n) => n.id === id);
      if (fromList) return fromList;

      // Not in list cache; fetch by id (e.g. deep link)
      const { notification: fetched, error: fetchError } =
        await notificationsService.getNotificationById(id);
      if (fetchError) throw fetchError;
      return fetched;
    },
    enabled: !!id && !!user?.id && isAuthenticated,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    notification: notification ?? null,
    isLoading,
    error: error as Error | null,
  };
}
