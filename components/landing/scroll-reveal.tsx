"use client";

import React, { type ReactNode } from "react";

type ScrollRevealProps = {
  children: ReactNode;
};

/**
 * Wrapper for scroll-triggered reveal. Renders children in place.
 * Replace with intersection-observer based reveal if needed.
 */
export function ScrollReveal({ children }: ScrollRevealProps) {
  return <>{children}</>;
}
