"use client";

import { useEffect, useState } from "react";
import { isTourMode } from "@/tourkit/app/tourMode";

type AnchorBox = {
  anchor: string;
  top: number;
  left: number;
  width: number;
  height: number;
};

function readAnchors(): AnchorBox[] {
  if (typeof window === "undefined") return [];

  return Array.from(document.querySelectorAll<HTMLElement>("[data-tour]"))
    .map((node) => {
      const anchor = node.dataset.tour;
      if (!anchor) return null;
      const rect = node.getBoundingClientRect();
      return {
        anchor,
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      };
    })
    .filter((entry): entry is AnchorBox => Boolean(entry));
}

export function TourOverlay() {
  const [boxes, setBoxes] = useState<AnchorBox[]>([]);

  useEffect(() => {
    if (!isTourMode()) return;

    const refresh = () => {
      setBoxes(readAnchors());
    };

    refresh();

    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh);
    };
  }, []);

  if (!isTourMode()) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[2147483646]">
      {boxes.map((box) => (
        <div
          key={`${box.anchor}-${box.top}-${box.left}`}
          className="absolute border border-fuchsia-500 bg-fuchsia-500/5"
          style={{
            top: box.top,
            left: box.left,
            width: Math.max(box.width, 8),
            height: Math.max(box.height, 8),
          }}
        >
          <span className="absolute -top-5 left-0 max-w-[320px] truncate rounded bg-fuchsia-600 px-1.5 py-0.5 font-mono text-[10px] text-white">
            {box.anchor}
          </span>
        </div>
      ))}
    </div>
  );
}
