"use client";

/**
 * NotificationPopover Component
 *
 * Popover content that displays notifications with tabs for
 * Unread, All, and Archived notifications.
 */

import { useMemo } from "react";
import { CheckCheck, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { NotificationItem } from "./notification-item";

interface NotificationPopoverProps {
  /** Callback when the popover should close */
  onClose: () => void;
}

export function NotificationPopover({ onClose }: NotificationPopoverProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    archive,
  } = useNotifications({ autoFetch: true });

  // Filter notifications by tab
  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.is_read && !n.is_archived),
    [notifications]
  );

  const allNotifications = useMemo(
    () => notifications.filter((n) => !n.is_archived),
    [notifications]
  );

  const archivedNotifications = useMemo(
    () => notifications.filter((n) => n.is_archived),
    [notifications]
  );

  // Handle mark all as read
  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  // Handle notification click
  const handleNotificationClick = async (
    notificationId: string,
    actionUrl?: string | null
  ) => {
    await markAsRead(notificationId);
    if (actionUrl) {
      onClose();
      // Use window.location for external URLs, router for internal
      if (actionUrl.startsWith("http")) {
        window.open(actionUrl, "_blank");
      } else {
        window.location.href = actionUrl;
      }
    }
  };

  // Handle archive
  const handleArchive = async (notificationId: string) => {
    await archive(notificationId);
  };

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-sm text-destructive">Failed to load notifications</p>
        <p className="text-xs text-muted-foreground mt-1">
          Please try again later
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="font-semibold text-sm">Notifications</h3>
        {unreadCount > 0 && !isLoading && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllAsRead}
            className="h-7 text-xs"
          >
            <CheckCheck className="h-3 w-3 mr-1" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Tabs: primary button look (matches Browse and Results/Settings) */}
      <Tabs defaultValue="unread" className="w-full">
        <TabsList variant="default" className="w-full flex gap-2 p-1 mx-3 mt-2">
          <TabsTrigger
            value="unread"
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
              "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:bg-primary/80",
              "data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-primary/10 data-[state=inactive]:hover:text-primary"
            )}
          >
            Unread
            {unreadCount > 0 && (
              <span className="ml-1 text-xs opacity-90">({unreadCount})</span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="all"
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
              "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:bg-primary/80",
              "data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-primary/10 data-[state=inactive]:hover:text-primary"
            )}
          >
            All
          </TabsTrigger>
          <TabsTrigger
            value="archived"
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium transition-colors",
              "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:hover:bg-primary/80",
              "data-[state=inactive]:bg-muted data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:bg-primary/10 data-[state=inactive]:hover:text-primary"
            )}
          >
            Archived
          </TabsTrigger>
        </TabsList>

        {/* Loading state */}
        {isLoading ? (
          <div className="p-3 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Unread Tab */}
            <TabsContent value="unread" className="m-0">
              <ScrollArea className="h-72">
                {unreadNotifications.length === 0 ? (
                  <EmptyState message="No unread notifications" />
                ) : (
                  <div className="divide-y">
                    {unreadNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={() =>
                          handleNotificationClick(
                            notification.id,
                            notification.action_url
                          )
                        }
                        onArchive={() => handleArchive(notification.id)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* All Tab */}
            <TabsContent value="all" className="m-0">
              <ScrollArea className="h-72">
                {allNotifications.length === 0 ? (
                  <EmptyState message="No notifications yet" />
                ) : (
                  <div className="divide-y">
                    {allNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={() =>
                          handleNotificationClick(
                            notification.id,
                            notification.action_url
                          )
                        }
                        onArchive={() => handleArchive(notification.id)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Archived Tab */}
            <TabsContent value="archived" className="m-0">
              <ScrollArea className="h-72">
                {archivedNotifications.length === 0 ? (
                  <EmptyState message="No archived notifications" />
                ) : (
                  <div className="divide-y">
                    {archivedNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={() =>
                          handleNotificationClick(
                            notification.id,
                            notification.action_url
                          )
                        }
                        showArchiveButton={false}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

/**
 * Empty state component for notification tabs
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-72 text-muted-foreground">
      <Bell className="h-8 w-8 mb-2 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
