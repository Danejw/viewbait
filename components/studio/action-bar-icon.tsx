"use client";

/**
 * ActionBarIcon – shared wrapper for every icon in studio thumbnail/card action bars.
 *
 * Ensures consistent hover effects across:
 * - Thumbnail cards (thumbnails tab)
 * - Style thumbnail cards
 * - Palette thumbnail cards
 * - Face thumbnails
 *
 * Effects: scale up (110%) + lift (-translate-y-1) on hover for a dock-style feel.
 * Use forwardRef so it works with Radix asChild (e.g. DropdownMenuTrigger).
 */

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const ActionBarIcon = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { children: React.ReactNode }
>(function ActionBarIcon({ children, className, ...props }, ref) {
  return (
    <span
      ref={ref}
      className={cn(
        "inline-flex transition-transform duration-200 ease-out hover:scale-110 hover:-translate-y-1",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
});

export interface ActionButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  variant?: "default" | "destructive";
  active?: boolean;
  disabled?: boolean;
  iconClassName?: string;
  /** Active state text color (default: "text-red-500") */
  activeClassName?: string;
  /** Active state icon fill (default: "fill-red-500") */
  iconActiveClassName?: string;
}

/**
 * Shared action button for studio cards: Tooltip + ActionBarIcon + Button + Icon.
 * Used by thumbnail-card, palette-thumbnail-card, style-thumbnail-card, face-thumbnail, youtube-video-card.
 */
export function ActionButton({
  icon: Icon,
  label,
  onClick,
  variant = "default",
  active = false,
  disabled = false,
  iconClassName,
  activeClassName = "text-red-500",
  iconActiveClassName = "fill-red-500",
}: ActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ActionBarIcon className={cn(disabled && "pointer-events-none opacity-60")}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "h-7 w-7 bg-muted/80 hover:bg-muted",
              variant === "destructive" && "hover:bg-destructive/20 hover:text-destructive",
              active && activeClassName
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4",
                iconClassName,
                active && iconActiveClassName
              )}
            />
          </Button>
        </ActionBarIcon>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
