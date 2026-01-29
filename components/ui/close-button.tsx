"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Reusable circular X icon button for closing modals, dialogs, sheets, and panels.
 * Uses primary (default) variant for prominence. Use with Radix Close (asChild) or standalone with onClick.
 */
const CloseButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(function CloseButton({ className, children, ...props }, ref) {
  return (
    <Button
      ref={ref}
      type="button"
      variant="default"
      size="icon-sm"
      aria-label="Close"
      className={cn("rounded-full", className)}
      {...props}
    >
      {children ?? (
        <>
          <XIcon className="size-3" />
          <span className="sr-only">Close</span>
        </>
      )}
    </Button>
  );
});

export { CloseButton };
