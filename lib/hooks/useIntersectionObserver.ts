"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Custom hook for Intersection Observer API
 * 
 * Detects when an element enters the viewport and triggers lazy loading.
 * Optimized for performance with configurable root margin.
 * 
 * @param options - Intersection Observer options
 * @returns [ref, isIntersecting] - Ref to attach to element and intersection state
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLDivElement>, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Default options: start loading 100px before element enters viewport
    const observerOptions: IntersectionObserverInit = {
      root: options.root || null,
      rootMargin: options.rootMargin || "100px",
      threshold: options.threshold || 0,
      ...options,
    };

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsIntersecting(true);
        // Once intersected, we can disconnect to improve performance
        observer.disconnect();
      }
    }, observerOptions);

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [options.root, options.rootMargin, options.threshold]);

  return [ref, isIntersecting];
}
