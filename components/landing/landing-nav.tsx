"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { useLenisScroll } from "@/components/landing/lenis-root";

export interface LandingNavProps {
  /** When provided, nav links update custom cursor on hover (e.g. root page). Optional. */
  setCursorVariant?: (v: "default" | "hover") => void;
}

/**
 * Shared fixed nav for landing and legal pages. Logo, Product/Pricing/Creators, Open Studio, mobile menu.
 * Must be rendered inside LenisRoot so useLenisScroll() provides scrollY.
 */
export function LandingNav({ setCursorVariant }: LandingNavProps) {
  const { isAuthenticated } = useAuth();
  const lenisScroll = useLenisScroll();
  const scrollY = lenisScroll?.scrollY ?? 0;

  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const studioOrAuthHref = isAuthenticated ? "/studio" : "/auth";

  const handleNavClick = () => setMenuOpen(false);

  return (
    <>
      {/* Mobile menu overlay */}
      <div
        className={`mobile-menu-overlay ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setMenuOpen(false)}
        role="button"
        tabIndex={0}
        aria-label="Close menu"
      />

      {/* Mobile menu */}
      <div className={`mobile-menu ${menuOpen ? "open" : ""}`} aria-hidden={!menuOpen}>
        <nav style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {["Product", "Pricing", "Creators"].map((link) => (
            <Link
              key={link}
              href={`#${link.toLowerCase()}`}
              onClick={handleNavClick}
              className="crt-text"
              style={{
                color: "#999",
                textDecoration: "none",
                fontSize: "18px",
                fontWeight: 600,
                padding: "12px 0",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {link}
            </Link>
          ))}
          <Link
            href={studioOrAuthHref}
            onClick={handleNavClick}
            className="btn-crt"
            style={{
              marginTop: "16px",
              padding: "16px 24px",
              background: "#ff0000",
              border: "none",
              borderRadius: "12px",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
              width: "100%",
              textAlign: "center",
              textDecoration: "none",
              display: "block",
            }}
          >
            Open Studio
          </Link>
        </nav>
      </div>

      {/* Navigation */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9998,
          padding: "16px var(--landing-padding-x)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: scrollY > 50 ? "rgba(3,3,3,0.95)" : "transparent",
          backdropFilter: scrollY > 50 ? "blur(20px) saturate(180%)" : "none",
          borderBottom: scrollY > 50 ? "1px solid rgba(255,255,255,0.03)" : "none",
          transition: "all 0.4s ease",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textDecoration: "none",
            color: "inherit",
          }}
          onMouseEnter={() => !isMobile && setCursorVariant?.("hover")}
          onMouseLeave={() => !isMobile && setCursorVariant?.("default")}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              background: "#ff0000",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              boxShadow: "0 0 30px rgba(255,0,0,0.4), inset 0 0 20px rgba(255,255,255,0.1)",
            }}
          >
            <div
              className="crop-mark tl"
              style={{ width: "6px", height: "6px", borderColor: "rgba(255,255,255,0.5)" }}
            />
            <div
              className="crop-mark br"
              style={{ width: "6px", height: "6px", borderColor: "rgba(255,255,255,0.5)" }}
            />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M 10 3 H 8 C 5.23858 3 3 5.23858 3 8 V 16 C 3 18.7614 5.23858 21 8 21 H 16 C 18.7614 21 21 18.7614 21 16 V 8 C 21 5.23858 18.7614 3 16 3 H 15"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 3 13 L 8.5 8.5 L 12 12 L 15.5 9.5 L 21 14.5"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <span
              className="crt-text-heavy"
              style={{
                fontSize: "18px",
                fontWeight: 900,
                letterSpacing: "-0.02em",
                display: "block",
                lineHeight: 1,
              }}
            >
              VIEWBAIT
            </span>
            <span
              className="mono hide-mobile crt-text"
              style={{
                fontSize: "9px",
                color: "#555",
                letterSpacing: "0.1em",
              }}
            >
              THUMBNAIL STUDIO
            </span>
          </div>
        </Link>

        <div className="landing-nav-links hide-mobile" style={{ alignItems: "center", gap: "40px" }}>
          {["Product", "Pricing", "Creators"].map((link) => (
            <Link
              key={link}
              href={`#${link.toLowerCase()}`}
              className="crt-text"
              style={{
                color: "#666",
                textDecoration: "none",
                fontSize: "14px",
                fontWeight: 500,
                position: "relative",
                padding: "8px 0",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
                setCursorVariant?.("hover");
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#666";
                setCursorVariant?.("default");
              }}
            >
              {link}
            </Link>
          ))}

          <Link
            href={studioOrAuthHref}
            className="btn-crt"
            style={{
              padding: "12px 24px",
              background: "#fff",
              border: "none",
              borderRadius: "10px",
              color: "#000",
              fontSize: "14px",
              fontWeight: 700,
              cursor: "pointer",
              position: "relative",
              overflow: "hidden",
              textDecoration: "none",
              display: "inline-block",
            }}
            onMouseEnter={() => !isMobile && setCursorVariant?.("hover")}
            onMouseLeave={() => !isMobile && setCursorVariant?.("default")}
          >
            Open Studio
          </Link>
        </div>

        <button
          type="button"
          className="hide-desktop"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          style={{
            width: "44px",
            height: "44px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "10px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            cursor: "pointer",
          }}
        >
          <span
            style={{
              width: "18px",
              height: "2px",
              background: "#fff",
              borderRadius: "2px",
              transition: "all 0.3s ease",
              transform: menuOpen ? "rotate(45deg) translateY(7px)" : "none",
              boxShadow: "0 0 4px rgba(255,0,0,0.5)",
            }}
          />
          <span
            style={{
              width: "18px",
              height: "2px",
              background: "#fff",
              borderRadius: "2px",
              opacity: menuOpen ? 0 : 1,
              transition: "all 0.3s ease",
            }}
          />
          <span
            style={{
              width: "18px",
              height: "2px",
              background: "#fff",
              borderRadius: "2px",
              transition: "all 0.3s ease",
              transform: menuOpen ? "rotate(-45deg) translateY(-7px)" : "none",
              boxShadow: "0 0 4px rgba(255,0,0,0.5)",
            }}
          />
        </button>
      </nav>
    </>
  );
}
