"use client";

import React, { useState } from "react";
import { FolderOpen, Plus, Trash2 } from "lucide-react";
import { useStudio } from "@/components/studio/studio-provider";
import { useProjects } from "@/lib/hooks/useProjects";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Project switcher: "All thumbnails" or select a project.
 * Shows at top of sidebar; supports create and delete.
 */
export function StudioProjectSwitcher() {
  const {
    state: { activeProjectId, leftSidebarCollapsed },
    data: { projects, projectsLoading, activeProjectId: dataActiveProjectId },
    actions: { setActiveProjectId },
  } = useStudio();
  const { createProject, deleteProject } = useProjects();

  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeId = activeProjectId ?? dataActiveProjectId ?? null;
  const activeProject = activeId ? projects.find((p) => p.id === activeId) : null;
  const displayLabel = activeProject ? activeProject.name : "All thumbnails";

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name || isCreating) return;
    setIsCreating(true);
    try {
      const project = await createProject({ name });
      if (project?.id) {
        setActiveProjectId(project.id);
        setNewProjectOpen(false);
        setNewProjectName("");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (deletingId) return;
    setDeletingId(projectId);
    try {
      const ok = await deleteProject(projectId);
      if (ok && activeId === projectId) {
        setActiveProjectId(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  if (leftSidebarCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <div className="border-b border-sidebar-border p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" className="w-full justify-center">
                    <FolderOpen className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="right" align="start" className="min-w-[200px]">
                  <DropdownMenuItem onClick={() => setActiveProjectId(null)}>
                    All thumbnails
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {projectsLoading ? (
                    <DropdownMenuItem disabled>Loading...</DropdownMenuItem>
                  ) : (
                    projects.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => setActiveProjectId(p.id)}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="truncate">{p.name}</span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-6 w-6 shrink-0"
                          onClick={(e) => handleDeleteProject(e, p.id)}
                          disabled={deletingId === p.id}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </DropdownMenuItem>
                    ))
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setNewProjectOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    New project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TooltipTrigger>
            <TooltipContent side="right">{displayLabel}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    );
  }

  return (
    <>
      <div className="border-b border-sidebar-border p-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-between gap-2 text-left font-normal"
            >
              <FolderOpen className="h-4 w-4 shrink-0" />
              <span className="truncate flex-1">{projectsLoading ? "..." : displayLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="start" className="min-w-[220px]">
            <DropdownMenuItem onClick={() => setActiveProjectId(null)}>
              All thumbnails
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {projectsLoading ? (
              <DropdownMenuItem disabled>Loading projects...</DropdownMenuItem>
            ) : (
              projects.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => setActiveProjectId(p.id)}
                  className={cn(activeId === p.id && "bg-sidebar-primary text-sidebar-primary-foreground")}
                >
                  <span className="truncate flex-1">{p.name}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="h-6 w-6 shrink-0 opacity-70 hover:opacity-100"
                    onClick={(e) => handleDeleteProject(e, p.id)}
                    disabled={deletingId === p.id}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              ))
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setNewProjectOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="e.g. Q1 video"
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateProject} disabled={!newProjectName.trim() || isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
