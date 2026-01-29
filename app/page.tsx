"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Crown } from "lucide-react";
import { LenisRoot } from "@/components/landing/lenis-root";
import { ScrollReveal } from "@/components/landing/scroll-reveal";
import { useAuth } from "@/lib/hooks/useAuth";

const HERO_WORDS = ["ATTENTION", "CLICKS", "VIEWS", "RESULTS"];
const GENERATION_PROMPT =
  "A dramatic thumbnail with bold red text saying 'BLOOD RED' with a spartan ready for battle with a serious face expression, with dust rising from the ground...";

/** Hero thumbnail image path. Drop hero-thumbnail.jpg (or .webp) in public/landing/hero/ */
const HERO_THUMBNAIL_SRC = "/landing/hero/hero-thumbnail.jpg";

/** Face expression images for the Face Library bento. Drop images in public/landing/faces/ */
const FACE_EXPRESSIONS: { src: string; alt: string; emoji: string }[] = [
  { src: "/landing/faces/happy.jpg", alt: "Happy", emoji: "😀" },
  { src: "/landing/faces/surprised.jpg", alt: "Surprised", emoji: "😮" },
  { src: "/landing/faces/thinking.jpg", alt: "Thinking", emoji: "🤔" },
  { src: "/landing/faces/shocked.jpg", alt: "Shocked", emoji: "😱" },
  { src: "/landing/faces/fire.jpg", alt: "Fire", emoji: "🔥" },
  { src: "/landing/faces/cool.jpg", alt: "Cool", emoji: "😎" },
  { src: "/landing/faces/mind-blown.jpg", alt: "Mind blown", emoji: "🤯" },
];

/** Style template preview images. Drop images in public/landing/styles/ */
const STYLE_TEMPLATES: { name: string; color: string; src: string }[] = [
  { name: "Redux", color: "#ff4444", src: "/landing/styles/reaction.jpg" },
  { name: "Glitch", color: "#4488ff", src: "/landing/styles/tutorial.jpg" },
  { name: "Electric", color: "#44ff88", src: "/landing/styles/vlog.jpg" },
  { name: "Pop", color: "#a855f7", src: "/landing/styles/gaming.jpg" },
  { name: "Noir", color: "#000000", src: "/landing/styles/education.jpg" },
];

export default function ViewBaitLanding() {
  const { isAuthenticated } = useAuth();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [activeWord, setActiveWord] = useState(0);
  const [heroImageError, setHeroImageError] = useState(false);
  const [faceImageErrors, setFaceImageErrors] = useState<Record<number, boolean>>({});
  const [styleImageErrors, setStyleImageErrors] = useState<Record<number, boolean>>({});
  const [cursorVariant, setCursorVariant] = useState<"default" | "hover">("default");
  const [generatingText, setGeneratingText] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  /** Studio entry: signed-in users go to studio, others to auth. */
  const studioOrAuthHref = isAuthenticated ? "/studio" : "/auth";

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);

    const handleMouseMove = (e: MouseEvent) => {
      if (!isMobile) setMousePos({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);

    const wordInterval = setInterval(() => {
      setActiveWord((prev) => (prev + 1) % HERO_WORDS.length);
    }, 2500);

    let charIndex = 0;
    const typeInterval = setInterval(() => {
      if (charIndex <= GENERATION_PROMPT.length) {
        setGeneratingText(GENERATION_PROMPT.slice(0, charIndex));
        charIndex++;
      } else {
        charIndex = 0;
      }
    }, 50);

    return () => {
      window.removeEventListener("resize", checkMobile);
      window.removeEventListener("mousemove", handleMouseMove);
      clearInterval(wordInterval);
      clearInterval(typeInterval);
    };
  }, [isMobile]);

  const handleNavClick = () => {
    setMenuOpen(false);
  };

  return (
    <div
      className="landing-page"
      style={{
        minHeight: "100vh",
        position: "relative",
        cursor: isMobile ? "auto" : "none",
        overflowX: "hidden",
      }}
    >
      <LenisRoot>
        {(scrollY) => (
          <>
            {/* Global CRT effects */}
            <div className="global-scanlines" aria-hidden />
      <div className="crt-vignette" aria-hidden />
      <div className="interference-line" aria-hidden />
      <div className="noise" aria-hidden />

      {/* Custom cursor */}
      <div
        className={`custom-cursor ${cursorVariant === "hover" ? "hovering" : ""}`}
        style={{
          left: mousePos.x - (cursorVariant === "hover" ? 30 : 10),
          top: mousePos.y - (cursorVariant === "hover" ? 30 : 10),
        }}
        aria-hidden
      />
      <div
        className="cursor-dot"
        style={{
          left: mousePos.x - 3,
          top: mousePos.y - 3,
        }}
        aria-hidden
      />

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
          zIndex: 100,
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
          style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "inherit" }}
          onMouseEnter={() => !isMobile && setCursorVariant("hover")}
          onMouseLeave={() => !isMobile && setCursorVariant("default")}
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
            <div className="crop-mark tl" style={{ width: "6px", height: "6px", borderColor: "rgba(255,255,255,0.5)" }} />
            <div className="crop-mark br" style={{ width: "6px", height: "6px", borderColor: "rgba(255,255,255,0.5)" }} />
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
                setCursorVariant("hover");
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#666";
                setCursorVariant("default");
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
            onMouseEnter={() => !isMobile && setCursorVariant("hover")}
            onMouseLeave={() => !isMobile && setCursorVariant("default")}
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

      {/* Hero Section */}
      <section
        className="screen-flicker"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          padding: "max(100px, 15vh) var(--landing-padding-x) 60px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,0,0,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,0,0,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
            maskImage: "radial-gradient(ellipse at center, black 0%, transparent 70%)",
          }}
          aria-hidden
        />

        <div
          style={{
            position: "absolute",
            top: "20%",
            left: "10%",
            width: "min(600px, 80vw)",
            height: "min(600px, 80vw)",
            background: "radial-gradient(circle, rgba(255,0,0,0.1) 0%, transparent 60%)",
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
          aria-hidden
        />

        <div
          style={{
            maxWidth: "1600px",
            margin: "0 auto",
            width: "100%",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div className="hero-grid">
            <div style={{ animation: "landing-fadeUp 1s ease-out both" }}>
              <div
                className="scanline-texture"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 16px",
                  background: "rgba(255,0,0,0.08)",
                  border: "1px solid rgba(255,0,0,0.15)",
                  borderRadius: "100px",
                  marginBottom: "24px",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: "#ff0000",
                    boxShadow: "0 0 12px #ff0000, 0 0 24px rgba(255,0,0,0.5)",
                  }}
                />
                <span className="mono crt-text" style={{ fontSize: "11px", color: "#ff6666", letterSpacing: "0.08em" }}>
                  NOW IN PUBLIC BETA
                </span>
              </div>

              <h1
                className="display-text crt-text-heavy"
                style={{
                  fontSize: "clamp(40px, 10vw, 120px)",
                  marginBottom: "24px",
                }}
              >
                <span style={{ display: "block", color: "#fff" }}>DESIGN FOR</span>
                <span
                  style={{
                    display: "block",
                    height: "1.1em",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  {HERO_WORDS.map((word, i) => (
                    <span
                      key={word}
                      className="text-gradient phosphor-red"
                      style={{
                        display: "block",
                        position: i === 0 ? "relative" : "absolute",
                        top: 0,
                        left: 0,
                        opacity: activeWord === i ? 1 : 0,
                        transform:
                          activeWord === i ? "translateY(0) rotateX(0)" : "translateY(-100%) rotateX(-90deg)",
                        transition: "all 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                      }}
                    >
                      {word}
                    </span>
                  ))}
                </span>
              </h1>

              <p
                className="crt-text"
                style={{
                  fontSize: "clamp(16px, 2.5vw, 20px)",
                  lineHeight: 1.7,
                  color: "#777",
                  maxWidth: "540px",
                  marginBottom: "32px",
                }}
              >
                The AI thumbnail studio that understands what makes people click. Describe your vision. Upload your
                face. Generate scroll-stopping thumbnails in seconds.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href={studioOrAuthHref}
                  className="hot-zone btn-crt"
                  style={{
                    padding: "16px 28px",
                    background: "#ff0000",
                    border: "none",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "15px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    boxShadow: "0 20px 60px -15px rgba(255,0,0,0.5), 0 0 20px rgba(255,0,0,0.3)",
                    textDecoration: "none",
                  }}
                  onMouseEnter={() => !isMobile && setCursorVariant("hover")}
                  onMouseLeave={() => !isMobile && setCursorVariant("default")}
                >
                  <span className="phosphor-text">Start Creating</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>

                <a
                  href="#product"
                  className="btn-crt crt-glow"
                  style={{
                    padding: "16px 20px",
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "15px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    transition: "all 0.3s ease",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.25)";
                    e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                    !isMobile && setCursorVariant("hover");
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
                    e.currentTarget.style.background = "transparent";
                    !isMobile && setCursorVariant("default");
                  }}
                >
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "rgba(255,255,255,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                      <polygon points="6 4 20 12 6 20 6 4" />
                    </svg>
                  </div>
                  <span className="hide-mobile crt-text" style={{ display: "inline" }}>
                    See it in action
                  </span>
                  <span className="hide-desktop crt-text" style={{ display: "inline" }}>
                    Watch
                  </span>
                </a>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                  marginTop: "48px",
                  paddingTop: "24px",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex" }}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: `linear-gradient(135deg, hsl(${i * 60}, 60%, 40%) 0%, hsl(${i * 60}, 60%, 25%) 100%)`,
                        border: "2px solid #030303",
                        marginLeft: i > 0 ? "-8px" : 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        boxShadow: "0 0 10px rgba(0,0,0,0.5)",
                      }}
                    >
                      {["🎮", "📸", "🎬", "📚", "🎨"][i]}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="crt-text" style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>
                    Trusted by 12,500+ creators
                  </div>
                  <div className="crt-text" style={{ fontSize: "12px", color: "#555" }}>
                    Gaming, vlogs, tutorials & more
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                position: "relative",
                animation: "landing-fadeUp 1s ease-out 0.2s both",
              }}
            >
              <div
                className="the-frame frame-scanlines"
                style={{
                  width: "100%",
                  maxWidth: "560px",
                  aspectRatio: "16/9",
                  position: "relative",
                  margin: "0 auto",
                  boxShadow: "0 0 60px rgba(255,0,0,0.2), 0 0 120px rgba(255,0,0,0.1)",
                }}
              >
                <div className="crop-mark tl" />
                <div className="crop-mark tr" />
                <div className="crop-mark bl" />
                <div className="crop-mark br" />

                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 50%, #0a0a12 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {HERO_THUMBNAIL_SRC && !heroImageError && (
                    <Image
                      src={HERO_THUMBNAIL_SRC}
                      alt="ViewBait thumbnail preview"
                      fill
                      sizes="(max-width: 768px) 100vw, 560px"
                      className="object-cover"
                      onError={() => setHeroImageError(true)}
                    />
                  )}
                  {(!HERO_THUMBNAIL_SRC || heroImageError) && (
                    <>
                      <div
                        style={{
                          position: "absolute",
                          top: "15%",
                          right: "15%",
                          fontSize: "clamp(40px, 10vw, 80px)",
                          animation: "landing-float-slow 4s ease-in-out infinite",
                          filter: "drop-shadow(0 10px 30px rgba(0,0,0,0.5))",
                        }}
                      >
                        😱
                      </div>
                      <div
                        style={{
                          position: "absolute",
                          bottom: "20%",
                          left: "6%",
                          right: "6%",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "clamp(18px, 5vw, 32px)",
                            fontWeight: 900,
                            color: "#ffdd00",
                            letterSpacing: "-0.02em",
                            lineHeight: 1.1,
                            animation: "landing-glitchText 5s ease-in-out infinite",
                          }}
                        >
                          YOU WON&apos;T
                          <br />
                          BELIEVE THIS
                        </div>
                      </div>
                    </>
                  )}
                  <div
                    style={{
                      position: "absolute",
                      bottom: "12px",
                      right: "12px",
                      width: "44px",
                      height: "44px",
                      background: "#ff0000",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 4px 20px rgba(255,0,0,0.5), 0 0 30px rgba(255,0,0,0.3)",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <polygon points="6 4 20 12 6 20 6 4" />
                    </svg>
                  </div>
                  <div
                    className="mono"
                    style={{
                      position: "absolute",
                      bottom: "12px",
                      left: "12px",
                      padding: "4px 8px",
                      background: "rgba(0,0,0,0.85)",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    15:42
                  </div>
                </div>
              </div>

              <div
                className="scanline-texture"
                style={{
                  marginTop: "20px",
                  padding: "16px 20px",
                  background: "rgba(20,20,21,0.8)",
                  borderRadius: "12px",
                  border: "1px solid rgba(255,255,255,0.05)",
                  maxWidth: "560px",
                  margin: "20px auto 0",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "#22c55e",
                      boxShadow: "0 0 8px #22c55e, 0 0 16px rgba(34,197,94,0.5)",
                    }}
                  />
                  <span className="mono crt-text" style={{ fontSize: "10px", color: "#555", letterSpacing: "0.05em" }}>
                    AI GENERATING...
                  </span>
                </div>
                <div
                  className="mono crt-text"
                  style={{
                    fontSize: "12px",
                    color: "#888",
                    lineHeight: 1.5,
                    minHeight: "36px",
                  }}
                >
                  {generatingText}
                  <span style={{ animation: "landing-blink 1s infinite", color: "#ff0000" }}>▋</span>
                </div>
              </div>

              <div
                className="hide-mobile"
                style={{
                  position: "absolute",
                  top: "-20px",
                  right: "-30px",
                  width: "80px",
                  aspectRatio: "16/9",
                  background: "linear-gradient(135deg, #2a1a3a 0%, #150a20 100%)",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.05)",
                  opacity: 0.5,
                  animation: "landing-float-slow 5s ease-in-out 0.5s infinite",
                  boxShadow: "0 0 20px rgba(255,0,0,0.1)",
                }}
                aria-hidden
              />
              <div
                className="hide-mobile"
                style={{
                  position: "absolute",
                  bottom: "80px",
                  left: "-30px",
                  width: "60px",
                  aspectRatio: "16/9",
                  background: "linear-gradient(135deg, #1a2a1a 0%, #0a150a 100%)",
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.05)",
                  opacity: 0.4,
                  animation: "landing-float-slow 4s ease-in-out 1s infinite",
                }}
                aria-hidden
              />
            </div>
          </div>
        </div>
      </section>

      {/* Bento Features */}
      <section
        id="product"
        style={{
          paddingTop: "max(40px, 6vh)",
          paddingBottom: "var(--landing-section-padding)",
          paddingLeft: "var(--landing-padding-x)",
          paddingRight: "var(--landing-padding-x)",
          position: "relative",
        }}
      >
        <ScrollReveal>
        <div style={{ maxWidth: "1600px", margin: "0 auto 48px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div>
              <span
                className="mono crt-text"
                style={{
                  fontSize: "11px",
                  color: "#ff4444",
                  letterSpacing: "0.15em",
                  display: "block",
                  marginBottom: "12px",
                  textShadow: "0 0 10px rgba(255,68,68,0.5)",
                }}
              >
                THE STUDIO
              </span>
              <h2 className="display-text crt-text-heavy" style={{ fontSize: "clamp(32px, 6vw, 80px)" }}>
                EVERYTHING
                <br />
                <span style={{ color: "#444" }}>YOU NEED</span>
              </h2>
            </div>
            <p
              className="crt-text"
              style={{
                fontSize: "clamp(15px, 2vw, 18px)",
                color: "#666",
                maxWidth: "400px",
                lineHeight: 1.7,
              }}
            >
              A complete toolkit for creating thumbnails that convert. No Photoshop. No templates. Just describe and
              generate.
            </p>
          </div>
        </div>

        <div className="bento-grid" style={{ maxWidth: "1600px", margin: "0 auto" }}>
          <div
            className="bento-item bento-ai"
            onMouseEnter={() => !isMobile && setCursorVariant("hover")}
            onMouseLeave={() => !isMobile && setCursorVariant("default")}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            <div style={{ position: "relative", zIndex: 2 }}>
              <div
                style={{
                  display: "inline-flex",
                  padding: "8px 14px",
                  background: "rgba(255,0,0,0.1)",
                  borderRadius: "6px",
                  marginBottom: "20px",
                }}
              >
                <span className="mono crt-text" style={{ fontSize: "10px", color: "#ff6666", letterSpacing: "0.1em" }}>
                  CORE FEATURE
                </span>
              </div>
              <h3
                className="crt-text-heavy"
                style={{
                  fontSize: "clamp(24px, 4vw, 36px)",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  marginBottom: "12px",
                  lineHeight: 1.1,
                }}
              >
                Conversational AI
                <br />
                <span style={{ color: "#555" }}>that gets it</span>
              </h3>
              <p className="crt-text" style={{ fontSize: "14px", color: "#666", lineHeight: 1.6, maxWidth: "400px" }}>
                Describe what you want in plain language. Our AI understands creator intent, thumbnail psychology, and
                what makes people click.
              </p>
            </div>

            <div
              style={{
                background: "rgba(0,0,0,0.3)",
                borderRadius: "12px",
                padding: "16px",
                marginTop: "24px",
                position: "relative",
                zIndex: 2,
              }}
            >
              <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    background: "#ff0000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    flexShrink: 0,
                    boxShadow: "0 0 15px rgba(255,0,0,0.4)",
                  }}
                >
                  🤖
                </div>
                <div
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    flex: 1,
                  }}
                >
                  <p className="mono crt-text" style={{ fontSize: "12px", color: "#999" }}>
                    Creating a dramatic reaction thumbnail with bold text...
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <div
                  style={{
                    background: "rgba(255,0,0,0.15)",
                    borderRadius: "10px",
                    padding: "10px 14px",
                    maxWidth: "75%",
                  }}
                >
                  <p className="mono crt-text" style={{ fontSize: "12px", color: "#ccc" }}>
                    make it more dramatic, add fire emojis
                  </p>
                </div>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    background: "linear-gradient(135deg, #333 0%, #222 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    flexShrink: 0,
                  }}
                >
                  👤
                </div>
              </div>
            </div>
          </div>

          <div
            className="bento-item bento-face"
            onMouseEnter={() => !isMobile && setCursorVariant("hover")}
            onMouseLeave={() => !isMobile && setCursorVariant("default")}
          >
            <div style={{ position: "relative", zIndex: 2 }}>
              <h3
                className="crt-text-heavy"
                style={{
                  fontSize: "clamp(20px, 3vw, 24px)",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  marginBottom: "10px",
                }}
              >
                Face Library
              </h3>
              <p className="crt-text" style={{ fontSize: "13px", color: "#666", lineHeight: 1.6, marginBottom: "24px" }}>
                Upload once, use everywhere. Your expressions, perfectly integrated.
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: "8px",
                }}
              >
                {FACE_EXPRESSIONS.map((face, i) => (
                  <div
                    key={face.src}
                    style={{
                      aspectRatio: "1",
                      borderRadius: "8px",
                      overflow: "hidden",
                      position: "relative",
                      background: faceImageErrors[i]
                        ? `linear-gradient(135deg, hsl(${i * 40}, 40%, 25%) 0%, hsl(${i * 40}, 40%, 15%) 100%)`
                        : "transparent",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      boxShadow: "0 0 15px rgba(0,0,0,0.3)",
                    }}
                  >
                    {!faceImageErrors[i] ? (
                      <Image
                        src={face.src}
                        alt={face.alt}
                        fill
                        sizes="(max-width: 640px) 25vw, 120px"
                        className="object-cover"
                        onError={() => setFaceImageErrors((prev) => ({ ...prev, [i]: true }))}
                      />
                    ) : (
                      face.emoji
                    )}
                  </div>
                ))}
                <div
                  style={{
                    aspectRatio: "1",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.03)",
                    border: "2px dashed rgba(255,255,255,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    color: "#444",
                  }}
                >
                  +
                </div>
              </div>
            </div>
          </div>

          <div
            className="bento-item bento-speed"
            onMouseEnter={() => !isMobile && setCursorVariant("hover")}
            onMouseLeave={() => !isMobile && setCursorVariant("default")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
            }}
          >
            <div
              style={{
                position: "relative",
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                gap: "20px",
                width: "100%",
              }}
            >
              <div
                className="phosphor-text"
                style={{
                  fontSize: "clamp(36px, 6vw, 56px)",
                  fontWeight: 900,
                  letterSpacing: "-0.04em",
                  background: "linear-gradient(135deg, #fff 0%, #666 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                &lt;30s
              </div>
              <div>
                <div className="crt-text" style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>
                  Generation Time
                </div>
                <div className="crt-text" style={{ fontSize: "12px", color: "#555" }}>
                  From prompt to thumbnail
                </div>
              </div>
            </div>
          </div>

          <div
            className="bento-item bento-styles"
            onMouseEnter={() => !isMobile && setCursorVariant("hover")}
            onMouseLeave={() => !isMobile && setCursorVariant("default")}
          >
            <div style={{ position: "relative", zIndex: 2 }}>
              <h3
                className="crt-text-heavy"
                style={{
                  fontSize: "clamp(20px, 3vw, 24px)",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  marginBottom: "10px",
                }}
              >
                Style Templates
              </h3>
              <p className="crt-text" style={{ fontSize: "13px", color: "#666", lineHeight: 1.6, marginBottom: "20px" }}>
                Save winning formulas. Apply your signature look to any video.
              </p>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {STYLE_TEMPLATES.map((style, i) => (
                  <div
                    key={style.name}
                    style={{
                      flex: "1 1 80px",
                      aspectRatio: "16/9",
                      borderRadius: "8px",
                      overflow: "hidden",
                      position: "relative",
                      background: styleImageErrors[i]
                        ? `linear-gradient(135deg, ${style.color}22 0%, ${style.color}11 100%)`
                        : "transparent",
                      border: `1px solid ${style.color}33`,
                      display: "flex",
                      alignItems: "flex-end",
                      padding: "10px",
                      boxShadow: `0 0 20px ${style.color}22`,
                    }}
                  >
                    {!styleImageErrors[i] && (
                      <>
                        <Image
                          src={style.src}
                          alt={style.name}
                          fill
                          sizes="(max-width: 640px) 80px, 120px"
                          className="object-cover"
                          onError={() => setStyleImageErrors((prev) => ({ ...prev, [i]: true }))}
                        />
                        <div
                          style={{
                            position: "absolute",
                            inset: 0,
                            background: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 50%)",
                            pointerEvents: "none",
                          }}
                        />
                      </>
                    )}
                    <span
                      className="mono crt-text"
                      style={{
                        fontSize: "9px",
                        color: style.color,
                        letterSpacing: "0.05em",
                        position: "relative",
                        zIndex: 1,
                      }}
                    >
                      {style.name.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div
            className="bento-item bento-ctr"
            onMouseEnter={() => !isMobile && setCursorVariant("hover")}
            onMouseLeave={() => !isMobile && setCursorVariant("default")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            <div style={{ position: "relative", zIndex: 2 }}>
              <div className="crt-text" style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>
                Average CTR Increase
              </div>
              <div className="crt-text" style={{ fontSize: "12px", color: "#555" }}>
                Reported by creators
              </div>
            </div>
            <div
              style={{
                fontSize: "clamp(32px, 5vw, 48px)",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                color: "#22c55e",
                textShadow: "0 0 20px rgba(34,197,94,0.5), 0 0 40px rgba(34,197,94,0.3)",
                position: "relative",
                zIndex: 2,
              }}
            >
              +340%
            </div>
          </div>

          <div
            className="bento-item bento-small"
            onMouseEnter={() => !isMobile && setCursorVariant("hover")}
            onMouseLeave={() => !isMobile && setCursorVariant("default")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <div style={{ position: "relative", zIndex: 2 }}>
              <div className="phosphor-text" style={{ fontSize: "28px", fontWeight: 900, marginBottom: "4px" }}>
                4K
              </div>
              <div className="mono crt-text" style={{ fontSize: "9px", color: "#555", letterSpacing: "0.1em" }}>
                RESOLUTION
              </div>
            </div>
          </div>

          <div
            className="bento-item bento-small"
            onMouseEnter={() => !isMobile && setCursorVariant("hover")}
            onMouseLeave={() => !isMobile && setCursorVariant("default")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                position: "relative",
                zIndex: 2,
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {["YT", "SHORT", "IG"].map((format) => (
                <div
                  key={format}
                  style={{
                    padding: "6px 12px",
                    background: "rgba(255,255,255,0.05)",
                    borderRadius: "6px",
                  }}
                >
                  <span className="mono crt-text" style={{ fontSize: "10px", color: "#888", letterSpacing: "0.05em" }}>
                    {format}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="bento-item bento-small"
            onMouseEnter={() => !isMobile && setCursorVariant("hover")}
            onMouseLeave={() => !isMobile && setCursorVariant("default")}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <div style={{ position: "relative", zIndex: 2 }}>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 900,
                  marginBottom: "4px",
                  background: "linear-gradient(135deg, #ff0000, #ff8800)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  filter: "drop-shadow(0 0 10px rgba(255,68,0,0.5))",
                }}
              >
                SOTA
              </div>
              <div className="mono crt-text" style={{ fontSize: "9px", color: "#555", letterSpacing: "0.1em" }}>
                AI MODELS
              </div>
            </div>
          </div>
        </div>
        </ScrollReveal>
      </section>

      {/* Testimonials */}
      <section
        id="creators"
        style={{
          padding: "var(--landing-section-padding) var(--landing-padding-x)",
          background: "linear-gradient(180deg, #030303 0%, #080808 50%, #030303 100%)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          className="hide-mobile crt-text"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            fontSize: "18vw",
            fontWeight: 900,
            color: "rgba(255,255,255,0.015)",
            letterSpacing: "-0.05em",
            whiteSpace: "nowrap",
            pointerEvents: "none",
          }}
          aria-hidden
        >
          CREATORS
        </div>

        <ScrollReveal>
        <div style={{ maxWidth: "1200px", margin: "0 auto", position: "relative", zIndex: 1 }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <span
              className="mono crt-text"
              style={{
                fontSize: "11px",
                color: "#ff4444",
                letterSpacing: "0.15em",
                display: "block",
                marginBottom: "12px",
                textShadow: "0 0 10px rgba(255,68,68,0.5)",
              }}
            >
              TESTIMONIALS
            </span>
            <h2 className="display-text crt-text-heavy" style={{ fontSize: "clamp(32px, 5vw, 64px)" }}>
              LOVED BY
              <br />
              <span style={{ color: "#444" }}>CREATORS</span>
            </h2>
          </div>

          <div className="testimonials-grid">
            {[
              {
                quote:
                  "ViewBait cut my thumbnail creation time from 2 hours to 5 minutes. My CTR went up 40% in the first month.",
                name: "Alex Chen",
                handle: "@alexgaming",
                avatar: "🎮",
                metric: "+40% CTR",
              },
              {
                quote:
                  "The AI actually understands what makes a good thumbnail. It's not just generating random images.",
                name: "Sarah Miller",
                handle: "@sarahvlogs",
                avatar: "📸",
                metric: "2M+ views",
              },
              {
                quote:
                  "Finally, a tool that keeps my brand consistent. Same face, same style, every thumbnail.",
                name: "Marcus Webb",
                handle: "@marcusteaches",
                avatar: "📚",
                metric: "50K subs",
              },
            ].map((testimonial, i) => (
              <div
                key={i}
                className="hover-lift testimonial-card"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(20,20,21,0.6) 0%, rgba(10,10,11,0.8) 100%)",
                  border: "1px solid rgba(255,255,255,0.04)",
                  borderRadius: "16px",
                  padding: "24px",
                  position: "relative",
                  overflow: "hidden",
                }}
                onMouseEnter={() => !isMobile && setCursorVariant("hover")}
                onMouseLeave={() => !isMobile && setCursorVariant("default")}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "20px",
                    right: "20px",
                    padding: "5px 10px",
                    background: "rgba(34, 197, 94, 0.1)",
                    borderRadius: "6px",
                    zIndex: 2,
                  }}
                >
                  <span
                    className="mono crt-text"
                    style={{ fontSize: "10px", color: "#22c55e", letterSpacing: "0.05em" }}
                  >
                    {testimonial.metric}
                  </span>
                </div>

                <p
                  className="crt-text"
                  style={{
                    fontSize: "14px",
                    lineHeight: 1.7,
                    color: "#999",
                    marginBottom: "24px",
                    paddingRight: "60px",
                    position: "relative",
                    zIndex: 2,
                  }}
                >
                  &quot;{testimonial.quote}&quot;
                </p>

                <div style={{ display: "flex", alignItems: "center", gap: "12px", position: "relative", zIndex: 2 }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "10px",
                      background: "linear-gradient(135deg, #222 0%, #111 100%)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      boxShadow: "0 0 15px rgba(0,0,0,0.5)",
                    }}
                  >
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="crt-text" style={{ fontSize: "14px", fontWeight: 600 }}>
                      {testimonial.name}
                    </div>
                    <div className="mono crt-text" style={{ fontSize: "11px", color: "#555" }}>
                      {testimonial.handle}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        </ScrollReveal>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        style={{
          padding: "var(--landing-section-padding) var(--landing-padding-x)",
          position: "relative",
        }}
      >
        <ScrollReveal>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <span
              className="mono crt-text"
              style={{
                fontSize: "11px",
                color: "#ff4444",
                letterSpacing: "0.15em",
                display: "block",
                marginBottom: "12px",
                textShadow: "0 0 10px rgba(255,68,68,0.5)",
              }}
            >
              PRICING
            </span>
            <h2 className="display-text crt-text-heavy" style={{ fontSize: "clamp(32px, 5vw, 64px)", marginBottom: "12px" }}>
              CHOOSE YOUR PLAN
            </h2>
            <p className="crt-text" style={{ fontSize: "16px", color: "#555" }}>
              Select a subscription tier that fits your needs.
            </p>
          </div>

          <div className="pricing-grid">
            {[
              {
                name: "Free",
                price: "Free",
                period: "",
                desc: "Try it out",
                features: ["10 credits/mo", "1K resolution", "1 variation per generation", "30-day storage"],
                cta: "Get Started",
                highlighted: false,
                showCrown: false,
              },
              {
                name: "Starter",
                price: "$19.99",
                period: "/month",
                desc: "For serious creators",
                features: [
                  "100 credits/mo",
                  "1K, 2K resolution",
                  "Up to 2 variations",
                  "No watermark",
                  "AI Title Enhancement",
                  "Custom styles, palettes & faces",
                  "Permanent storage",
                ],
                cta: "Select Plan",
                highlighted: true,
                showCrown: true,
              },
              {
                name: "Advanced",
                price: "$49.99",
                period: "/month",
                desc: "For growing channels",
                features: [
                  "300 credits/mo",
                  "1K, 2K, 4K resolution",
                  "Up to 3 variations",
                  "No watermark",
                  "AI Title Enhancement",
                  "Custom styles, palettes & faces",
                  "Permanent storage",
                  "Priority generation",
                ],
                cta: "Select Plan",
                highlighted: false,
                showCrown: true,
              },
              {
                name: "Pro",
                price: "$99.99",
                period: "/month",
                desc: "For power creators",
                features: [
                  "700 credits/mo",
                  "1K, 2K, 4K resolution",
                  "Up to 4 variations",
                  "No watermark",
                  "AI Title Enhancement",
                  "Custom styles, palettes & faces",
                  "Permanent storage",
                  "Priority generation",
                  "Early access",
                ],
                cta: "Select Plan",
                highlighted: false,
                showCrown: true,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className="hover-lift pricing-card"
                style={{
                  background: plan.highlighted
                    ? "linear-gradient(180deg, rgba(255,0,0,0.08) 0%, rgba(15,15,16,0.95) 40%)"
                    : "rgba(12,12,13,0.8)",
                  border: plan.highlighted
                    ? "1px solid rgba(255,0,0,0.25)"
                    : "1px solid rgba(255,255,255,0.04)",
                  borderRadius: "20px",
                  padding: "32px",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: plan.highlighted ? "0 0 40px rgba(255,0,0,0.15)" : "none",
                }}
                onMouseEnter={() => !isMobile && setCursorVariant("hover")}
                onMouseLeave={() => !isMobile && setCursorVariant("default")}
              >
                {plan.highlighted && (
                  <>
                    <div className="crop-mark tl" />
                    <div className="crop-mark tr" />
                    <div className="crop-mark bl" />
                    <div className="crop-mark br" />
                    <div
                      style={{
                        position: "absolute",
                        top: "-1px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        padding: "6px 16px",
                        background: "#ff0000",
                        borderRadius: "0 0 10px 10px",
                        fontSize: "9px",
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        zIndex: 3,
                        boxShadow: "0 0 20px rgba(255,0,0,0.5)",
                      }}
                    >
                      RECOMMENDED
                    </div>
                  </>
                )}

                <div style={{ position: "relative", zIndex: 2 }}>
                  <h3
                    className="crt-text-heavy"
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      marginBottom: "4px",
                      marginTop: plan.highlighted ? "8px" : 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    {plan.showCrown && (
                      <Crown
                        className="shrink-0"
                        style={{
                          width: "18px",
                          height: "18px",
                          color: "#ff4444",
                          filter: "drop-shadow(0 0 4px rgba(255,68,68,0.5))",
                        }}
                      />
                    )}
                    {plan.name}
                  </h3>
                  <p
                    className="crt-text"
                    style={{
                      fontSize: "12px",
                      color: "#555",
                      marginBottom: "20px",
                    }}
                  >
                    {plan.desc}
                  </p>

                  <div style={{ marginBottom: "24px" }}>
                    <span
                      className="phosphor-text"
                      style={{
                        fontSize: "clamp(36px, 6vw, 48px)",
                        fontWeight: 900,
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {plan.price}
                    </span>
                    <span className="crt-text" style={{ color: "#555", fontSize: "13px" }}>
                      {plan.period}
                    </span>
                  </div>

                  <ul style={{ listStyle: "none", marginBottom: "24px" }}>
                    {plan.features.map((feature, j) => (
                      <li
                        key={j}
                        className="crt-text"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "12px",
                          color: "#888",
                          fontSize: "13px",
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#22c55e"
                          strokeWidth="2.5"
                          style={{ filter: "drop-shadow(0 0 4px rgba(34,197,94,0.5))" }}
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={studioOrAuthHref}
                    className="btn-crt"
                    style={{
                      width: "100%",
                      padding: "14px",
                      borderRadius: "10px",
                      border: plan.highlighted ? "none" : "1px solid rgba(255,255,255,0.08)",
                      background: plan.highlighted ? "#ff0000" : "transparent",
                      color: "#fff",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      boxShadow: plan.highlighted ? "0 0 20px rgba(255,0,0,0.3)" : "none",
                      textAlign: "center",
                      textDecoration: "none",
                      display: "block",
                    }}
                  >
                    {plan.cta}
                  </Link>
                </div>
              </div>
            ))}
          </div>
          <p className="crt-text" style={{ textAlign: "center", marginTop: "32px", fontSize: "14px", color: "#555" }}>
            All plans include access to our thumbnail generation tools. Upgrade or downgrade at any time.
          </p>
        </div>
        </ScrollReveal>
      </section>

      {/* Final CTA */}
      <section
        style={{
          padding: "var(--landing-section-padding) var(--landing-padding-x)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "10%",
            right: "10%",
            height: "1px",
            background: "linear-gradient(90deg, transparent, #ff0000, transparent)",
            boxShadow: "0 0 20px rgba(255,0,0,0.5)",
          }}
          aria-hidden
        />

        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(800px, 100vw)",
            height: "min(800px, 100vw)",
            background: "radial-gradient(circle, rgba(255,0,0,0.12) 0%, transparent 50%)",
            filter: "blur(80px)",
            pointerEvents: "none",
          }}
          aria-hidden
        />

        <ScrollReveal>
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            textAlign: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <h2
            className="display-text crt-text-heavy"
            style={{
              fontSize: "clamp(36px, 8vw, 100px)",
              marginBottom: "24px",
            }}
          >
            <span style={{ display: "block" }}>READY TO</span>
            <span className="text-gradient phosphor-red" style={{ display: "block" }}>
              STOP THE SCROLL?
            </span>
          </h2>

          <p
            className="crt-text"
            style={{
              fontSize: "clamp(16px, 2.5vw, 20px)",
              color: "#555",
              marginBottom: "40px",
              maxWidth: "500px",
              margin: "0 auto 40px",
            }}
          >
            Join 12,500+ creators making thumbnails that demand attention.
          </p>

          <Link
            href={studioOrAuthHref}
            className="hot-zone btn-crt"
            style={{
              padding: "20px 44px",
              background: "#ff0000",
              border: "none",
              borderRadius: "14px",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "12px",
              boxShadow: "0 20px 80px -20px rgba(255,0,0,0.6), 0 0 40px rgba(255,0,0,0.3)",
              textDecoration: "none",
            }}
            onMouseEnter={() => !isMobile && setCursorVariant("hover")}
            onMouseLeave={() => !isMobile && setCursorVariant("default")}
          >
            <span className="phosphor-text">Open Studio</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        </ScrollReveal>
      </section>

      {/* Footer */}
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
            style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", color: "inherit" }}
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
              style={{
                color: "#444",
                textDecoration: "none",
                fontSize: "12px",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#888";
                !isMobile && setCursorVariant("hover");
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#444";
                !isMobile && setCursorVariant("default");
              }}
            >
              Privacy
            </Link>
            <Link
              href="/legal/terms"
              className="crt-text"
              style={{
                color: "#444",
                textDecoration: "none",
                fontSize: "12px",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#888";
                !isMobile && setCursorVariant("hover");
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#444";
                !isMobile && setCursorVariant("default");
              }}
            >
              Terms
            </Link>
            <a
              href="mailto:contact@viewbait.app"
              className="crt-text"
              style={{
                color: "#444",
                textDecoration: "none",
                fontSize: "12px",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#888";
                !isMobile && setCursorVariant("hover");
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#444";
                !isMobile && setCursorVariant("default");
              }}
            >
              Contact
            </a>
          </div>

          <div className="mono crt-text" style={{ color: "#333", fontSize: "11px", letterSpacing: "0.05em" }}>
            © {new Date().getFullYear()} VIEWBAIT
          </div>
        </div>
      </footer>
          </>
        )}
      </LenisRoot>
    </div>
  );
}
