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
    const windowWidth = window.innerWidth;
    const elementTop = rect.top;
    const elementHeight = rect.height;
    const elementCenter = elementTop + elementHeight / 2;

    // Calculate viewport boundaries with margin
    const viewportTop = -100; // Start animating 100px before entering
    const viewportBottom = windowHeight + 100; // Continue animating 100px after exiting
    
    // Check if element is in the animation range
    const isInRange = 
      elementCenter > viewportTop && 
      elementCenter < viewportBottom;

    if (isInRange) {
      setIsVisible(true);
      
      // Calculate smooth progress based on element's position relative to viewport
      // Progress: 0 when element is entering/exiting, 1 when centered
      const viewportCenter = windowHeight / 2;
      const distanceFromCenter = elementCenter - viewportCenter;
      const maxDistance = windowHeight / 2 + 300; // Extended range for smoother transitions
      
      // Calculate raw progress (0 to 1) based on distance from center
      let rawProgress = 1 - Math.min(Math.abs(distanceFromCenter) / maxDistance, 1);
      
      // Apply smooth easing curve for more natural motion
      // Use ease-out cubic for smooth deceleration
      rawProgress = rawProgress < 0 ? 0 : rawProgress;
      const easedProgress = 1 - Math.pow(1 - rawProgress, 3);
      
      // Clamp between 0 and 1
      const calculatedProgress = Math.max(0, Math.min(1, easedProgress));
      
      setProgress(calculatedProgress);
    } else {
      // Element is outside viewport - animate out
      setIsVisible(false);
      setProgress(0);
    }
  }, [threshold, enabled]);

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
