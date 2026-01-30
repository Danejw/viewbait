"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Crown, ArrowRight } from "lucide-react";
import { LenisRoot } from "@/components/landing/lenis-root";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
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

      <LandingNav setCursorVariant={setCursorVariant} />

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container mx-auto px-4 py-20 md:py-32">
          <div className="mx-auto max-w-4xl text-center">
            <h1 className="mb-6 text-4xl font-bold tracking-tight md:text-6xl">
              Create Your Next{" "}
              <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                Viral Thumbnail
              </span>
            </h1>
            <p className="mb-8 text-lg text-muted-foreground md:text-xl">
              AI-powered thumbnail generation that helps creators design eye-catching,
              conversion-optimized thumbnails in seconds. No design skills required.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/studio">
                  Start Creating
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="#features">Learn More</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="border-t border-border bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-6xl">
              <h2 className="mb-12 text-center text-3xl font-bold">
                Everything you need to create viral thumbnails
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

        <ScrollReveal>
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
                1K <span style={{ color: "#ff0000" }}>|</span> 2K <span style={{ color: "#ff0000" }}>|</span> 4K
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
                    <div className="crt-text" style={{ fontSize: "12px", color: "#666" }}>
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

        {/* CTA Section */}
        <section className="border-t border-border py-20">
          <div className="container mx-auto px-4">
            <Card className="mx-auto max-w-2xl border-primary/20 bg-primary/5">
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">Ready to create viral thumbnails?</CardTitle>
                <CardDescription className="text-base">
                  Join creators who are using ViewBait to grow their channels.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <Button asChild size="lg">
                  <Link href="/studio">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <LandingFooter
        onLinkMouseEnter={() => setCursorVariant("hover")}
        onLinkMouseLeave={() => setCursorVariant("default")}
        isMobile={isMobile}
      />
          </>
        )}
      </LenisRoot>
    </div>
  );
}
