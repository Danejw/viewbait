"use client";

import React from "react";

interface GalleryIconProps {
  /** Starting color for the gradient (hex format) */
  startColor?: string;
  /** Ending color for the gradient (hex format) */
  endColor?: string;
  /** Size of the icon in pixels */
  size?: number;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show the floating animation */
  animated?: boolean;
  /** Whether to show the drop shadow glow */
  showGlow?: boolean;
  /** Whether to show loading state with draw-path animation */
  loading?: boolean;
  /** Custom style object */
  style?: React.CSSProperties;
}

/**
 * Reusable GalleryIcon component with customizable gradient colors and animations.
 * Perfect for use as a logo or decorative icon.
 */
const GalleryIcon = ({
  startColor = "#FF512F",
  endColor = "#F09819",
  size = 24,
  className = "",
  animated = true,
  showGlow = true,
  loading = false,
  style,
}: GalleryIconProps) => {
  // Generate a unique ID for the gradient based on colors to prevent ID collisions
  const gradientId = `gallery-gradient-${startColor.replace("#", "")}-${endColor.replace("#", "")}`;

  // Helper to convert hex to rgba for the drop shadow glow, ensuring the shadow matches the customized colors
  const getShadowColor = (hex: string, alpha: number): string => {
    const isHex = /^#?([0-9A-F]{3}){1,2}$/i.test(hex);
    if (!isHex) return `rgba(240, 152, 25, ${alpha})`; // Fallback to original orange shadow if invalid hex

    let c = hex.substring(1).split("");
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    const num = parseInt(c.join(""), 16);

    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  };

  const shadowColor = getShadowColor(endColor, loading ? 0.4 : 0.3);

  return (
    <>
      {/* 
        Inject keyframes for animations.
        Normal state: gallery-float and gallery-mountain-lag
        Loading state: draw-path and sun-bounce
      */}
      {(animated || loading) && (
        <style>
          {loading ? `
            @keyframes draw-path {
              0% { stroke-dashoffset: 1; stroke-opacity: 0.1; }
              50% { stroke-dashoffset: 0; stroke-opacity: 1; }
              100% { stroke-dashoffset: -1; stroke-opacity: 0.1; }
            }
            @keyframes sun-bounce {
              0%, 100% { transform: translateY(0); opacity: 0.8; }
              50% { transform: translateY(-3px); opacity: 1; }
            }
          ` : `
            @keyframes gallery-float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-8px); }
            }
            @keyframes gallery-mountain-lag {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(3px); }
            }
          `}
        </style>
      )}

      <div className={`flex items-center justify-center ${className}`} style={style}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={loading ? "" : "transition-transform duration-500 ease-out hover:scale-105"}
          style={{
            filter: showGlow ? `drop-shadow(0px ${loading ? 8 : 10}px 20px ${shadowColor})` : "none",
            animation: loading ? "none" : (animated ? "gallery-float 4s ease-in-out infinite" : "none"),
          }}
        >
          <defs>
            <linearGradient
              id={gradientId}
              x1={loading ? "0" : "2"}
              y1={loading ? "0" : "2"}
              x2={loading ? "24" : "22"}
              y2={loading ? "24" : "22"}
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0%" stopColor={startColor}>
                {/* Animate the gradient colors to shimmer continuously */}
                {(animated || loading) && (
                  <animate
                    attributeName="stop-color"
                    values={`${startColor};${endColor};${startColor}`}
                    dur={loading ? "3s" : "4s"}
                    repeatCount="indefinite"
                  />
                )}
              </stop>
              <stop offset="100%" stopColor={endColor}>
                {(animated || loading) && (
                  <animate
                    attributeName="stop-color"
                    values={`${endColor};${startColor};${endColor}`}
                    dur={loading ? "3s" : "4s"}
                    repeatCount="indefinite"
                  />
                )}
              </stop>
            </linearGradient>
          </defs>

          {/* 
            Outer Frame with Gap 
          */}
          <path
            d="M 10 3 H 8 C 5.23858 3 3 5.23858 3 8 V 16 C 3 18.7614 5.23858 21 8 21 H 16 C 18.7614 21 21 18.7614 21 16 V 8 C 21 5.23858 18.7614 3 16 3 H 15"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={loading ? "1" : undefined}
            strokeDasharray={loading ? "1 1" : undefined}
            style={loading ? { animation: "draw-path 3s ease-in-out infinite" } : {}}
            className={loading ? "" : "transition-all duration-500"}
          />

          {/* 
            Mountain Shape
            - Applies the secondary 'lag' animation to decouple it slightly from the frame's movement.
            - In loading state, uses draw-path with delay.
          */}
          <path
            d="M 3 13 L 8.5 8.5 L 12 12 L 15.5 9.5 L 21 14.5"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={loading ? "1" : undefined}
            strokeDasharray={loading ? "1 1" : undefined}
            style={
              loading
                ? { animation: "draw-path 3s ease-in-out infinite 0.4s" }
                : animated
                ? { animation: "gallery-mountain-lag 4s ease-in-out infinite" }
                : {}
            }
          />

          {/* 
            Sun/Moon Dot (only shown in loading state)
            Added to the upper right quadrant (typical for gallery icons).
            It bounces to provide a "heartbeat" to the loader.
          */}
          {loading && (
            <circle
              cx="16"
              cy="8"
              r="1.5"
              fill={`url(#${gradientId})`}
              style={{ animation: "sun-bounce 1.5s ease-in-out infinite" }}
            />
          )}
        </svg>
      </div>
    </>
  );
};

export default GalleryIcon;
