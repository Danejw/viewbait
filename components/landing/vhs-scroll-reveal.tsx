"use client";

import { useEffect, useState } from "react";
import { useLenisScroll } from "@/components/landing/lenis-root";

export interface VHSScrollRevealProps {
  /** When false, overlay is not rendered (default true). */
  enabled?: boolean;
  /** When true, line position repeats per viewport (scrollY % innerHeight). Default false = first viewport only. */
  repeatPerViewport?: boolean;
}

/**
 * VHS/CRT-style overlay whose vertical position is driven by scroll.
 * A horizontal "static band" moves down as the user scrolls down (revealing content)
 * and up as they scroll up (hiding content). Content above the line is visible;
 * content below the line is covered by the static overlay.
 * Must be rendered inside LenisRoot.
 */
export function VHSScrollReveal({
  enabled = true,
  repeatPerViewport = false,
}: VHSScrollRevealProps) {
  const lenisScroll = useLenisScroll();
  const scrollY = lenisScroll?.scrollY ?? 0;

  const [innerHeight, setInnerHeight] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const updateHeight = () => setInnerHeight(window.innerHeight);
    updateHeight();
    window.addEventListener("resize", updateHeight);

    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handleChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", handleChange);

    return () => {
      window.removeEventListener("resize", updateHeight);
      mq.removeEventListener("change", handleChange);
    };
  }, []);

  if (!enabled || reducedMotion || innerHeight <= 0) {
    return null;
  }

  const lineY = repeatPerViewport
    ? scrollY % innerHeight
    : Math.min(scrollY, innerHeight);

  return (
    <div
      className="vhs-scroll-reveal-overlay"
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9993,
        pointerEvents: "none",
        clipPath: `inset(${lineY}px 0 0 0)`,
      }}
    >
      <div className="vhs-scroll-reveal-noise" />
      <div className="vhs-scroll-reveal-band" />
    </div>
  );
}
