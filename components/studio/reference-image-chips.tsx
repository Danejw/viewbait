"use client";

import { CloseButton } from "@/components/ui/close-button";
import { cn } from "@/lib/utils";
import type { ReferenceImageEntry } from "@/lib/hooks/useReferenceImageUpload";

export interface ReferenceImageChipsProps {
  entries: ReferenceImageEntry[];
  onRemove: (index: number) => void;
  disabled?: boolean;
  className?: string;
}

export function ReferenceImageChips({
  entries,
  onRemove,
  disabled = false,
  className,
}: ReferenceImageChipsProps) {
  if (entries.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {entries.map((entry, index) => (
        <div
          key={`${entry.previewUrl}-${index}`}
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted"
        >
          <img
            src={entry.previewUrl}
            alt=""
            className="h-full w-full object-cover"
          />
          {!disabled && (
            <CloseButton
              size="small"
              onClick={() => onRemove(index)}
              className="absolute right-0.5 top-0.5"
              aria-label="Remove reference image"
            />
          )}
        </div>
      ))}
    </div>
  );
}
