"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseScrollAnimationOptions {
  threshold?: number;
  rootMargin?: string;
  enabled?: boolean;
}

/**
 * Custom hook for scroll-based animations using Lenis scroll position
 * 
 * Integrates with Lenis smooth scroll to calculate animation progress based on
 * scroll position. Falls back to native scroll on mobile/touch devices.
 * 
 * @param options - Intersection Observer and animation options
 * @returns [ref, progress, isVisible] - Ref to attach, animation progress (0-1), and visibility state
 */
export function useScrollAnimation(
  options: UseScrollAnimationOptions = {}
): [React.RefObject<HTMLDivElement>, number, boolean] {
  const { threshold = 0.1, rootMargin = "0px", enabled = true } = options;
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);

  const calculateProgress = useCallback(() => {
    if (!ref.current || !enabled) return;

    const element = ref.current;
    const rect = element.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const elementTop = rect.top;

    // Entry-based progress: fade in as the section *enters* the viewport from below,
    // so there's no band of blank black. Progress = 1 when section top reaches upper viewport.
    const startFadeAt = windowHeight + 200; // Start fading in 200px before section top enters
    const fullOpacityAt = windowHeight * 0.25; // Full opacity when section top is 25% from top
    const visibleRange = startFadeAt - fullOpacityAt; // Scroll distance over which we go 0 -> 1

    if (elementTop <= startFadeAt) {
      setIsVisible(true);
      // Linear progress over the range, then ease for smoother feel
      let rawProgress = (startFadeAt - elementTop) / visibleRange;
      rawProgress = Math.max(0, Math.min(1, rawProgress));
      const easedProgress = 1 - Math.pow(1 - rawProgress, 2); // Ease-out quad: smooth deceleration at full opacity
      setProgress(easedProgress);
    } else {
      setIsVisible(false);
      setProgress(0);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const element = ref.current;
    if (!element) return;

    // Set up Intersection Observer for initial detection
    const observerOptions: IntersectionObserverInit = {
      root: null,
      rootMargin,
      threshold: [0, threshold, 0.5, 1],
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
      }
    }, observerOptions);

    observer.observe(element);

    // Set up scroll listener
    const handleScroll = () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
      rafId.current = requestAnimationFrame(calculateProgress);
    };

    // Use Lenis scroll event if available, otherwise use native scroll
    // @ts-expect-error - Lenis may be on window
    const lenis = window.__lenis;
    
    let scrollHandler: (() => void) | null = null;
    
    if (lenis) {
      // Try to use Lenis scroll event
      if (typeof lenis.on === 'function') {
        lenis.on('scroll', handleScroll);
        scrollHandler = handleScroll;
      } else {
        // Lenis exists but doesn't have on method, use native scroll
        window.addEventListener('scroll', handleScroll, { passive: true });
        scrollHandler = handleScroll;
      }
    } else {
      // Fallback to native scroll
      window.addEventListener('scroll', handleScroll, { passive: true });
      scrollHandler = handleScroll;
    }

    // Initial calculation
    calculateProgress();

    return () => {
      observer.disconnect();
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
      }
      if (scrollHandler) {
        // @ts-expect-error - Lenis may be on window
        const currentLenis = window.__lenis;
        if (currentLenis && typeof currentLenis.off === 'function') {
          currentLenis.off('scroll', scrollHandler);
        } else {
          window.removeEventListener('scroll', scrollHandler);
        }
      }
    };
  }, [calculateProgress, rootMargin, threshold, enabled]);

  return [ref, progress, isVisible];
}
