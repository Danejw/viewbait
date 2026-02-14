"use client";

/**
 * Notifications Hook with Realtime Subscription
 * 
 * Provides notification data and operations using React Query for caching.
 * Subscribes to Supabase Realtime for instant updates.
 */

import { useEffect, useRef, useCallback, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { shouldRefetchOnFocus } from "@/lib/utils/focus-refetch";
import { createClient } from "@/lib/supabase/client";
import * as notificationsService from "@/lib/services/notifications";
import type { Notification } from "@/lib/types/database";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface UseNotificationsOptions {
  limit?: number;
  autoFetch?: boolean;
  initialData?: Notification[];
  initialUnreadCount?: number;
}

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: Error | null;
  totalCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;

  // Actions
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  archive: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const NOTIFICATIONS_PAGE_LIMIT = 10;

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const {
    limit = NOTIFICATIONS_PAGE_LIMIT,
    autoFetch = true,
    initialData,
    initialUnreadCount = 0,
  } = options;
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);
  /** When true, skip refetch from realtime so we don't hammer the API after 5xx. */
  const apiErrorRef = useRef(false);

  // Query key for React Query cache (infinite query)
  const queryKey = ['notifications', user?.id, limit];

  const {
    data,
    isLoading,
    error: queryError,
    refetch: refetchNotifications,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      if (!user) {
        return { notifications: [] as Notification[], count: 0, unreadCount: 0, offset: 0 };
      }
      const offset = pageParam as number;
      const { notifications, count, unreadCount, error } = await notificationsService.getNotifications({
        limit,
        offset,
      });
      if (error) throw error;
      return { notifications, count, unreadCount, offset };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const totalLoaded = allPages.reduce((sum, p) => sum + p.notifications.length, 0);
      return totalLoaded < lastPage.count ? totalLoaded : undefined;
    },
    enabled: autoFetch && !!user && isAuthenticated,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: (query) =>
      shouldRefetchOnFocus() && !query.state.error,
    retry: 0, // Avoid repeated requests on 5xx; one request per trigger
  });

  // Track error state so realtime callback doesn't refetch when API is failing
  useEffect(() => {
    apiErrorRef.current = !!queryError;
  }, [queryError]);

  const notifications = useMemo(
    () => data?.pages.flatMap((p) => p.notifications) ?? [],
    [data]
  );
  const totalCount = data?.pages[0]?.count ?? 0;
  const unreadCount = data?.pages[0]?.unreadCount ?? 0;
  const hasMore = (hasNextPage ?? false) && notifications.length < totalCount;

  const loadMore = useCallback(async () => {
    if (hasNextPage && !isFetchingNextPage) await fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Set up Realtime subscription
  useEffect(() => {
    if (!user || !isAuthenticated) {
      // Clean up subscription if user logs out
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      return;
    }

    const supabase = createClient();

    // Create channel for notifications
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on<Notification>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Notification>) => {
          // New notification inserted
          const newNotification = payload.new;
          
          // Type guard: ensure newNotification is a valid Notification
          if (!newNotification || typeof newNotification !== 'object' || !('id' in newNotification)) {
            return;
          }
          
          // Only add if not archived
          if (!newNotification.is_archived) {
            queryClient.setQueryData(
              queryKey,
              (old: { pages: { notifications: Notification[]; count: number; unreadCount: number }[]; pageParams: number[] } | undefined) => {
                if (!old?.pages?.length) {
                  return {
                    pages: [{ notifications: [newNotification], count: 1, unreadCount: newNotification.is_read ? 0 : 1 }],
                    pageParams: [0],
                  };
                }
                const first = old.pages[0];
                const exists = first.notifications.some((n) => n.id === newNotification.id);
                if (exists) return old;
                const updatedFirst = {
                  ...first,
                  notifications: [newNotification, ...first.notifications],
                  count: first.count + 1,
                  unreadCount: first.unreadCount + (newNotification.is_read ? 0 : 1),
                };
                return {
                  ...old,
                  pages: [updatedFirst, ...old.pages.slice(1)],
                };
              }
            );
          }
        }
      )
      .on<Notification>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: RealtimePostgresChangesPayload<Notification>) => {
          // Notification updated (read/archived)
          const updatedNotification = payload.new;
          const oldNotification = payload.old as Notification;

          // Type guard: ensure updatedNotification is a valid Notification
          if (!updatedNotification || typeof updatedNotification !== 'object' || !('id' in updatedNotification)) {
            return;
          }

          queryClient.setQueryData(
            queryKey,
            (old: { pages: { notifications: Notification[]; count: number; unreadCount: number }[]; pageParams: number[] } | undefined) => {
              if (!old?.pages?.length) return old;
              const first = old.pages[0];
              const updatedNotifications = first.notifications.map((n) =>
                n.id === updatedNotification.id ? updatedNotification : n
              );
              const wasUnread = oldNotification && !oldNotification.is_read && !oldNotification.is_archived;
              const isUnread = !updatedNotification.is_read && !updatedNotification.is_archived;
              let newUnreadCount = first.unreadCount;
              if (wasUnread && !isUnread) newUnreadCount = Math.max(0, newUnreadCount - 1);
              else if (!wasUnread && isUnread) newUnreadCount += 1;
              const filtered = updatedNotifications.filter((n) => !n.is_archived);
              const updatedFirst = { ...first, notifications: filtered, unreadCount: newUnreadCount };
              return { ...old, pages: [updatedFirst, ...old.pages.slice(1)] };
            }
          );
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to notifications realtime');
        } else if (status === 'CHANNEL_ERROR') {
          // Realtime may not be enabled for notifications table
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              'Notifications realtime subscription failed. ' +
              'This may be because Realtime replication is not enabled for the notifications table. ' +
              'To enable Realtime: Supabase Dashboard → Database → Replication → Enable for notifications table'
            );
          }
          // Only refetch if API isn't already failing (avoid hammering on 5xx)
          if (!apiErrorRef.current) refetchNotifications();
        } else if (status === 'TIMED_OUT') {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Notifications realtime subscription timed out.');
          }
          if (!apiErrorRef.current) refetchNotifications();
        }
      });

    subscriptionRef.current = {
      unsubscribe: () => {
        channel.unsubscribe();
      },
    };

    // Cleanup on unmount or user change
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
    };
  }, [user?.id, isAuthenticated, queryKey, queryClient, refetchNotifications]);

  // Mutation for marking notification as read
  const markAsReadMutation = useMutation({
    mutationFn: notificationsService.markNotificationAsRead,
    onSuccess: () => {
      // Invalidate and refetch notifications list
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Mutation for archiving notification
  const archiveMutation = useMutation({
    mutationFn: notificationsService.archiveNotification,
    onSuccess: () => {
      // Invalidate and refetch notifications list
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Mutation for marking all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: notificationsService.markAllNotificationsAsRead,
    onSuccess: () => {
      // Invalidate and refetch notifications list
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Mark as read wrapper
  const markAsRead = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await markAsReadMutation.mutateAsync(id);
      return result.notification !== null;
    } catch (error) {
      return false;
    }
  }, [markAsReadMutation]);

  // Archive wrapper
  const archive = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await archiveMutation.mutateAsync(id);
      return result.notification !== null;
    } catch (error) {
      return false;
    }
  }, [archiveMutation]);

  // Mark all as read wrapper
  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    try {
      const result = await markAllAsReadMutation.mutateAsync();
      return result.success;
    } catch (error) {
      return false;
    }
  }, [markAllAsReadMutation]);

  // Refresh data
  const refresh = useCallback(async () => {
    await refetchNotifications();
  }, [refetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading: isLoading || markAsReadMutation.isPending || archiveMutation.isPending || markAllAsReadMutation.isPending,
    error: queryError as Error | null || markAsReadMutation.error as Error | null || archiveMutation.error as Error | null || markAllAsReadMutation.error as Error | null,
    totalCount,
    hasMore,
    isLoadingMore: isFetchingNextPage,
    markAsRead,
    markAllAsRead,
    archive,
    refresh,
    loadMore,
  };
}
