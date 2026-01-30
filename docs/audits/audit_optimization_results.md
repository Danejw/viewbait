# Client-Side Loading Performance & Responsiveness Optimization Audit

**Date:** Thursday, January 29, 2025

---

## Quick Reference Table

| # | Status | Impact | Issue | Effect % | Link to Section |
|---|--------|--------|-------|----------|-----------------|
| 1 | Open | High | No route-level loading UI (loading.tsx or Suspense) | 15–25% perceived load | [§1](#1-no-route-level-loading-ui) |
| 2 | Open | High | Landing hero image missing `priority` (LCP) | 10–20% LCP | [§2](#2-landing-hero-image-missing-priority) |
| 3 | Open | High | Studio route eager-loads entire studio bundle | 20–30% TTI for /studio | [§3](#3-studio-route-eager-loads-entire-bundle) |
| 4 | Open | Medium | Landing page is one large client component (~1600 lines) | 15–25% FCP/JS | [§4](#4-landing-page-monolithic-client-component) |
| 5 | Open | Medium | Four fonts loaded in root layout; no font-display | 5–15% FCP/CLS | [§5](#5-font-loading-in-root-layout) |
| 6 | Open | Medium | useIsMobile causes layout shift (undefined → boolean) | 5–10% CLS | [§6](#6-useismobile-layout-shift) |
| 7 | Open | Medium | No prefetch for critical navigation (e.g. Start Creating) | 5–15% navigation | [§7](#7-prefetch-for-critical-navigation) |
| 8 | Open | Low | Lenis loaded synchronously on landing | 5–10% landing FCP | [§8](#8-lenis-loaded-synchronously-on-landing) |
| 9 | Open | Low | Landing typewriter/word intervals run every 50ms/2.5s | 2–5% main thread | [§9](#9-landing-intervals-and-animation-timers) |

---

## Overview

The client-side codebase has solid foundations: React Query with sensible `staleTime`, skeleton components for gallery/styles/palettes, `content-visibility` and priority on first grid items in studio, and Next.js `Image` with `sizes` on the landing page. The main opportunities are **route-level loading feedback** (no `loading.tsx` or Suspense boundaries), **LCP on the landing hero image** (missing `priority`), **studio route bundle size** (entire studio tree loaded on first visit to `/studio`), and **landing page size** (single large client component). Secondary improvements include font loading strategy, `useIsMobile` layout shift, prefetch for primary navigation, and optional dynamic import of Lenis and throttling of landing animation timers. This document outlines an optimization plan and provides actionable prompts for an AI coding agent.

---

## Optimization Plan

### Strategy 1: Improve perceived load and LCP

- Add route-level loading UI so users see skeletons or spinners instead of a blank screen.
- Mark the landing hero image as LCP with `priority` and ensure `sizes` is appropriate.
- Optionally add `fetchPriority="high"` for the hero image (Next.js 14+).

### Strategy 2: Reduce JavaScript and defer non-critical code

- Lazy-load the studio route: use `next/dynamic` to load the studio page shell (or main content) so the studio bundle is split and loaded when the user navigates to `/studio`.
- Split the landing page: keep hero and nav as critical path; dynamic-import Lenis, ScrollReveal, or below-fold sections so the initial bundle is smaller.
- Dynamic-import Lenis on the landing page so it is not in the initial chunk.

### Strategy 3: Reduce layout shift and improve responsiveness

- Make `useIsMobile` SSR-safe or default to a stable value (e.g. `false`) so the first paint does not jump when the real value is set in `useEffect`.
- Use CSS `font-display: optional` (or `swap`) for Google fonts to reduce CLS and improve FCP.
- Ensure interactive elements have clear focus and loading states (keyboard/ARIA) where applicable.

### Strategy 4: Prefetch and cache

- Prefetch `/studio` (or `/auth`) on hover/focus of the primary CTA so navigation feels instant.
- Rely on existing React Query caching; optionally prefetch subscription or thumbnails when the user hovers over the studio link (if within app).

### Strategy 5: Throttle and reduce main-thread work

- Replace or throttle the landing typewriter (50ms) and word rotation (2.5s) if they cause long tasks; consider `requestAnimationFrame` or longer intervals for the typewriter.

---

## Detailed Findings and Implementation Prompts

---

### 1. No route-level loading UI {#1-no-route-level-loading-ui}

**Impact:** High — Users see a blank or frozen screen until the route’s client bundle and data are ready.

**Current state:** There is no `app/loading.tsx` or `app/studio/loading.tsx`. The root layout does not wrap children in a Suspense boundary with a fallback. Navigation to `/` or `/studio` can show nothing until the page component and its dependencies have loaded and rendered.

**Goal state:** Add `app/loading.tsx` (and optionally `app/studio/loading.tsx`) that export a default component rendering a minimal loading UI (e.g. branded skeleton or spinner). Optionally wrap the root layout’s `children` in `<Suspense fallback={…}>` so nested async or lazy content shows a fallback. Users should always see a loading state instead of a blank screen during route transitions.

**Unit test:** Render the loading component (or the Suspense fallback used in layout); assert it renders without throwing and that it contains at least one visible element (e.g. a role="status" or a test id). If the loading UI is a skeleton, assert it has appropriate aria attributes for accessibility.

**Implementation prompt:**

```
Add route-level loading UI for the app. Create viewbait/app/loading.tsx that exports a default component rendering a minimal loading state (e.g. a centered spinner or a simple skeleton matching the app shell). The component should be a server component by default (no "use client") and should include a role="status" and aria-live="polite" (or similar) for accessibility. Optionally create viewbait/app/studio/loading.tsx with a loading state that matches the studio layout (e.g. sidebar skeleton + main area skeleton). Ensure that when navigating to / or /studio, Next.js shows this loading UI during the transition instead of a blank screen. Do not change the existing page components' logic; only add the loading files and, if needed, a Suspense boundary in the root layout with the same fallback for consistency.
```

---

### 2. Landing hero image missing `priority` {#2-landing-hero-image-missing-priority}

**Impact:** High — The hero image is the largest visible element on the landing page; without `priority` it may load after other resources and hurt LCP.

**Current state:** In `viewbait/app/page.tsx`, the hero image is rendered with `<Image src={HERO_THUMBNAIL_SRC} alt="..." fill sizes="(max-width: 768px) 100vw, 560px" className="object-cover" onError={...} />`. It does not set `priority`.

**Goal state:** Add `priority` to the hero Image so Next.js preloads it and the browser can treat it as LCP. Keep existing `sizes`, `fill`, and `onError`. Optionally add `fetchPriority="high"` if the Next.js version supports it.

**Unit test:** In a test or snapshot, assert that the hero Image component receives `priority={true}` (or that the rendered link/img has the expected preload or fetchpriority behavior). If testing the DOM, check for a preload link or high-priority image load.

**Implementation prompt:**

```
In viewbait/app/page.tsx, add the priority prop to the hero Image component (the one with src={HERO_THUMBNAIL_SRC} and alt="ViewBait thumbnail preview"). Set priority={true} so Next.js preloads this image and the browser can optimize it as the LCP element. Do not remove or change fill, sizes, className, or onError. If the project uses Next.js 14+ and supports fetchPriority on Image, add fetchPriority="high" for the same image.
```

---

### 3. Studio route eager-loads entire bundle {#3-studio-route-eager-loads-entire-bundle}

**Impact:** High — The first visit to `/studio` loads the full studio barrel (provider, frame, sidebar, generator, results, views, DnD, etc.) in one chunk, delaying TTI.

**Current state:** `viewbait/app/studio/page.tsx` imports from `@/components/studio` and `@/components/studio/studio-dnd-context` directly. All studio components are in the same chunk as the studio page.

**Goal state:** Use `next/dynamic` to load the studio shell (e.g. StudioProvider + StudioDndContext + StudioPageContent) with `ssr: false` or `ssr: true` and a `loading` fallback that matches `app/studio/loading.tsx` (or a simple skeleton). The studio bundle should be a separate chunk that loads when the user navigates to `/studio`. The initial route response should show the loading fallback until the dynamic component is ready.

**Unit test:** Build the app and assert that the studio page (or the dynamic wrapper) is in a separate chunk (e.g. by checking build output for a chunk name containing "studio" or by verifying that the main page chunk does not include studio-provider). Alternatively, in a test, render the studio page and assert that the loading fallback is shown initially (if using a dynamic wrapper with loading state).

**Implementation prompt:**

```
Refactor viewbait/app/studio/page.tsx to load the studio UI with next/dynamic. Create a dynamic import for the component tree that includes StudioProvider, StudioDndContext, and StudioPageContent (or a single wrapper component that renders them). Use dynamic(..., { loading: () => <StudioLoadingFallback />, ssr: true }) so that the studio bundle is code-split and the user sees a loading fallback until the chunk is loaded. Define StudioLoadingFallback inline or in a small file to show a skeleton that matches the studio layout (sidebar + main area). Ensure the studio page still renders correctly after the dynamic component loads; do not change StudioProvider, StudioDndContext, or StudioPageContent behavior.
```

---

### 4. Landing page monolithic client component {#4-landing-page-monolithic-client-component}

**Impact:** Medium — A single ~1600-line client component increases the initial JS payload and parse/compile cost for the landing route.

**Current state:** `viewbait/app/page.tsx` is a single "use client" component that includes hero, bento sections, LenisRoot, ScrollReveal, nav, footer, and many inline styles and state (mouse, word rotation, typewriter, image errors).

**Goal state:** Split the landing page so that the critical path (hero, primary CTA, nav) is as small as possible. Below-the-fold sections (e.g. bento, footer) or heavy dependencies (LenisRoot, ScrollReveal) can be wrapped in `next/dynamic` with a loading fallback, or moved into separate client components that are lazy-loaded when they enter the viewport (e.g. with an intersection observer). The goal is a smaller initial bundle and faster FCP without changing the visual design or behavior.

**Unit test:** After refactor, assert that the landing page still renders the hero and primary CTA. Optionally assert that a dynamic chunk (e.g. Lenis or a section) is loaded only when needed (e.g. by checking that the component tree includes a dynamic wrapper or lazy component).

**Implementation prompt:**

```
Split the landing page (viewbait/app/page.tsx) to reduce the initial client bundle. Keep the hero section, LandingNav, and the primary "Start Creating" CTA in the main page component. Move below-the-fold content (e.g. bento grid, style templates, face expressions, footer) into one or more separate client components. Load these sections via next/dynamic with a loading fallback (e.g. minimal skeleton or null) so they are in separate chunks. Optionally load LenisRoot with dynamic(..., { ssr: false }) so Lenis is not in the initial chunk. Preserve all existing behavior, styles, and accessibility. Do not change the visual layout or copy; only change how and when chunks are loaded.
```

---

### 5. Font loading in root layout {#5-font-loading-in-root-layout}

**Impact:** Medium — Multiple Google fonts (Inter, Geist, Geist_Mono, Space_Mono) can block rendering or cause CLS if not optimized.

**Current state:** `viewbait/app/layout.tsx` imports and configures four fonts from `next/font/google` (Inter, Geist, Geist_Mono, Space_Mono) and applies their CSS variables to the body. There is no explicit `display` option.

**Goal state:** Add `display: 'optional'` (or `'swap'`) to each font in `next/font/google` so the browser can render text sooner and avoid invisible text or layout shift. If some fonts are only used on specific routes (e.g. Space_Mono only on landing), consider moving those to the route that needs them so the root layout has fewer fonts.

**Unit test:** Assert that the layout still renders and that font variables are applied (e.g. by checking that the document or body has the expected class names or CSS variables). Optionally verify in a test that the font config includes `display: 'optional'` or `'swap'`.

**Implementation prompt:**

```
In viewbait/app/layout.tsx, add display: 'optional' (or 'swap') to the configuration of each next/font/google font (Inter, Geist, Geist_Mono, Space_Mono). Use the Next.js font API option that sets font-display (e.g. display: 'optional') so that text is visible sooner and CLS is reduced. If a font is only used on the landing page, consider moving that font import to the landing page or a layout that wraps only the landing route so the root layout has fewer fonts. Do not remove any font; only add display and optionally relocate one font to reduce root layout cost.
```

---

### 6. useIsMobile layout shift {#6-useismobile-layout-shift}

**Impact:** Medium — `useIsMobile()` returns `undefined` on the first render (or is coerced to false), then updates after `useEffect` runs, which can cause a layout jump (e.g. sidebar visible then hidden, or vice versa).

**Current state:** `viewbait/hooks/use-mobile.ts` (or `useIsMobile`) initializes state as `undefined` and sets it in `useEffect` with `window.matchMedia` and `window.innerWidth`. The return is `!!isMobile`, so the first render gets `false`. If the actual value is `true`, the second render flips to `true` and layout can change (e.g. studio sidebar vs mobile nav).

**Goal state:** Provide a stable first paint: either (1) default to `false` and accept a brief moment where desktop layout is shown on mobile, or (2) use a media query in CSS and pass a class so layout is correct from first paint without JS. Optionally use a server-safe default (e.g. from headers or a cookie) so SSR and first client render match. Document that the hook may cause one layout update on mount for mobile users.

**Unit test:** Render a component that uses `useIsMobile` and assert that the first render does not throw and that the value is boolean (either `true` or `false`). If the hook is changed to return a constant default on first render, assert that default. Optionally simulate `matchMedia` and assert the value updates after the effect runs.

**Implementation prompt:**

```
In viewbait/hooks/use-mobile.ts, stabilize the initial value of useIsMobile to avoid layout shift. Change the initial state from undefined to false (so the first render always returns false and desktop layout is shown first). Document in a comment that on mobile the layout may switch to mobile layout after the first effect run, and that this is preferred over showing undefined or a flash of wrong layout. Alternatively, if the app supports it, use a CSS media query and a data attribute or class on the root so that mobile vs desktop layout is determined by CSS and the hook is only used for optional behavior (e.g. closing a drawer). Do not remove the hook; ensure it still updates when the viewport crosses the breakpoint (768px).
```

---

### 7. Prefetch for critical navigation {#7-prefetch-for-critical-navigation}

**Impact:** Medium — Prefetching the studio (or auth) route when the user hovers/focuses the primary CTA makes navigation feel instant.

**Current state:** The landing page uses `<Link href={studioOrAuthHref}>` for "Start Creating". Next.js prefetches Link targets by default when they enter the viewport; there is no explicit prefetch on hover or focus.

**Goal state:** Ensure the studio (and auth) route is prefetched when the user hovers over or focuses the "Start Creating" link (e.g. with `prefetch={true}` if not already default, or by calling `router.prefetch('/studio')` on mouseEnter/focus). Optionally prefetch on link mount so that by the time the user clicks, the chunk is ready.

**Unit test:** In a test, render the landing page (or the Link), simulate mouseEnter or focus on the "Start Creating" link, and assert that prefetch was called (e.g. by mocking `router.prefetch` or checking that the link has the expected prefetch behavior). Alternatively, in an E2E test, hover the CTA and then navigate and assert that the studio page loads without a long loading state.

**Implementation prompt:**

```
Add explicit prefetch for the critical navigation target (studio or auth) on the landing page. In viewbait/app/page.tsx, for the "Start Creating" Link that points to studioOrAuthHref, ensure prefetch is enabled (prefetch={true} if not default). On mouseEnter and onFocus of that link, call the Next.js router's prefetch method for the target path (e.g. useRouter().prefetch('/studio') or prefetch(studioOrAuthHref)) so that the studio (or auth) route chunk is requested as soon as the user shows intent. Use the Next.js App Router API (e.g. useRouter from next/navigation). Do not change the link href or visibility; only add prefetch-on-hover/focus to improve perceived navigation speed.
```

---

### 8. Lenis loaded synchronously on landing {#8-lenis-loaded-synchronously-on-landing}

**Impact:** Low — Lenis is used only on the landing page; including it in the main landing chunk increases that chunk’s size and parse time.

**Current state:** `viewbait/app/page.tsx` imports `LenisRoot` from `@/components/landing/lenis-root`, which imports `Lenis` from `lenis` and runs in the same chunk as the landing page.

**Goal state:** Load Lenis (and LenisRoot) with `next/dynamic` so the Lenis library is in a separate chunk that loads after the critical landing content. The landing page can show a non-Lenis scroll initially, then switch to Lenis when the dynamic component is ready, or wrap only the scroll-dependent content in the dynamic LenisRoot.

**Unit test:** After refactor, assert that the landing page still renders and that scroll behavior still works (e.g. Lenis is initialized when the dynamic component mounts). Optionally assert that the main landing chunk does not include the `lenis` package (e.g. by inspecting the build output).

**Implementation prompt:**

```
Load LenisRoot asynchronously on the landing page so the Lenis library is not in the initial bundle. In viewbait/app/page.tsx, replace the direct import of LenisRoot with next/dynamic: const LenisRoot = dynamic(() => import('@/components/landing/lenis-root').then(m => ({ default: m.LenisRoot })), { ssr: false, loading: () => null }). Wrap the existing children that depend on scroll (the render prop (scrollY) => (...)) in the dynamic LenisRoot so that after the chunk loads, Lenis is used; before that, the page can render without Lenis (or with a simple fallback that does not use scrollY). Preserve the existing LenisRoot API (children as function of scrollY). Do not change viewbait/components/landing/lenis-root.tsx except if needed for default export.
```

---

### 9. Landing intervals and animation timers {#9-landing-intervals-and-animation-timers}

**Impact:** Low — The typewriter runs every 50ms and the word rotation every 2.5s; on low-end devices this can add to main-thread work.

**Current state:** In `viewbait/app/page.tsx`, `useEffect` sets up `setInterval` for word rotation (2500ms) and a typewriter (50ms) that update state on every tick, causing re-renders.

**Goal state:** Reduce frequency or use `requestAnimationFrame` for the typewriter so updates are aligned with frames. Optionally increase the typewriter interval (e.g. 80–100ms) to reduce re-renders while keeping the animation readable. Ensure cleanup of intervals and RAF in the effect return.

**Unit test:** Render the landing page (or a component that uses the same interval logic), advance timers with jest.useFakeTimers(), and assert that the displayed word and typewriter text update as expected and that cleanup is called on unmount (e.g. no updates after unmount).

**Implementation prompt:**

```
In viewbait/app/page.tsx, reduce main-thread work from the landing animation intervals. For the typewriter effect that updates generatingText every 50ms, either (1) increase the interval to 80–100ms so fewer state updates occur, or (2) use requestAnimationFrame to update the text once per frame and cancel the RAF in the effect cleanup. For the word rotation (HERO_WORDS) keep the 2500ms interval. Ensure both effects clean up on unmount (clearInterval and cancelAnimationFrame). Do not change the visual outcome (words and typewriter text); only change the timing or the update mechanism to reduce CPU usage.
```

---

## Summary

| Priority | Action |
|----------|--------|
| 1 | Add `app/loading.tsx` (and optionally `app/studio/loading.tsx`) and use Suspense where appropriate. |
| 2 | Add `priority` to the landing hero Image. |
| 3 | Code-split the studio route with `next/dynamic` and a loading fallback. |
| 4 | Split the landing page into smaller chunks (dynamic sections and/or Lenis). |
| 5 | Set `display: 'optional'` (or `'swap'`) on root layout fonts. |
| 6 | Stabilize `useIsMobile` initial value to reduce CLS. |
| 7 | Prefetch studio/auth on hover/focus of the primary CTA. |
| 8 | Dynamic-import LenisRoot on the landing page. |
| 9 | Throttle or RAF the landing typewriter and ensure interval cleanup. |

Implementing these in order will improve perceived load, LCP, TTI, and responsiveness with minimal risk to existing behavior.
