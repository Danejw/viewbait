"use client";

/**
 * ProjectCard Component
 *
 * Card for a single project in the Projects view. Matches the same grid/card
 * pattern as Styles/Palettes/Faces: Card layout, title, optional metadata,
 * actions (Use, Delete), and active state.
 *
 * @see style-thumbnail-card.tsx, palette-card-manage.tsx for layout pattern
 */

import React, { memo, useCallback } from "react";
import { FolderKanban, Check, Trash2, Share2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DbProject } from "@/lib/types/database";

/**
 * Skeleton card for loading state in the projects grid
 */
export function ProjectCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-1 h-3 w-1/2" />
      </CardHeader>
      <CardContent className="flex gap-2 pt-0">
        <Skeleton className="h-8 flex-1" />
        <Skeleton className="h-8 w-8" />
      </CardContent>
    </Card>
  );
}

export interface ProjectCardProps {
  /** The project to display */
  project: DbProject;
  /** Whether this project is the currently active one */
  isActive?: boolean;
  /** Callback when "Use" / "Select" is clicked */
  onUse: (id: string) => void;
  /** Callback when "Delete" is clicked */
  onDelete: (id: string) => void;
  /** Callback when "Share" is clicked (opens share dialog in parent) */
  onShare?: (project: DbProject) => void;
  /** Whether delete is in progress for this project */
  isDeleting?: boolean;
}

/**
 * Project card: name, optional metadata, Use and Delete actions.
 * Shows active state when isActive is true.
 */
export const ProjectCard = memo(function ProjectCard({
  project,
  isActive = false,
  onUse,
  onDelete,
  onShare,
  isDeleting = false,
}: ProjectCardProps) {
  const handleUse = useCallback(() => {
    onUse(project.id);
  }, [project.id, onUse]);

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete(project.id);
    },
    [project.id, onDelete]
  );

  const handleShare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onShare?.(project);
    },
    [project, onShare]
  );

  return (
    <Card
      className={cn(
        "group overflow-hidden transition-colors",
        isActive && "ring-2 ring-primary ring-offset-0"
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium" title={project.name}>
              {project.name}
            </span>
            {isActive && (
              <Badge variant="secondary" className="shrink-0 text-xs">
                Active
              </Badge>
            )}
          </div>
          {project.updated_at && (
            <p className="mt-1 truncate text-xs text-muted-foreground">
              Updated {new Date(project.updated_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2 pt-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="flex-1 min-w-0"
              onClick={handleUse}
            >
              <Check className="mr-1 h-3.5 w-3.5 shrink-0" />
              Use
            </Button>
          </TooltipTrigger>
          <TooltipContent>Switch to this project and open generator</TooltipContent>
        </Tooltip>
        {onShare && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={handleShare}
              >
                <Share2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Share project gallery</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete project</TooltipContent>
        </Tooltip>
      </CardContent>
    </Card>
  );
});
