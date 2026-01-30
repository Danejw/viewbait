"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LenisRoot } from "@/components/landing/lenis-root";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";

export interface LegalPageViewProps {
  /** Page title shown at the top (e.g. "Privacy Policy"). */
  title: string;
  /** Raw markdown content (without the leading # Title line if already used as title). */
  content: string;
}

const contentBlockStyle: React.CSSProperties = {
  color: "#888",
  lineHeight: 1.7,
  fontSize: "15px",
};

/**
 * Landing-styled legal page shell: LenisRoot, CRT effects, nav, markdown body, footer.
 * Used by /legal/privacy and /legal/terms.
 */
export function LegalPageView({ title, content }: LegalPageViewProps) {
  return (
    <div
      className="landing-page"
      style={{
        minHeight: "100vh",
        position: "relative",
        overflowX: "hidden",
      }}
    >
      <LenisRoot>
        {(_scrollY) => (
          <>
            <div className="global-scanlines" aria-hidden />
            <div className="crt-vignette" aria-hidden />
            <div className="interference-line" aria-hidden />
            <div className="noise" aria-hidden />

            <LandingNav />

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

              <div className="legal-content crt-text" style={{ marginTop: "32px" }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1() {
                      return null;
                    },
                    h2({ children }) {
                      return (
                        <h2
                          className="crt-text-heavy"
                          style={{
                            fontSize: "1.35rem",
                            fontWeight: 800,
                            marginTop: "2rem",
                            marginBottom: "0.75rem",
                            color: "#eee",
                          }}
                        >
                          {children}
                        </h2>
                      );
                    },
                    h3({ children }) {
                      return (
                        <h3
                          className="crt-text-heavy"
                          style={{
                            fontSize: "1.1rem",
                            fontWeight: 700,
                            marginTop: "1.5rem",
                            marginBottom: "0.5rem",
                            color: "#ccc",
                          }}
                        >
                          {children}
                        </h3>
                      );
                    },
                    p({ children }) {
                      return (
                        <p style={{ ...contentBlockStyle, marginBottom: "1rem" }}>
                          {children}
                        </p>
                      );
                    },
                    ul({ children }) {
                      return (
                        <ul
                          style={{
                            ...contentBlockStyle,
                            marginBottom: "1rem",
                            paddingLeft: "1.5rem",
                          }}
                        >
                          {children}
                        </ul>
                      );
                    },
                    ol({ children }) {
                      return (
                        <ol
                          style={{
                            ...contentBlockStyle,
                            marginBottom: "1rem",
                            paddingLeft: "1.5rem",
                          }}
                        >
                          {children}
                        </ol>
                      );
                    },
                    li({ children }) {
                      return (
                        <li style={{ marginBottom: "0.35rem" }}>
                          {children}
                        </li>
                      );
                    },
                    a({ href, children }) {
                      const isInternal = href?.startsWith("/");
                      const style: React.CSSProperties = {
                        color: "#ff6666",
                        textDecoration: "underline",
                        textUnderlineOffset: "2px",
                      };
                      if (isInternal && href) {
                        return (
                          <Link href={href} style={style}>
                            {children}
                          </Link>
                        );
                      }
                      return (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={style}
                        >
                          {children}
                        </a>
                      );
                    },
                    strong({ children }) {
                      return (
                        <strong style={{ color: "#bbb", fontWeight: 700 }}>
                          {children}
                        </strong>
                      );
                    },
                    table({ children }) {
                      return (
                        <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
                          <table
                            className="crt-text"
                            style={{
                              width: "100%",
                              borderCollapse: "collapse",
                              fontSize: "14px",
                              color: "#888",
                            }}
                          >
                            {children}
                          </table>
                        </div>
                      );
                    },
                    thead({ children }) {
                      return (
                        <thead>
                          {children}
                        </thead>
                      );
                    },
                    tbody({ children }) {
                      return <tbody>{children}</tbody>;
                    },
                    tr({ children }) {
                      return (
                        <tr
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {children}
                        </tr>
                      );
                    },
                    th({ children }) {
                      return (
                        <th
                          style={{
                            textAlign: "left",
                            padding: "10px 12px",
                            fontWeight: 600,
                            color: "#aaa",
                          }}
                        >
                          {children}
                        </th>
                      );
                    },
                    td({ children }) {
                      return (
                        <td style={{ padding: "10px 12px" }}>
                          {children}
                        </td>
                      );
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
              </div>
            </main>

            <LandingFooter />
          </>
        )}
      </LenisRoot>
    </div>
  );
}
