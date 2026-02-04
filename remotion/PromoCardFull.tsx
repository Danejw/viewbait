import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { PromoCardFull } from "./promo-copy-full";
import "./remotion.css";

const ENTRANCE_FRAMES = 12;

function LogoIcon({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
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
  );
}

function getBgStyle(bg: PromoCardFull["bg"]): React.CSSProperties["background"] {
  switch (bg) {
    case "red-glow":
      return "radial-gradient(ellipse at center, rgba(255,0,0,0.15) 0%, #030303 70%)";
    case "green-glow":
      return "radial-gradient(ellipse at center, rgba(34,197,94,0.15) 0%, #030303 70%)";
    case "white":
      return "#fafafa";
    default:
      return "#030303";
  }
}

const crtText: React.CSSProperties = {
  textShadow:
    "0.5px 0 0 rgba(255, 0, 0, 0.3), -0.5px 0 0 rgba(0, 255, 255, 0.3)",
};
const crtTextHeavy: React.CSSProperties = {
  textShadow:
    "1px 0 0 rgba(255, 0, 0, 0.5), -1px 0 0 rgba(0, 255, 255, 0.5)",
};

type PromoCardFullProps = {
  card: PromoCardFull;
  index: number;
};

/**
 * Renders one full promo card. All animations driven by useCurrentFrame (Remotion best practice).
 */
export function PromoCardFull({ card, index }: PromoCardFullProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 200 },
    durationInFrames: ENTRANCE_FRAMES,
  });
  const opacity = entrance;
  const scale = 0.92 + 0.08 * entrance;

  const isWhite = card.bg === "white";
  const textColor = isWhite ? "#0a0a0a" : "#fff";
  const mutedColor = isWhite ? "#666" : "#888";
  const accentColor = "#ff4444";

  const baseWrap: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
    background: getBgStyle(card.bg),
    opacity,
    transform: `scale(${scale})`,
  };

  const cropMark: React.CSSProperties = {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: isWhite ? "rgba(255,0,0,0.3)" : "rgba(255, 0, 0, 0.5)",
    borderStyle: "solid",
    borderWidth: 0,
  };

  return (
    <AbsoluteFill style={{ background: getBgStyle(card.bg) }}>
      {/* Crop marks */}
      <div style={{ ...cropMark, top: 40, left: 40, borderTopWidth: 2, borderLeftWidth: 2 }} />
      <div style={{ ...cropMark, top: 40, right: 40, borderTopWidth: 2, borderRightWidth: 2 }} />
      <div style={{ ...cropMark, bottom: 40, left: 40, borderBottomWidth: 2, borderLeftWidth: 2 }} />
      <div style={{ ...cropMark, bottom: 40, right: 40, borderBottomWidth: 2, borderRightWidth: 2 }} />

      <div style={baseWrap} key={index}>
        {card.type === "big-text" && (
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                ...crtTextHeavy,
                fontSize: 120,
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 0.9,
                color: card.highlight ? "#ff0000" : textColor,
              }}
            >
              {card.text}
            </h1>
            {card.subtext && (
              <p
                style={{
                  ...crtText,
                  fontSize: 36,
                  fontWeight: 700,
                  marginTop: 20,
                  color: card.highlight ? "#ff4444" : mutedColor,
                  letterSpacing: "-0.02em",
                }}
              >
                {card.subtext}
              </p>
            )}
          </div>
        )}

        {card.type === "stat" && (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                ...crtTextHeavy,
                fontSize: 160,
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 0.9,
                color: card.bg === "green-glow" ? "#22c55e" : "#ff0000",
              }}
            >
              {card.number}
            </div>
            <p
              style={{
                fontFamily: "Space Mono, monospace",
                ...crtText,
                fontSize: 24,
                fontWeight: 700,
                marginTop: 24,
                color: textColor,
                letterSpacing: "0.1em",
              }}
            >
              {card.label}
            </p>
            {card.subtext && (
              <p style={{ ...crtText, fontSize: 18, marginTop: 12, color: mutedColor }}>
                {card.subtext}
              </p>
            )}
          </div>
        )}

        {card.type === "text-stack" && (
          <div style={{ textAlign: "center" }}>
            {card.label && (
              <p
                style={{
                  fontFamily: "Space Mono, monospace",
                  ...crtText,
                  fontSize: 16,
                  color: accentColor,
                  letterSpacing: "0.15em",
                  marginBottom: 32,
                }}
              >
                {card.label}
              </p>
            )}
            {card.lines.map((line, i) => (
              <div
                key={i}
                style={{
                  ...crtTextHeavy,
                  fontSize: 56,
                  fontWeight: 800,
                  color: i % 2 === 0 ? textColor : mutedColor,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.2,
                }}
              >
                {line}
              </div>
            ))}
          </div>
        )}

        {card.type === "centered" && (
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                ...crtTextHeavy,
                fontSize: 72,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: card.highlight ? "#ff0000" : textColor,
              }}
            >
              {card.text}
            </p>
          </div>
        )}

        {card.type === "logo-reveal" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                background: "#ff0000",
                borderRadius: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 60px rgba(255,0,0,0.5)",
              }}
            >
              <LogoIcon size={40} />
            </div>
            <span
              style={{
                fontSize: 64,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                color: "#fff",
                ...crtTextHeavy,
              }}
            >
              VIEWBAIT
            </span>
          </div>
        )}

        {card.type === "tagline" && (
          <div style={{ textAlign: "center" }}>
            <p
              style={{
                fontFamily: "Space Mono, monospace",
                ...crtText,
                fontSize: 18,
                color: accentColor,
                letterSpacing: "0.2em",
                marginBottom: 16,
              }}
            >
              {card.text}
            </p>
            <h2
              style={{
                ...crtTextHeavy,
                fontSize: 80,
                fontWeight: 900,
                color: textColor,
                letterSpacing: "-0.04em",
              }}
            >
              {card.subtext}
            </h2>
          </div>
        )}

        {card.type === "feature" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 80, marginBottom: 32 }}>{card.icon}</div>
            <h2
              style={{
                fontFamily: "Space Mono, monospace",
                ...crtTextHeavy,
                fontSize: 36,
                fontWeight: 700,
                color: textColor,
                letterSpacing: "0.05em",
                marginBottom: 16,
              }}
            >
              {card.title}
            </h2>
            <p style={{ ...crtText, fontSize: 24, color: mutedColor }}>{card.description}</p>
          </div>
        )}

        {card.type === "demo-chat" && (
          <div
            style={{
              width: "100%",
              maxWidth: 700,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {card.messages.map((msg, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                <div
                  style={{
                    padding: "20px 28px",
                    borderRadius: 16,
                    background:
                      msg.role === "user"
                        ? "rgba(255,0,0,0.15)"
                        : "rgba(255,255,255,0.05)",
                    border:
                      msg.role === "user"
                        ? "1px solid rgba(255,0,0,0.3)"
                        : "1px solid rgba(255,255,255,0.1)",
                    maxWidth: "80%",
                  }}
                >
                  <p
                    style={{
                      fontFamily: "Space Mono, monospace",
                      ...crtText,
                      fontSize: 20,
                      color: msg.role === "user" ? "#fff" : mutedColor,
                    }}
                  >
                    {msg.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {card.type === "testimonial" && (
          <div style={{ textAlign: "center", maxWidth: 900 }}>
            <p
              style={{
                ...crtText,
                fontSize: 44,
                fontWeight: 600,
                color: textColor,
                fontStyle: "italic",
                lineHeight: 1.3,
                marginBottom: 32,
              }}
            >
              {card.quote}
            </p>
            <p
              style={{
                fontFamily: "Space Mono, monospace",
                fontSize: 20,
                color: accentColor,
              }}
            >
              {card.author}
            </p>
          </div>
        )}

        {card.type === "pricing" && (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                ...crtTextHeavy,
                fontSize: 140,
                fontWeight: 900,
                letterSpacing: "-0.04em",
                lineHeight: 0.9,
                color: "#ff0000",
              }}
            >
              {card.plan}
            </div>
            <div style={{ marginTop: 32 }}>
              {card.features.map((f, i) => (
                <p
                  key={i}
                  style={{
                    ...crtText,
                    fontSize: 24,
                    color: mutedColor,
                    marginTop: i > 0 ? 12 : 0,
                  }}
                >
                  {f}
                </p>
              ))}
            </div>
          </div>
        )}

        {card.type === "cta" && (
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                ...crtTextHeavy,
                fontSize: 96,
                fontWeight: 900,
                letterSpacing: "-0.03em",
                color: textColor,
                marginBottom: 24,
              }}
            >
              {card.text}
            </div>
            <p style={{ ...crtText, fontSize: 32, color: mutedColor }}>{card.subtext}</p>
          </div>
        )}

        {card.type === "logo-final-animated" && (
          <LogoFinalAnimated words={card.words} />
        )}
      </div>
    </AbsoluteFill>
  );
}

/** Word cycling for final card: ATTENTION → CLICKS → VIEWS. Driven by frame. */
function LogoFinalAnimated({ words }: { words: string[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cycleFrames = fps;
  const activeIndex = Math.floor(frame / cycleFrames) % words.length;
  const progressInCycle = (frame % cycleFrames) / cycleFrames;
  const opacity = interpolate(progressInCycle, [0, 0.2, 0.8, 1], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        textAlign: "center",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#fafafa",
        position: "absolute",
        inset: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          marginBottom: 60,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            background: "#ff0000",
            borderRadius: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 20px 60px rgba(255,0,0,0.3)",
          }}
        >
          <LogoIcon size={40} />
        </div>
        <span
          style={{
            fontSize: 56,
            fontWeight: 900,
            letterSpacing: "-0.03em",
            color: "#0a0a0a",
          }}
        >
          VIEWBAIT
        </span>
      </div>
      <div style={{ textAlign: "center" }}>
        <span
          style={{
            fontSize: 96,
            fontWeight: 900,
            letterSpacing: "-0.05em",
            lineHeight: 0.9,
            color: "#0a0a0a",
            display: "block",
          }}
        >
          DESIGN FOR
        </span>
        <div
          style={{
            fontSize: 96,
            fontWeight: 900,
            letterSpacing: "-0.05em",
            lineHeight: 1.1,
            color: "#ff0000",
            opacity,
          }}
        >
          {words[activeIndex]}
        </div>
      </div>
    </div>
  );
}
