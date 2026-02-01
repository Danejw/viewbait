"use client";

import { useState } from "react";
import Link from "next/link";
import { FeedbackModal } from "@/components/feedback-modal";

export interface LandingFooterProps {
  /** Called when a footer link is hovered (e.g. to set custom cursor). Optional. */
  onLinkMouseEnter?: () => void;
  /** Called when a footer link hover ends. Optional. */
  onLinkMouseLeave?: () => void;
  /** When true, hover handlers are not applied (e.g. on touch devices). Optional. */
  isMobile?: boolean;
}

/**
 * Shared footer for landing and legal pages. Logo, Privacy/Terms/Contact links, copyright.
 */
export function LandingFooter({
  onLinkMouseEnter,
  onLinkMouseLeave,
  isMobile = false,
}: LandingFooterProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const linkStyle = {
    color: "#444",
    textDecoration: "none" as const,
    fontSize: "12px",
    transition: "color 0.2s",
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.color = "#888";
    if (!isMobile) onLinkMouseEnter?.();
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.color = "#444";
    if (!isMobile) onLinkMouseLeave?.();
  };

  const handleContactMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.color = "#888";
    if (!isMobile) onLinkMouseEnter?.();
  };

  const handleContactMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.color = "#444";
    if (!isMobile) onLinkMouseLeave?.();
  };

  return (
    <footer
      style={{
        padding: "32px var(--landing-padding-x)",
        borderTop: "1px solid rgba(255,255,255,0.03)",
      }}
    >
      <div
        style={{
          maxWidth: "1600px",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "20px",
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
        >
          <div
            style={{
              width: "28px",
              height: "28px",
              background: "#ff0000",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 15px rgba(255,0,0,0.4)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M 10 3 H 8 C 5.23858 3 3 5.23858 3 8 V 16 C 3 18.7614 5.23858 21 8 21 H 16 C 18.7614 21 21 18.7614 21 16 V 8 C 21 5.23858 18.7614 3 16 3 H 15"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M 3 13 L 8.5 8.5 L 12 12 L 15.5 9.5 L 21 14.5"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="crt-text-heavy" style={{ fontSize: "14px", fontWeight: 800 }}>
            VIEWBAIT
          </span>
        </Link>

        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          <Link
            href="/legal/privacy"
            className="crt-text"
            style={linkStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            Privacy
          </Link>
          <Link
            href="/legal/terms"
            className="crt-text"
            style={linkStyle}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            Terms
          </Link>
          <button
            type="button"
            className="crt-text cursor-pointer border-0 bg-transparent p-0 font-inherit"
            style={linkStyle}
            onClick={() => setFeedbackOpen(true)}
            onMouseEnter={handleContactMouseEnter}
            onMouseLeave={handleContactMouseLeave}
            aria-label="Open feedback form"
          >
            Contact
          </button>
        </div>

        <div
          className="mono crt-text"
          style={{ color: "#333", fontSize: "11px", letterSpacing: "0.05em" }}
        >
          © {new Date().getFullYear()} VIEWBAIT
        </div>
      </div>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </footer>
  );
}
