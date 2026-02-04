"use client";

/**
 * StudioViewUpdates
 *
 * Center view for reading notification messages as markdown articles.
 * - When selectedUpdateId is set: show single notification title + body (markdown).
 * - When no selection: show list of recent notifications; click opens article.
 * Uses cache-first useNotificationById and reuse of NotificationItem for list.
 */

import React, { useCallback } from "react";
import { ChevronLeft, Bell } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ViewHeader } from "@/components/studio/view-controls";
import { useStudio } from "@/components/studio/studio-provider";
import { useNotificationById } from "@/lib/hooks/useNotificationById";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { NotificationItem } from "@/components/notifications/notification-item";
import { cn } from "@/lib/utils";

export function StudioViewUpdates() {
  const {
    state: { selectedUpdateId },
    actions: { setSelectedUpdateId },
  } = useStudio();

  const { notification, isLoading, error } = useNotificationById(selectedUpdateId);
  const {
    notifications,
    isLoading: listLoading,
    markAsRead,
    archive,
  } = useNotifications({ autoFetch: true });

  const handleBack = useCallback(() => {
    setSelectedUpdateId(null);
  }, [setSelectedUpdateId]);

  const handleSelectNotification = useCallback(
    (id: string) => {
      setSelectedUpdateId(id);
    },
    [setSelectedUpdateId]
  );

  const handleArchive = useCallback(
    async (id: string) => {
      await archive(id);
      if (selectedUpdateId === id) {
        setSelectedUpdateId(null);
      }
    },
    [archive, selectedUpdateId, setSelectedUpdateId]
  );

  // Article view: selected notification
  if (selectedUpdateId) {
    if (error) {
      return (
        <div>
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4 gap-1">
            <ChevronLeft className="h-4 w-4" />
            Notifications
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-destructive">
                {error instanceof Error ? error.message : "Failed to load update"}
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (isLoading || !notification) {
      return (
        <div>
          <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4 gap-1">
            <ChevronLeft className="h-4 w-4" />
            Notifications
          </Button>
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground">Loading...</p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col">
        <div className="mb-4 flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Notifications
          </Button>
        </div>
        <ScrollArea className="flex-1 pr-4">
          <article className="max-w-3xl">
            <h1 className="mb-4 text-2xl font-bold">{notification.title}</h1>
            <div
              className={cn(
                "prose prose-sm dark:prose-invert max-w-none",
                "[&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_pre]:my-2",
                "[&_code]:text-xs [&_pre]:rounded-md [&_pre]:bg-muted/50 [&_pre]:p-3 [&_pre]:overflow-x-auto"
              )}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const isBlock = className?.startsWith("language-");
                    return isBlock ? (
                      <code className={cn("block text-xs", className)} {...props}>
                        {children}
                      </code>
                    ) : (
                      <code
                        className="rounded bg-muted px-1 py-0.5 text-xs"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                }}
              >
                {notification.body}
              </ReactMarkdown>
            </div>
          </article>
        </ScrollArea>
      </div>
    );
  }

  // List view: all notifications
  return (
    <div>
      <ViewHeader
        title="Notifications"
        description="Announcements and messages from the team"
        count={notifications.length}
        countLabel="notifications"
      />

      {listLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground">Loading notifications...</p>
          </CardContent>
        </Card>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No notifications yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Select a notification from the bell to read it here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y rounded-lg border">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onClick={() => {
                markAsRead(n.id);
                handleSelectNotification(n.id);
              }}
              onArchive={() => handleArchive(n.id)}
              showArchiveButton={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default StudioViewUpdates;
