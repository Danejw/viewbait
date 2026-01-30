"use client";

import * as React from "react";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type CloseButtonSize = "small" | "medium" | "large";

const SIZE_TO_BUTTON: Record<CloseButtonSize, React.ComponentProps<typeof Button>["size"]> = {
  small: "icon-xs",
  medium: "icon-sm",
  large: "icon-lg",
};

const SIZE_TO_ICON_CLASS: Record<CloseButtonSize, string> = {
  small: "size-2.5",
  medium: "size-3",
  large: "size-4",
};

export type CloseButtonProps = Omit<React.ComponentProps<typeof Button>, "size"> & {
  /** small = icon-xs, medium = icon-sm (default), large = icon-lg */
  size?: CloseButtonSize;
};

/**
 * Reusable circular X icon button for closing modals, dialogs, sheets, and panels.
 * Uses primary (default) variant for prominence. Use with Radix Close (asChild) or standalone with onClick.
 * Size: small, medium (default), or large for use in different parts of the app.
 */
const CloseButton = React.forwardRef<HTMLButtonElement, CloseButtonProps>(function CloseButton(
  { className, children, size = "medium", ...props },
  ref
) {
  const buttonSize = SIZE_TO_BUTTON[size];
  const iconClass = SIZE_TO_ICON_CLASS[size];

  return (
    <Button
      ref={ref}
      type="button"
      variant="default"
      size={buttonSize}
      aria-label="Close"
      className={cn("rounded-full", className)}
      {...props}
    >
      {children ?? (
        <>
          <XIcon className={iconClass} />
          <span className="sr-only">Close</span>
        </>
      )}
    </Button>
  );
});

export { CloseButton };
