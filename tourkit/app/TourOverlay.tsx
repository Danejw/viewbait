"use client";

import { useEffect, useMemo, useState } from "react";
import { isTourModeActive } from "@/tourkit/app/tourMode";

type AnchorBox = {
  anchor: string;
  rect: DOMRect;
  index: number;
};

const OUTLINE_COLOR = "#3b82f6";

export function TourOverlay() {
  const [enabled, setEnabled] = useState(true);
  const [boxes, setBoxes] = useState<AnchorBox[]>([]);

  const shouldRender = useMemo(() => {
    if (!isTourModeActive()) return false;
    return process.env.NEXT_PUBLIC_TOUR_OVERLAY !== "0";
  }, []);

  useEffect(() => {
    if (!shouldRender) return;

    const collect = () => {
      const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-tour]"));
      const next: AnchorBox[] = nodes
        .map((node, index) => {
          const anchor = node.getAttribute("data-tour")?.trim();
          if (!anchor) return null;

          const rect = node.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) return null;

          return { anchor, rect, index } satisfies AnchorBox;
        })
        .filter((item): item is AnchorBox => item != null);

      setBoxes(next);
    };

    collect();

    const observer = new MutationObserver(() => collect());
    observer.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["data-tour", "style", "class"],
    });

    const onScroll = () => collect();
    const onResize = () => collect();

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);

    const interval = window.setInterval(collect, 500);

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      window.clearInterval(interval);
    };
  }, [shouldRender]);

  if (!shouldRender) return null;

  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2147483000,
          pointerEvents: "none",
        }}
      >
        {boxes.map((box) => (
          <div
            key={`${box.anchor}-${box.index}`}
            style={{
              position: "fixed",
              left: box.rect.left,
              top: box.rect.top,
              width: box.rect.width,
              height: box.rect.height,
              outline: `2px dashed ${OUTLINE_COLOR}`,
              outlineOffset: 1,
              borderRadius: 4,
              boxSizing: "border-box",
              pointerEvents: "none",
              background: "rgba(59,130,246,0.05)",
            }}
          >
            {enabled ? (
              <span
                style={{
                  position: "absolute",
                  left: 0,
                  top: -22,
                  maxWidth: "min(60vw, 560px)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontSize: 11,
                  lineHeight: 1,
                  color: "white",
                  background: "rgba(30,41,59,0.95)",
                  border: `1px solid ${OUTLINE_COLOR}`,
                  borderRadius: 4,
                  padding: "4px 6px",
                  pointerEvents: "none",
                }}
              >
                {box.anchor}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setEnabled((prev) => !prev)}
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 2147483647,
          border: `1px solid ${OUTLINE_COLOR}`,
          borderRadius: 6,
          background: "rgba(15,23,42,0.95)",
          color: "white",
          fontSize: 12,
          lineHeight: 1,
          padding: "10px 12px",
          cursor: "pointer",
        }}
      >
        Tour overlay labels: {enabled ? "on" : "off"}
      </button>
    </>
  );
}

export default TourOverlay;
