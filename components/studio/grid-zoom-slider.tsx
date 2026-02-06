"use client";

/**
 * GridZoomSlider – reusable grid density slider with optional ZoomIn/ZoomOut icons.
 * Presentational; persistence is handled by parent or useGridZoom.
 */

import React, { memo } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { MIN_ZOOM, MAX_ZOOM } from "@/lib/utils/grid-zoom";
import { cn } from "@/lib/utils";

export interface GridZoomSliderProps {
  /** Current zoom level (0–8). */
  value: number;
  /** Called with [level] when slider changes (Radix Slider convention). */
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  /** Show ZoomIn/ZoomOut icons. Default true. */
  showIcons?: boolean;
  className?: string;
  /** Accessibility label for the slider. */
  "aria-label"?: string;
}

const DEFAULT_ARIA_LABEL = "Grid zoom: more thumbnails per row when zoomed out";

export const GridZoomSlider = memo(function GridZoomSlider({
  value,
  onValueChange,
  min = MIN_ZOOM,
  max = MAX_ZOOM,
  showIcons = true,
  className,
  "aria-label": ariaLabel = DEFAULT_ARIA_LABEL,
}: GridZoomSliderProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 min-w-0 items-center gap-1.5 sm:gap-3",
        className
      )}
    >
      {showIcons && (
        <ZoomIn
          className="h-4 w-4 shrink-0 text-muted-foreground hidden sm:block"
          aria-hidden
        />
      )}
      <div className="flex min-w-0 w-16 flex-col gap-0.5 sm:w-24 sm:gap-1 md:w-32">
        <Slider
          aria-label={ariaLabel}
          min={min}
          max={max}
          step={1}
          value={[value]}
          onValueChange={onValueChange}
          className="w-full min-w-0 touch-manipulation"
        />
      </div>
      {showIcons && (
        <ZoomOut
          className="h-4 w-4 shrink-0 text-muted-foreground hidden sm:block"
          aria-hidden
        />
      )}
    </div>
  );
});

export default GridZoomSlider;
