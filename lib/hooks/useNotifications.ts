"use client";

/**
 * Notifications Hook with Realtime Subscription
 * 
 * Provides notification data and operations using React Query for caching.
 * Subscribes to Supabase Realtime for instant updates.
 */

import { useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
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
  
  // Actions
  markAsRead: (id: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
  archive: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useNotifications(options: UseNotificationsOptions = {}): UseNotificationsReturn {
  const { 
    limit = 50, 
    autoFetch = true,
    initialData,
    initialUnreadCount = 0,
  } = options;
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Query key for React Query cache
  const queryKey = ['notifications', user?.id, limit];

  // Main query for notifications list
  const {
    data: queryData,
    isLoading,
    error: queryError,
    refetch: refetchNotifications,
  } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) {
        return { notifications: [], count: 0, unreadCount: 0 };
      }

      const { notifications, count, unreadCount, error } = await notificationsService.getNotifications({
        limit,
        offset: 0,
      });

      if (error) {
        throw error;
      }

      return { notifications, count, unreadCount };
    },
    enabled: autoFetch && !!user && isAuthenticated,
    initialData: initialData && initialUnreadCount !== undefined 
      ? { notifications: initialData, count: initialData.length, unreadCount: initialUnreadCount }
      : undefined,
    staleTime: 2 * 60 * 1000, // 2 minutes (real-time data, but allow some caching)
    gcTime: 10 * 60 * 1000, // 10 minutes cache time
    refetchOnWindowFocus: true, // Refetch on focus for notifications (user might have new notifications)
  });

  const notifications = queryData?.notifications || [];
  const totalCount = queryData?.count || 0;
  const unreadCount = queryData?.unreadCount || 0;
  const hasMore = notifications.length < totalCount;

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
            queryClient.setQueryData(queryKey, (old: { notifications: Notification[]; count: number; unreadCount: number } | undefined) => {
              if (!old) {
                return {
                  notifications: [newNotification],
                  count: 1,
                  unreadCount: newNotification.is_read ? 0 : 1,
                };
              }

              // Check if notification already exists (avoid duplicates)
              const exists = old.notifications.some(n => n.id === newNotification.id);
              if (exists) {
                return old;
              }

              // Prepend new notification and update counts
              return {
                notifications: [newNotification, ...old.notifications],
                count: old.count + 1,
                unreadCount: old.unreadCount + (newNotification.is_read ? 0 : 1),
              };
            });
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

          queryClient.setQueryData(queryKey, (old: { notifications: Notification[]; count: number; unreadCount: number } | undefined) => {
            if (!old) {
              return {
                notifications: [updatedNotification],
                count: 1,
                unreadCount: updatedNotification.is_read ? 0 : 1,
              };
            }

            // Update the notification in the list
            const updatedNotifications = old.notifications.map(n =>
              n.id === updatedNotification.id ? updatedNotification : n
            );

            // Calculate unread count change
            const wasUnread = oldNotification && !oldNotification.is_read && !oldNotification.is_archived;
            const isUnread = !updatedNotification.is_read && !updatedNotification.is_archived;
            let newUnreadCount = old.unreadCount;
            
            if (wasUnread && !isUnread) {
              newUnreadCount = Math.max(0, newUnreadCount - 1);
            } else if (!wasUnread && isUnread) {
              newUnreadCount = newUnreadCount + 1;
            }

            // Remove if archived and we're not showing archived
            const filteredNotifications = updatedNotifications.filter(n => !n.is_archived);

            return {
              notifications: filteredNotifications,
              count: old.count,
              unreadCount: newUnreadCount,
            };
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Subscribed to notifications realtime');
        } else if (status === 'CHANNEL_ERROR') {
          // Realtime may not be enabled for notifications table
          // This is non-critical - we'll fall back to polling via refetch
          if (process.env.NODE_ENV === 'development') {
            console.warn(
              'Notifications realtime subscription failed. ' +
              'This may be because Realtime replication is not enabled for the notifications table. ' +
              'Notifications will still work via polling. ' +
              'To enable Realtime: Supabase Dashboard → Database → Replication → Enable for notifications table'
            );
          }
          // Refetch on error to ensure data is still available
          refetchNotifications();
        } else if (status === 'TIMED_OUT') {
          console.warn('Notifications realtime subscription timed out, reconnecting...');
          // Refetch on timeout
          refetchNotifications();
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
    markAsRead,
    markAllAsRead,
    archive,
    refresh,
  };
}
