"use client";

import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export interface LenisScrollValue {
  scrollY: number;
}

const LenisScrollContext = createContext<LenisScrollValue | null>(null);

/**
 * Returns current scroll position when used inside LenisRoot. Otherwise returns null
 * (consumers can use scrollY ?? 0).
 */
export function useLenisScroll(): LenisScrollValue | null {
  return useContext(LenisScrollContext);
}

type LenisRootProps = {
  children: (scrollY: number) => ReactNode;
};

/**
 * Wrapper for optional Lenis smooth-scroll. Renders children with scroll position
 * and provides useLenisScroll() for nested components (e.g. LandingNav).
 */
export function LenisRoot({ children }: LenisRootProps) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY ?? 0);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const value: LenisScrollValue = { scrollY };

  return (
    <LenisScrollContext.Provider value={value}>
      {children(scrollY)}
    </LenisScrollContext.Provider>
  );
}
