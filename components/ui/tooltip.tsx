"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "@/lib/utils"

/** Pop-art tooltip shapes. Use "random" for a stable-but-varied shape per instance; "default" for the classic rounded box. */
const TOOLTIP_SHAPES = ["speech", "blob", "burst", "comic", "message"] as const
export type TooltipShape =
  | (typeof TOOLTIP_SHAPES)[number]
  | "random"
  | "default"

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  shape = "random",
  variant = "default",
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content> & {
  /** Pop-art shape variant. "random" (default) picks a stable shape per instance; "default" keeps the classic rounded box. */
  shape?: TooltipShape
  /** Visual significance: "primary" uses app primary (red) for actions, notifications, selected state. */
  variant?: "default" | "primary"
}) {
  const id = React.useId()
  const resolvedShape: (typeof TOOLTIP_SHAPES)[number] | "default" =
    shape === "random"
      ? TOOLTIP_SHAPES[hashString(id) % TOOLTIP_SHAPES.length]
      : shape === "default"
        ? "default"
        : shape

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        data-shape={resolvedShape}
        data-tooltip-variant={variant}
        sideOffset={sideOffset}
        className={cn(
          "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 rounded-md px-3 py-1.5 text-xs **:data-[slot=kbd]:rounded-md bg-foreground text-background z-50 w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin)",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow
          className="tooltip-arrow size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground z-50 translate-y-[calc(-50%_-_2px)]"
        />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
