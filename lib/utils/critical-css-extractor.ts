/**
 * Critical CSS Extractor Utility
 * 
 * This utility helps identify and extract critical CSS for above-the-fold content.
 * In production, this could be used with build-time tools to automatically extract
 * critical CSS, but for now we manually maintain the critical CSS in CriticalCSS component.
 * 
 * Future enhancement: Use a tool like `critters` or `next-critical` to automatically
 * extract critical CSS during build time.
 */

/**
 * Critical CSS selectors for above-the-fold content
 * These are the selectors that should be included in critical CSS
 */
export const CRITICAL_SELECTORS = [
  // Root variables
  ':root',
  '[data-theme="light"]',
  
  // Body and typography
  'body',
  '.font-display',
  '.text-gradient',
  
  // Layout utilities (critical for initial render)
  '.flex',
  '.flex-col',
  '.min-h-screen',
  '.bg-background',
  '.text-foreground',
  '.text-muted-foreground',
  '.text-primary',
  '.font-bold',
  '.text-center',
  '.mx-auto',
  '.max-w-6xl',
  '.max-w-2xl',
  '.px-6',
  '.py-20',
  '.mb-6',
  '.mb-8',
  '.text-4xl',
  '.leading-tight',
  
  // Responsive utilities (critical breakpoints)
  '@media (min-width: 768px)',
  '@media (min-width: 1024px)',
  
  // Selection styles
  '::selection',
  '::-moz-selection',
  
  // Gradient utilities
  '.gradient-primary',
];

/**
 * Non-critical CSS selectors (can be loaded asynchronously)
 * These include animations, below-the-fold styles, etc.
 */
export const NON_CRITICAL_SELECTORS = [
  // Animations
  '@keyframes',
  '.animate-',
  
  // Below-the-fold components
  '.gallery',
  '.footer',
  
  // Complex neumorphic styles (can load after initial render)
  '.neu-',
  
  // Scrollbar styles
  '*::-webkit-scrollbar',
  
  // Advanced utilities
  '.glass',
  '.shadow-',
];

/**
 * Check if a CSS selector is critical
 */
export function isCriticalSelector(selector: string): boolean {
  return CRITICAL_SELECTORS.some(critical => 
    selector.includes(critical) || 
    critical.includes(selector)
  );
}

/**
 * Check if a CSS selector is non-critical
 */
export function isNonCriticalSelector(selector: string): boolean {
  return NON_CRITICAL_SELECTORS.some(nonCritical => 
    selector.includes(nonCritical)
  );
}
