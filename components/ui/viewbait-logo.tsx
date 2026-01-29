"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * ViewBaitLogo
 * Reusable application logo (matches app/icon.svg). Uses primary color gradient
 * and respects light/dark theme via CSS variables.
 */
export function ViewBaitLogo({ className }: { className?: string }) {
  const gradientId = React.useId().replace(/:/g, "-");

  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn(className)}
      aria-hidden
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="2"
          y1="2"
          x2="22"
          y2="22"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="var(--chart-2)" />
          <stop offset="100%" stopColor="var(--primary)" />
        </linearGradient>
      </defs>
      <path
        d="M 10 3 H 8 C 5.23858 3 3 5.23858 3 8 V 16 C 3 18.7614 5.23858 21 8 21 H 16 C 18.7614 21 21 18.7614 21 16 V 8 C 21 5.23858 18.7614 3 16 3 H 15"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 3 13 L 8.5 8.5 L 12 12 L 15.5 9.5 L 21 14.5"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
