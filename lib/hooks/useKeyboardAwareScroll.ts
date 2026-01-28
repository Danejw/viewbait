"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Hook to handle keyboard-aware scrolling on mobile devices
 * 
 * Automatically scrolls focused inputs into view when the virtual keyboard appears.
 * Uses visualViewport API for precise keyboard detection and viewport adjustment.
 */
export function useKeyboardAwareScroll() {
  const viewportRef = useRef<VisualViewport | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);

  const scrollInputIntoView = useCallback((element: HTMLElement) => {
    if (!element) return;

    // Use scrollIntoView with smooth behavior and center block
    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest",
    });

    // If visualViewport API is available, use it for more precise positioning
    if (typeof window !== "undefined" && window.visualViewport) {
      const viewport = window.visualViewport;
      const rect = element.getBoundingClientRect();
      const viewportHeight = viewport.height;
      const viewportTop = viewport.offsetTop;

      // Calculate if input is above the visible viewport
      const inputTop = rect.top + viewportTop;
      const inputBottom = rect.bottom + viewportTop;

      // If input is below the viewport, scroll it into view
      if (inputBottom > viewportTop + viewportHeight) {
        const scrollAmount = inputBottom - (viewportTop + viewportHeight) + 20; // 20px padding
        window.scrollBy({
          top: scrollAmount,
          behavior: "smooth",
        });
      } else if (inputTop < viewportTop) {
        // If input is above the viewport, scroll it into view
        const scrollAmount = inputTop - viewportTop - 20; // 20px padding
        window.scrollBy({
          top: scrollAmount,
          behavior: "smooth",
        });
      }
    }
  }, []);

  useEffect(() => {
    // Set up visualViewport listener if available
    if (typeof window !== "undefined" && window.visualViewport) {
      viewportRef.current = window.visualViewport;

      const handleResize = () => {
        // When viewport resizes (keyboard appears/disappears), ensure focused input is visible
        const activeElement = document.activeElement as HTMLElement;
        if (
          activeElement &&
          (activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA")
        ) {
          // Small delay to allow keyboard animation to complete
          setTimeout(() => {
            scrollInputIntoView(activeElement);
          }, 100);
        }
      };

      resizeHandlerRef.current = handleResize;
      window.visualViewport.addEventListener("resize", handleResize);

      return () => {
        if (window.visualViewport && resizeHandlerRef.current) {
          window.visualViewport.removeEventListener(
            "resize",
            resizeHandlerRef.current
          );
        }
      };
    }
  }, [scrollInputIntoView]);

  return { scrollInputIntoView };
}
