"use client";

import { useState, useEffect } from "react";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";

export interface LegalPageViewProps {
  /** Page title shown at the top (e.g. "Privacy Policy"). */
  title: string;
  /** Pre-rendered HTML from server (markdown converted on the server). Client only injects it for lower TBT. */
  contentHtml: string;
}

/**
 * Landing-styled legal page shell: CRT effects, nav, HTML body, footer.
 * Uses native scroll and throttled scrollY for nav (no Lenis) to reduce TBT.
 * Used by /legal/privacy and /legal/terms.
 */
export function LegalPageView({ title, contentHtml }: LegalPageViewProps) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let rafId: number | null = null;
    let lastY = 0;
    let lastSetTime = 0;
    const throttleMs = 100;

    const handleScroll = () => {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const y = typeof window !== "undefined" ? window.scrollY ?? document.documentElement.scrollTop : 0;
        const now = Date.now();
        if (now - lastSetTime >= throttleMs || Math.abs(y - lastY) > 80) {
          lastY = y;
          lastSetTime = now;
          setScrollY(y);
        }
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafId != null) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      className="landing-page"
      style={{
        minHeight: "100vh",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <div className="global-scanlines" aria-hidden />
      <div className="crt-vignette" aria-hidden />
      <div className="interference-line" aria-hidden />
      <div className="noise" aria-hidden />

      <LandingNav scrollY={scrollY} />

      <main
        style={{
          padding: "max(80px, 12vh) var(--landing-padding-x) var(--landing-section-padding)",
          maxWidth: "800px",
          margin: "0 auto",
        }}
      >
        <h1
          className="display-text crt-text-heavy"
          style={{
            fontSize: "clamp(32px, 6vw, 56px)",
            marginBottom: "8px",
          }}
        >
          {title}
        </h1>

        <div
          className="legal-content crt-text"
          style={{ marginTop: "32px" }}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      </main>

      <LandingFooter />
    </div>
  );
}
