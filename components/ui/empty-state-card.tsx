"use client";

/**
 * EmptyStateCard
 *
 * Reusable empty state: Card with icon, title, optional description,
 * and optional primary action + "Upgrade to unlock" link.
 * Used in browse tabs and studio views (styles, palettes, faces).
 */

import React from "react";
import { Lock, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateCardProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  /** When provided, shows a primary CTA (e.g. "Create Your First Style") */
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    showLock?: boolean;
  };
  /** When provided and primary is disabled, shows "Upgrade to unlock" link */
  onUpgradeClick?: () => void;
  className?: string;
}

export function EmptyStateCard({
  icon,
  title,
  description,
  primaryAction,
  onUpgradeClick,
  className,
}: EmptyStateCardProps) {
  const showActions = primaryAction || onUpgradeClick;
  const showUpgradeLink = onUpgradeClick && primaryAction?.disabled;

  return (
    <Card className={cn(className)}>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="mb-4 flex h-12 w-12 items-center justify-center text-muted-foreground [&>svg]:h-12 [&>svg]:w-12">
          {icon}
        </div>
        <h3 className="mb-2 text-lg font-medium">{title}</h3>
        {description && (
          <p className="mb-4 max-w-sm text-center text-muted-foreground">{description}</p>
        )}
        {showActions && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            {primaryAction && (
              <Button
                onClick={primaryAction.disabled ? undefined : primaryAction.onClick}
                disabled={primaryAction.disabled}
                className="gap-2"
              >
                {primaryAction.showLock && <Lock className="h-4 w-4 shrink-0" />}
                <Plus className="h-4 w-4" />
                {primaryAction.label}
              </Button>
            )}
            {showUpgradeLink && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-primary"
                onClick={onUpgradeClick}
              >
                Upgrade to unlock
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
