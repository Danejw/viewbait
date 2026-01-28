/**
 * useMediaQuery Hook
 * 
 * React hook that uses window.matchMedia to detect media query matches.
 * Only triggers re-renders when the media query match state changes,
 * not on every pixel change like window.innerWidth subscriptions.
 * 
 * @param query - CSS media query string (e.g., '(max-width: 767px)')
 * @returns boolean indicating if the media query matches
 * 
 * @example
 * ```tsx
 * const isMobile = useMediaQuery('(max-width: 767px)')
 * ```
 */

import { useState, useEffect } from 'react'

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    // Check if window is available (client-side only)
    if (typeof window === 'undefined') {
      return
    }

    const media = window.matchMedia(query)
    
    // Set initial value
    if (media.matches !== matches) {
      setMatches(media.matches)
    }
    
    // Create listener that only fires when match state changes
    const listener = (event: MediaQueryListEvent) => {
      setMatches(event.matches)
    }
    
    // Use addEventListener for better browser support
    if (media.addEventListener) {
      media.addEventListener('change', listener)
      return () => media.removeEventListener('change', listener)
    } else {
      // Fallback for older browsers
      media.addListener(listener)
      return () => media.removeListener(listener)
    }
  }, [query, matches])

  return matches
}
