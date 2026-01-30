"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * CRTLoadingEffect
 *
 * Reusable retro CRT static/noise loading effect for thumbnail generation
 * and other waiting states. Displays an old TV "no signal" aesthetic with
 * animated static, scanlines, interference bands, and glitch effects.
 */

export interface CRTLoadingEffectProps {
  /** Whether to show the progress bar below the effect (default: false) */
  showProgress?: boolean;
  /** Additional class names for the container */
  className?: string;
  /** Optional: override aspect ratio (default 16/9 is set in CSS) */
  style?: React.CSSProperties;
}

export function CRTLoadingEffect({
  showProgress = false,
  className,
  style,
}: CRTLoadingEffectProps) {
  return (
    <>
      <div
        className={cn("crt-loading-effect", className)}
        style={style}
        aria-hidden
      >
        <div className="crt-loading-static" />
        <div className="crt-loading-static" style={{ animationDelay: "0.15s", opacity: 0.1 }} />
        <div className="crt-loading-scanlines" />
        <div className="crt-loading-interference" />
        <div className="crt-loading-glitch-lines">
          <div className="crt-loading-glitch-line" />
          <div className="crt-loading-glitch-line" />
          <div className="crt-loading-glitch-line" />
        </div>
        <div className="crt-loading-rgb-shift" />
        <div className="crt-loading-screen-flicker" />
        <div className="crt-loading-vignette" />
        <div className="crt-loading-warp" />
      </div>
      {showProgress && (
        <div className="crt-loading-effect-progress">
          <div className="crt-loading-effect-progress-fill" />
        </div>
      )}
    </>
  );
}
