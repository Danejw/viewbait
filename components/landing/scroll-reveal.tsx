"use client";

import type { ReactNode } from "react";
import { useScrollAnimation } from "@/lib/hooks/useScrollAnimation";

export interface ScrollRevealProps {
  children: ReactNode;
  /** Vertical offset in px for translateY (default 24) */
  offsetY?: number;
  /** Optional className for the wrapper */
  className?: string;
  /** Optional inline style merged with animated style */
  style?: React.CSSProperties;
}

/**
 * Wraps content and animates it in as it approaches viewport center,
 * and out as it scrolls away. Uses useScrollAnimation (Lenis or native scroll).
 */
export function ScrollReveal({
  children,
  offsetY = 24,
  className,
  style,
}: ScrollRevealProps) {
  const [ref, progress] = useScrollAnimation({ enabled: true });

  const translateY = (1 - progress) * offsetY;
  const opacity = progress;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        willChange: "opacity, transform",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
