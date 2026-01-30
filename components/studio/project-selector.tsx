"use client";

/**
 * ProjectSelector
 *
 * Reusable project selection control: None or one of the user's projects.
 * New thumbnails are assigned to the selected project (or none). Uses studio
 * activeProjectId state so it stays in sync with the generator and chat.
 * Includes a primary "Create a new project" button to the right of the dropdown.
 *
 * Variants:
 * - inline: compact for headers (label + trigger, fixed width)
 * - form: for settings panel (label above, full width, optional helper text)
 */

import React, { useCallback, memo, useState } from "react";
import { Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStudio } from "@/components/studio/studio-provider";
import { useProjects } from "@/lib/hooks/useProjects";
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
  const { createProject } = useProjects();

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const value = activeProjectId ?? PROJECT_NONE_VALUE;

  const handleValueChange = useCallback(
    (v: string) => {
      setActiveProjectId(v === PROJECT_NONE_VALUE ? null : v);
    },
    [setActiveProjectId]
  );

  const handleCreateProject = useCallback(async () => {
    const name = createName.trim();
    if (!name || isCreating) return;
    setIsCreating(true);
    try {
      const project = await createProject({ name });
      if (project?.id) {
        setActiveProjectId(project.id);
        setCreateOpen(false);
        setCreateName("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  }, [createName, isCreating, createProject, setActiveProjectId]);

  const selectBlock = (
    <Select value={value} onValueChange={handleValueChange} disabled={projectsLoading}>
      <SelectTrigger
        className={cn(
          variant === "inline"
            ? "h-8 w-full min-w-0 sm:w-[180px] sm:min-w-[180px] md:w-[200px]"
            : "w-full",
          triggerClassName
        )}
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
  );

  const createButton = (
    <Button
      type="button"
      variant="default"
      size={variant === "inline" ? "icon" : "default"}
      className={cn(
        variant === "inline" && "h-7 w-7 shrink-0 p-0 flex items-center justify-center [&_svg]:size-4"
      )}
      onClick={() => setCreateOpen(true)}
      title="Create a new project"
    >
      <Plus />
    </Button>
  );

  if (variant === "inline") {
    return (
      <>
        <div
          className={cn(
            "flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2",
            className
          )}
        >
          {label && (
            <span className="text-sm text-muted-foreground shrink-0">{label}:</span>
          )}
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {selectBlock}
            {createButton}
          </div>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor="project-selector-create-name">Name</Label>
              <Input
                id="project-selector-create-name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g. Q1 video"
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateProject}
                disabled={!createName.trim() || isCreating}
              >
                {isCreating ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className={cn("mb-4", className)}>
        <label className="mb-2 block text-sm font-medium">{label}</label>
        <div className="flex gap-2">
          {selectBlock}
          {createButton}
        </div>
        {showHelperText && (
          <p className="mt-1 text-xs text-muted-foreground">
            New thumbnails will be saved to this project, or not assigned if None.
          </p>
        )}
      </div>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="project-selector-create-name-form">Name</Label>
            <Input
              id="project-selector-create-name-form"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Q1 video"
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!createName.trim() || isCreating}
            >
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const ProjectSelector = memo(ProjectSelectorInner);
