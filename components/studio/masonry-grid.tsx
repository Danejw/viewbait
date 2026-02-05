"use client";

/**
 * MasonryGrid – reusable masonry layout (left-to-right, top-down).
 * Uses react-masonry-css. Items must have intrinsic height (e.g. aspect-ratio on cards).
 */

import React from "react";
import Masonry from "react-masonry-css";
import { cn } from "@/lib/utils";

export interface MasonryGridBreakpoints {
  default: number;
  [key: number]: number;
}

export interface MasonryGridProps {
  children: React.ReactNode;
  /** Column count or responsive breakpoints (keys = max width px, values = columns). */
  breakpointCols: number | MasonryGridBreakpoints;
  /** Gap between items (px). Applied as horizontal gutter and vertical margin. */
  gap?: number;
  className?: string;
  /** Optional: class for each masonry column. */
  columnClassName?: string;
}

const DEFAULT_GAP = 12;

export function MasonryGrid({
  children,
  breakpointCols,
  gap = DEFAULT_GAP,
  className,
  columnClassName,
}: MasonryGridProps) {
  const childArray = React.Children.toArray(children);
  const containerStyle = { marginLeft: -gap };
  const columnStyle = { paddingLeft: gap };
  const itemStyle = { marginBottom: gap };

  return (
    <Masonry
      breakpointCols={breakpointCols}
      className={cn("flex w-auto", className)}
      style={containerStyle}
      columnClassName={cn(columnClassName)}
      columnAttrs={{ style: columnStyle }}
    >
      {childArray.map((child, index) => (
        <div key={index} style={itemStyle}>
          {child}
        </div>
      ))}
    </Masonry>
  );
}
