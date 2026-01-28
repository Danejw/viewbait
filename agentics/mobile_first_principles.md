# Mobile-First Design Principles

This document defines the core design principles for UI generation. All interfaces must be built mobile-first, ensuring optimal experience on small screens before scaling up to larger viewports.

## Core Philosophy

### Mobile-First, Always
Every component, layout, and interaction must be designed for mobile devices as the primary target. Desktop and tablet experiences are progressive enhancements, not the baseline.

## Layout Principles

### Viewport and Responsiveness

- Default to single-column layouts on mobile
- Use relative units (%, rem, vh, vw) instead of fixed pixels
- Set viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1">`
- Design for 320px minimum width as the baseline
- Test at common breakpoints: 320px, 375px, 414px, 768px, 1024px, 1440px

### Breakpoint Strategy

- **Mobile (default):** 0px - 639px
- **Tablet:** 640px - 1023px
- **Desktop:** 1024px+

Always write base styles for mobile, then use min-width media queries to enhance for larger screens:

```css
/* Mobile styles (default) */
.container {
  padding: 1rem;
  flex-direction: column;
}

/* Tablet and up */
@media (min-width: 640px) {
  .container {
    padding: 2rem;
    flex-direction: row;
  }
}
```

### Spacing and Sizing

- Use 8px grid system for consistency (8, 16, 24, 32, 40, 48...)
- Minimum touch target size: 44x44px (Apple) or 48x48px (Material Design)
- Generous padding around interactive elements (minimum 12px)
- Content margins: 16px minimum on mobile, scale up on larger screens

## Touch-First Interactions

### Touch Targets

- All buttons, links, and interactive elements must be at least 44x44px
- Space interactive elements at least 8px apart to prevent mis-taps
- Place primary actions within thumb reach (bottom half of screen)
- Avoid hover-dependent interactions; always provide tap alternatives

### Gestures

- Support native swipe gestures where appropriate
- Provide visual affordances indicating swipeable content
- Include fallback controls for all gesture-based interactions
- Avoid complex multi-finger gestures for essential functions

### Input Optimization

- Use appropriate input types (tel, email, number, date) for automatic keyboard optimization
- Implement autocomplete attributes for form fields
- Keep forms short; break long forms into steps
- Show inline validation with clear, helpful error messages
- Place labels above inputs, not beside them

## Typography

### Font Sizing

- Base font size: 16px minimum (prevents iOS zoom on focus)
- Body text: 16-18px on mobile, can increase on larger screens
- Headings scale proportionally using clamp() or fluid typography
- Line height: 1.5 for body text, 1.2-1.3 for headings
- Maximum line length: 65-75 characters for readability

### Hierarchy

```css
/* Fluid typography example */
h1 { font-size: clamp(1.75rem, 5vw, 3rem); }
h2 { font-size: clamp(1.5rem, 4vw, 2.25rem); }
h3 { font-size: clamp(1.25rem, 3vw, 1.75rem); }
body { font-size: clamp(1rem, 2.5vw, 1.125rem); }
```

## Navigation Patterns

### Mobile Navigation

- Use bottom navigation bar for primary navigation (3-5 items max)
- Hamburger menus for secondary navigation only
- Sticky headers should be minimal height (56-64px max)
- Provide clear back navigation and breadcrumbs for deep hierarchies

### Navigation Hierarchy

- **Primary Actions:** Bottom navigation bar
- **Secondary Actions:** Header icons or hamburger menu
- **Contextual Actions:** Floating action button (FAB) or inline

### Scroll Behavior

- Prefer vertical scrolling; horizontal scroll only for carousels/galleries
- Implement infinite scroll or "load more" for long lists
- Show scroll progress indicators for long content
- Hide/minimize headers on scroll down, reveal on scroll up

## Component Guidelines

### Buttons

- Full-width buttons on mobile for primary actions
- Minimum height: 48px
- Clear visual states: default, pressed, disabled, loading
- Use loading spinners for async actions
- Place primary action buttons at bottom of screen

### Cards

- Single column card layouts on mobile
- Consistent border-radius (8-12px recommended)
- Subtle shadows for depth (avoid heavy shadows on mobile)
- Tap entire card for primary action when appropriate

### Modals and Overlays

- Full-screen modals on mobile (bottom sheets preferred)
- Easy dismiss: tap outside, swipe down, or clear close button
- Trap focus within modal for accessibility
- Animate from bottom or fade in

### Forms

- One field per row on mobile
- Large, clear input fields (minimum 48px height)
- Floating labels or top-aligned labels
- Progress indicators for multi-step forms
- Smart defaults and autofill support

### Lists

- Adequate row height (minimum 48px for interactive rows)
- Clear visual separation between items
- Swipe actions for common operations (delete, archive)
- Pull-to-refresh for dynamic content

## Performance Requirements

### Loading

- Target < 3 second initial load on 3G
- Implement skeleton screens instead of spinners for content
- Lazy load images and below-fold content
- Prioritize above-fold content loading

### Images

- Use responsive images with srcset and sizes attributes
- Serve WebP/AVIF with fallbacks
- Lazy load images below the fold
- Provide appropriate aspect ratios to prevent layout shift

### Optimization

- Minimize JavaScript bundle size
- Use CSS containment for complex components
- Debounce scroll and resize handlers
- Avoid layout thrashing

## Accessibility

### Requirements

- Minimum color contrast ratio: 4.5:1 for normal text, 3:1 for large text
- Support dynamic type/font scaling up to 200%
- All interactive elements keyboard accessible
- Proper focus indicators (visible, not just outline: none)
- Semantic HTML structure
- ARIA labels for non-text content

### Screen Reader Support

- Logical heading hierarchy (h1 > h2 > h3)
- Alt text for all meaningful images
- Form labels associated with inputs
- Live regions for dynamic content updates
- Skip links for repetitive navigation

## Dark Mode

### Implementation

- Support system preference detection: prefers-color-scheme
- Provide manual toggle option
- Use CSS custom properties for theme colors
- Test all UI states in both modes

### Color Guidelines

- Dark mode is not just inverted colors
- Reduce pure white (#FFFFFF) to off-white (#E0E0E0) in dark mode
- Elevate surfaces with lighter shades rather than shadows
- Maintain sufficient contrast in both modes

## Design Tokens

Use consistent design tokens across all components:

```css
:root {
  /* Spacing */
  --space-xs: 0.25rem;   /* 4px */
  --space-sm: 0.5rem;    /* 8px */
  --space-md: 1rem;      /* 16px */
  --space-lg: 1.5rem;    /* 24px */
  --space-xl: 2rem;      /* 32px */
  --space-2xl: 3rem;     /* 48px */
  
  /* Border Radius */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
  
  /* Shadows (use sparingly on mobile) */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.1);
  
  /* Transitions */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;
  
  /* Z-Index Scale */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-modal: 300;
  --z-toast: 400;
}
```

## Checklist for UI Generation

Before finalizing any UI, verify:

- [ ] Renders correctly at 320px width
- [ ] All touch targets are at least 44x44px
- [ ] Text is readable without zooming (16px+ base)
- [ ] Forms use appropriate input types
- [ ] Navigation is thumb-reachable
- [ ] Images are responsive and optimized
- [ ] Color contrast meets WCAG AA standards
- [ ] Works with system dark mode preference
- [ ] No horizontal scroll on mobile
- [ ] Loading states are implemented
- [ ] Focus states are visible and logical

## Anti-Patterns to Avoid

- Fixed widths that cause horizontal scroll
- Hover-only interactions with no touch alternative
- Tiny touch targets or closely spaced interactive elements
- Desktop-first media queries (max-width instead of min-width)
- Relying on :hover for essential information
- Blocking pinch-to-zoom (user-scalable=no)
- Auto-playing videos with sound
- Fixed position elements that cover content
- Excessive animations that drain battery
- Large unoptimized images

## Summary

When generating UI, always start with the mobile experience. Build the simplest, most focused version first, then enhance progressively for larger screens. Every pixel, interaction, and animation should be intentional and serve the user's goals on a small, touch-based device.
