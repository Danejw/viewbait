"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "@/lib/utils"

/**
 * Toggle switch (on/off). Uses Radix data-state="checked" | "unchecked".
 * Styled for clear visual distinction: unchecked = muted track + thumb left,
 * checked = primary track + thumb right.
 */
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "shrink-0 rounded-full border border-transparent outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "aria-invalid:ring-2 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        "data-[state=unchecked]:bg-muted data-[state=unchecked]:border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary",
        "data-[size=default]:h-6 data-[size=default]:w-11 data-[size=sm]:h-5 data-[size=sm]:w-9",
        "peer group/switch relative inline-flex items-center after:absolute after:-inset-x-3 after:-inset-y-2",
        "data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full ring-0 transition-transform",
          "bg-background shadow-sm border border-border/50",
          "data-[state=checked]:bg-primary-foreground data-[state=checked]:border-primary-foreground/30",
          "group-data-[size=default]/switch:size-5 group-data-[size=default]/switch:data-[state=unchecked]:translate-x-0.5 group-data-[size=default]/switch:data-[state=checked]:translate-x-[calc(100%-2px)]",
          "group-data-[size=sm]/switch:size-4 group-data-[size=sm]/switch:data-[state=unchecked]:translate-x-0.5 group-data-[size=sm]/switch:data-[state=checked]:translate-x-[calc(100%-2px)]"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
