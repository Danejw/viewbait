"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isTourMode } from "@/tourkit/app/tourMode";

interface AnchorRect {
  anchor: string;
  top: number;
  left: number;
  width: number;
  height: number;
}

const OVERLAY_Z_INDEX = 2147483000;

function shouldRenderOverlay(): boolean {
  return isTourMode() && process.env.NEXT_PUBLIC_TOUR_OVERLAY !== "0";
}

function collectAnchorRects(): AnchorRect[] {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-tour]"));

  return nodes
    .map((node) => {
      const anchor = node.getAttribute("data-tour");
      if (!anchor) return null;

      const rect = node.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;

      return {
        anchor,
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      };
    })
    .filter((entry): entry is AnchorRect => Boolean(entry));
}

export function TourOverlay() {
  const enabled = useMemo(() => shouldRenderOverlay(), []);
  const [showLabels, setShowLabels] = useState(true);
  const [rects, setRects] = useState<AnchorRect[]>([]);

  const refresh = useCallback(() => {
    setRects(collectAnchorRects());
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const frameId = window.requestAnimationFrame(() => refresh());

    const observer = new MutationObserver(() => refresh());
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-tour", "style", "class"],
    });

    const handleResize = () => refresh();
    const handleScroll = () => refresh();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [enabled, refresh]);

  if (!enabled) return null;

  return (
    <>
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: OVERLAY_Z_INDEX,
        }}
      >
        {rects.map((rect, index) => (
          <div key={`${rect.anchor}-${index}`}>
            <div
              style={{
                position: "absolute",
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height,
                border: "2px dashed #2563eb",
                borderRadius: 4,
                boxSizing: "border-box",
                background: "rgba(37, 99, 235, 0.05)",
                pointerEvents: "none",
              }}
            />
            {showLabels && (
              <div
                style={{
                  position: "absolute",
                  top: Math.max(0, rect.top - 20),
                  left: rect.left,
                  padding: "2px 6px",
                  borderRadius: 4,
                  fontSize: 11,
                  lineHeight: "14px",
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  color: "#fff",
                  background: "rgba(30, 64, 175, 0.95)",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                  maxWidth: "90vw",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {rect.anchor}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowLabels((prev) => !prev)}
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: OVERLAY_Z_INDEX + 1,
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid rgba(37, 99, 235, 0.65)",
          background: "rgba(15, 23, 42, 0.9)",
          color: "#dbeafe",
          fontSize: 12,
          cursor: "pointer",
          pointerEvents: "auto",
        }}
      >
        Tour labels: {showLabels ? "ON" : "OFF"}
      </button>
    </>
  );
}
