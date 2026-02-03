"use client";

/**
 * NotificationItem Component
 *
 * Individual notification row with severity styling,
 * type badge, and action buttons.
 */

import {
  Archive,
  Bell,
  CreditCard,
  Gift,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Notification } from "@/lib/types/database";

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onArchive?: () => void;
  showArchiveButton?: boolean;
}

/**
 * Get icon based on notification type
 */
function getTypeIcon(type: string) {
  switch (type) {
    case "billing":
      return CreditCard;
    case "reward":
      return Gift;
    case "social":
      return Users;
    case "warning":
      return AlertTriangle;
    case "info":
      return Info;
    case "system":
    default:
      return Bell;
  }
}

/**
 * Get severity-based styles
 */
function getSeverityStyles(severity: string) {
  switch (severity) {
    case "success":
      return {
        icon: CheckCircle2,
        iconColor: "text-green-500",
        bgColor: "bg-green-500/10",
      };
    case "warning":
      return {
        icon: AlertTriangle,
        iconColor: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
      };
    case "error":
      return {
        icon: XCircle,
        iconColor: "text-red-500",
        bgColor: "bg-red-500/10",
      };
    case "info":
    default:
      return {
        icon: Info,
        iconColor: "text-blue-500",
        bgColor: "bg-blue-500/10",
      };
  }
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
function formatTimeAgo(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? "s" : ""} ago`;
    if (diffDay < 7) return `${diffDay} day${diffDay !== 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  } catch {
    return "Just now";
  }
}

export function NotificationItem({
  notification,
  onClick,
  onArchive,
  showArchiveButton = true,
}: NotificationItemProps) {
  const TypeIcon = getTypeIcon(notification.type);
  const severityStyles = getSeverityStyles(notification.severity);
  const SeverityIcon = severityStyles.icon;

  const isUnread = !notification.is_read;
  const hasAction = notification.action_url && notification.action_label;

  return (
    <div
      className={cn(
        "px-3 py-3 hover:bg-muted/50 transition-colors cursor-pointer group",
        isUnread && "bg-muted/30"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex gap-3">
        {/* Icon with severity background */}
        <div
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
            severityStyles.bgColor
          )}
        >
          <SeverityIcon className={cn("h-4 w-4", severityStyles.iconColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title with unread indicator */}
          <div className="flex items-start gap-2">
            <p
              className={cn(
                "text-sm line-clamp-1",
                isUnread ? "font-semibold" : "font-medium"
              )}
            >
              {notification.title}
            </p>
            {isUnread && (
              <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
            )}
          </div>

          {/* Body */}
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {notification.body}
          </p>

          {/* Footer: time + type badge + actions */}
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-2">
              {/* Time */}
              <span className="text-[10px] text-muted-foreground">
                {formatTimeAgo(notification.created_at)}
              </span>

              {/* Type badge */}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">
                {notification.type}
              </span>
            </div>

            {/* Actions (visible on hover) - use centralized tooltip */}
            <TooltipProvider delayDuration={0}>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {hasAction && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClick();
                        }}
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      {notification.action_label || "Open"}
                    </TooltipContent>
                  </Tooltip>
                )}
                {showArchiveButton && onArchive && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          onArchive();
                        }}
                      >
                        <Archive className="h-3 w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4}>
                      Archive
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
