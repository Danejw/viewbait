"use client";

import React, { useState } from "react";

interface SearchIconProps {
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
 * Reusable SearchIcon component with customizable gradient colors and animations.
 * Features a magnifying glass with mountains inside, perfect for search-related UI elements.
 */
const SearchIcon = ({
  startColor = "#FF512F",
  endColor = "#F09819",
  size = 128,
  className = "",
  animated = true,
  showGlow = true,
  loading = false,
  style,
}: SearchIconProps) => {
  const [isZoomed, setIsZoomed] = useState(false);

  // Unique ID for the gradient
  const gradientId = `search-gradient-${startColor.replace("#", "")}-${endColor.replace("#", "")}`;

  // Helper to convert hex to rgba for the drop shadow glow
  const getShadowColor = (hex: string, alpha: number): string => {
    const isHex = /^#?([0-9A-F]{3}){1,2}$/i.test(hex);
    if (!isHex) return `rgba(240, 152, 25, ${alpha})`;

    let c = hex.substring(1).split("");
    if (c.length === 3) {
      c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    const num = parseInt(c.join(""), 16);

    return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
  };

  const shadowColor = getShadowColor(endColor, loading ? 0.4 : 0.3);

  // Handlers for click-and-hold behavior
  const handlePressStart = () => {
    if (!loading) {
      setIsZoomed(true);
    }
  };

  const handlePressEnd = () => {
    if (!loading) {
      setIsZoomed(false);
    }
  };

  return (
    <>
      {(animated || loading) && (
        <style>
          {loading
            ? `
            @keyframes draw-path {
              0% { stroke-dashoffset: 1; stroke-opacity: 0.1; }
              50% { stroke-dashoffset: 0; stroke-opacity: 1; }
              100% { stroke-dashoffset: -1; stroke-opacity: 0.1; }
            }
          `
            : `
            @keyframes search-scan {
              0% { transform: translate(0, 0) rotate(0deg); }
              25% { transform: translate(1px, -1px) rotate(3deg); }
              50% { transform: translate(0px, -2px) rotate(0deg); }
              75% { transform: translate(-1px, -1px) rotate(-3deg); }
              100% { transform: translate(0, 0) rotate(0deg); }
            }
            @keyframes mountain-appear {
              0%, 100% { opacity: 0.8; stroke-width: 2.5; }
              50% { opacity: 1; stroke-width: 3; }
            }
          `}
        </style>
      )}

      <div
        className={`flex items-center justify-center ${className} ${loading ? "" : "cursor-pointer"}`}
        style={style}
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
        onTouchCancel={handlePressEnd}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={loading ? "" : `transition-transform duration-500 ease-out ${isZoomed ? "" : "hover:scale-110"}`}
          style={{
            filter: showGlow ? `drop-shadow(0px ${loading ? 8 : 10}px 20px ${shadowColor})` : "none",
            transformOrigin: "center bottom",
            overflow: "visible", // Allow handle to extend beyond bounds when zoomed
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
            Main Group
            Handles the 'search' animation when idle. 
            Pauses when zoomed to allow for stable viewing.
          */}
          <g
            style={{
              animation: loading
                ? "none"
                : animated && !isZoomed
                ? "search-scan 5s ease-in-out infinite"
                : "none",
              transformOrigin: "10.5px 10.5px",
              transition: "transform 0.5s ease-in-out",
            }}
          >
            {/* 
              Glass Group (Circle + Handle)
              Separated so it can scale up independently of the inner content (mountains).
              This creates the 'zoom' effect where the glass gets bigger relative to the content.
            */}
            <g
              style={{
                transform: isZoomed ? "scale(1.4)" : "scale(1)",
                transformOrigin: "10.5px 10.5px",
                transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
              }}
            >
              {/* Glass Handle */}
              <path
                d="M 15.5 15.5 L 21 21"
                stroke={`url(#${gradientId})`}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={loading ? "1" : undefined}
                strokeDasharray={loading ? "1 1" : undefined}
                style={loading ? { animation: "draw-path 3s ease-in-out infinite 0.2s" } : {}}
              />

              {/* Glass Lens Circle */}
              <circle
                cx="10.5"
                cy="10.5"
                r="7"
                stroke={`url(#${gradientId})`}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                pathLength={loading ? "1" : undefined}
                strokeDasharray={loading ? "1 1" : undefined}
                style={loading ? { animation: "draw-path 3s ease-in-out infinite 0.1s" } : {}}
              />
            </g>

            {/* 
              The Thumbnail (Mountains) 
              Stays at original scale relative to the SVG container,
              effectively making the glass look like it has grown 'around' it.
            */}
            <path
              d="M 5.5 13.5 L 8.5 9.5 L 10.5 11.5 L 12.5 9.5 L 15.5 13.5"
              stroke={`url(#${gradientId})`}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              pathLength={loading ? "1" : undefined}
              strokeDasharray={loading ? "1 1" : undefined}
              style={
                loading
                  ? { animation: "draw-path 3s ease-in-out infinite 0.3s" }
                  : animated
                  ? { animation: "mountain-appear 3s ease-in-out infinite" }
                  : {}
              }
            />
          </g>
        </svg>
      </div>
    </>
  );
};

export default SearchIcon;
