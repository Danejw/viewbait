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
