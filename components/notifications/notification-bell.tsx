"use client";

/**
 * NotificationBell Component
 *
 * Bell icon with unread count badge that opens a notification popover.
 * Integrates with useNotifications hook for real-time updates.
 */

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { NotificationPopover } from "./notification-popover";

interface NotificationBellProps {
  /** Size variant for the button */
  size?: "icon-sm" | "icon" | "sm" | "default";
  /** Additional className for the button */
  className?: string;
}

export function NotificationBell({
  size = "icon-sm",
  className,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { unreadCount, isLoading } = useNotifications({ autoFetch: true });

  // Format unread count for display (99+ when over 99)
  const displayCount = unreadCount > 99 ? "99+" : unreadCount.toString();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={size}
          className={cn("relative", className)}
          aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && !isLoading && (
            <span
              className={cn(
                "absolute flex items-center justify-center",
                "rounded-full bg-destructive text-destructive-foreground",
                "text-[10px] font-medium leading-none",
                "min-w-[16px] h-4 px-1",
                "-top-1 -right-1"
              )}
            >
              {displayCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={8}
        className="w-80 p-0"
      >
        <NotificationPopover onClose={() => setIsOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}
