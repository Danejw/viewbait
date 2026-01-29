"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  type ReactNode,
} from "react";
import Lenis from "lenis";

/** Scroll position context provided by LenisRoot for nav and scroll-based UI */
interface LenisScrollContextValue {
  scrollY: number;
}

const LenisScrollContext = createContext<LenisScrollContextValue | null>(null);

/**
 * Returns scrollY from Lenis when inside LenisRoot; otherwise undefined.
 * Landing page should use this when present, else fall back to native scrollY.
 */
export function useLenisScroll(): LenisScrollContextValue | null {
  return useContext(LenisScrollContext);
}

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

interface LenisRootProps {
  /** Content to render; can be a function receiving scrollY for nav/UI. */
  children: ReactNode | ((scrollY: number) => ReactNode);
}

/**
 * Root-page-only Lenis wrapper. Initializes Lenis on mount, sets window.__lenis
 * for useScrollAnimation, provides scrollY via context and render prop, and cleans up on unmount.
 * Used only in app/page.tsx so /studio and other routes keep native scroll.
 */
export function LenisRoot({ children }: LenisRootProps) {
  const [scrollY, setScrollY] = useState(0);
  const optionsRef = useRef({
    duration: 1.2,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    touchMultiplier: 2,
    infinite: false,
    anchors: true,
    syncTouch: false,
  });

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const lenis = new Lenis({
      autoRaf: true,
      duration: prefersReducedMotion ? 0 : optionsRef.current.duration,
      easing: optionsRef.current.easing,
      touchMultiplier: optionsRef.current.touchMultiplier,
      infinite: optionsRef.current.infinite,
      anchors: optionsRef.current.anchors,
      syncTouch: optionsRef.current.syncTouch,
    });

    (window as Window).__lenis = lenis;
    document.documentElement.classList.add("lenis");

    const handleScroll = () => {
      setScrollY(lenis.scroll);
    };

    lenis.on("scroll", handleScroll);
    handleScroll();

    return () => {
      lenis.off("scroll", handleScroll);
      lenis.destroy();
      delete (window as Window).__lenis;
      document.documentElement.classList.remove("lenis");
    };
  }, []);

  const value = { scrollY };
  const content =
    typeof children === "function" ? children(scrollY) : children;

  return (
    <LenisScrollContext.Provider value={value}>
      {content}
    </LenisScrollContext.Provider>
  );
}
