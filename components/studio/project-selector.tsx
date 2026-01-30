"use client";

/**
 * ProjectSelector
 *
 * Reusable project selection control: None or one of the user's projects.
 * New thumbnails are assigned to the selected project (or none). Uses studio
 * activeProjectId state so it stays in sync with the generator and chat.
 *
 * Variants:
 * - inline: compact for headers (label + trigger, fixed width)
 * - form: for settings panel (label above, full width, optional helper text)
 */

import React, { useCallback, memo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStudio } from "@/components/studio/studio-provider";
import { cn } from "@/lib/utils";

export const PROJECT_NONE_VALUE = "__none__";

export interface ProjectSelectorProps {
  /** Layout variant: inline (compact for headers) or form (label above, full width) */
  variant?: "inline" | "form";
  /** Optional label text (inline shows next to trigger; form shows above) */
  label?: string;
  /** Show helper text below (form variant only): "New thumbnails will be saved to this project..." */
  showHelperText?: boolean;
  /** Optional class for the trigger (e.g. width) */
  triggerClassName?: string;
  /** Optional class for the root */
  className?: string;
}

function ProjectSelectorInner({
  variant = "form",
  label = "Project",
  showHelperText = false,
  triggerClassName,
  className,
}: ProjectSelectorProps) {
  const {
    data: { projects, projectsLoading },
    state: { activeProjectId },
    actions: { setActiveProjectId },
  } = useStudio();

  const value = activeProjectId ?? PROJECT_NONE_VALUE;

  const handleValueChange = useCallback(
    (v: string) => {
      setActiveProjectId(v === PROJECT_NONE_VALUE ? null : v);
    },
    [setActiveProjectId]
  );

  if (variant === "inline") {
    return (
      <div className={cn("flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2", className)}>
        {label && (
          <span className="text-sm text-muted-foreground shrink-0">{label}:</span>
        )}
        <Select value={value} onValueChange={handleValueChange} disabled={projectsLoading}>
          <SelectTrigger
            className={cn("h-8 w-full min-w-0 sm:w-[180px] sm:min-w-[180px] md:w-[200px]", triggerClassName)}
          >
            <SelectValue placeholder={projectsLoading ? "Loading..." : "None"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={PROJECT_NONE_VALUE}>None</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className={cn("mb-4", className)}>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      <Select value={value} onValueChange={handleValueChange} disabled={projectsLoading}>
        <SelectTrigger className={cn("w-full", triggerClassName)}>
          <SelectValue placeholder={projectsLoading ? "Loading..." : "None"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PROJECT_NONE_VALUE}>None</SelectItem>
          {projects.map((project) => (
            <SelectItem key={project.id} value={project.id}>
              {project.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {showHelperText && (
        <p className="mt-1 text-xs text-muted-foreground">
          New thumbnails will be saved to this project, or not assigned if None.
        </p>
      )}
    </div>
  );
}

export const ProjectSelector = memo(ProjectSelectorInner);
