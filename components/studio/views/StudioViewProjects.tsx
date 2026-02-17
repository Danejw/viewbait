"use client";

/**
 * StudioViewProjects
 * Projects view - lists all user projects in a card grid.
 */

import React, { useState, useCallback, useEffect, memo } from "react";
import { useStudio } from "@/components/studio/studio-provider";
import { ViewControls, ViewHeader } from "@/components/studio/view-controls";
import { ProjectCard, ProjectCardSkeleton } from "@/components/studio/project-card";
import { ShareProjectDialog } from "@/components/studio/share-project-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FolderKanban, Plus, RefreshCw } from "lucide-react";
import { useProjects } from "@/lib/hooks/useProjects";
import type { DbProject } from "@/lib/types/database";
import { emitTourEvent } from "@/tourkit/app/tourEvents.browser";

function StudioViewProjects() {
  const {
    state: { activeProjectId },
    actions: { setActiveProjectId, setView },
  } = useStudio();
  const {
    projects,
    isLoading,
    error,
    refetch,
    createProject,
    deleteProject,
  } = useProjects();

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [shareDialogProject, setShareDialogProject] = useState<DbProject | null>(null);

  const handleRefresh = useCallback(() => refetch(), [refetch]);

  const handleUse = useCallback(
    (id: string) => {
      setActiveProjectId(id);
      setView("generator");
    },
    [setActiveProjectId, setView]
  );

  const handleDeleteClick = useCallback((id: string) => setDeleteConfirmId(id), []);

  const handleShare = useCallback((project: DbProject) => setShareDialogProject(project), []);

  const handleDeleteConfirm = useCallback(async () => {
    const id = deleteConfirmId;
    if (!id) return;
    setDeletingId(id);
    try {
      const ok = await deleteProject(id);
      if (ok && activeProjectId === id) setActiveProjectId(null);
      setDeleteConfirmId(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }, [deleteConfirmId, deleteProject, activeProjectId, setActiveProjectId]);

  useEffect(() => {
    emitTourEvent("tour.event.route.ready", {
      routeKey: "studio.projects",
      anchorsPresent: ["tour.studio.projects.grid.container.main"],
    });
  }, []);

  const handleCreateSubmit = useCallback(async () => {
    const name = createName.trim();
    if (!name || isCreating) return;
    setIsCreating(true);
    try {
      const project = await createProject({ name });
      if (project?.id) {
        setCreateOpen(false);
        setCreateName("");
        setActiveProjectId(project.id);
        setView("generator");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreating(false);
    }
  }, [createName, isCreating, createProject, setActiveProjectId, setView]);

  if (error) {
    return (
      <div data-tour="tour.studio.projects.grid.container.main">
        <ViewHeader
          title="Projects"
          description="Organize thumbnails by project and reuse settings"
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">{error.message || "Failed to load projects"}</p>
            <Button variant="outline" onClick={handleRefresh} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div data-tour="tour.studio.projects.grid.container.main">
      <ViewHeader
        title="Projects"
        description="Organize thumbnails by project and reuse settings"
        count={projects.length}
        countLabel="projects"
      />
      <ViewControls
        showSearch={false}
        showFilter={false}
        showSort={false}
        showFavorites={false}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
        showRefresh={true}
        onAdd={() => setCreateOpen(true)}
        addLabel="New project"
        showAdd={true}
        className="mb-6"
      />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">No projects yet</h3>
            <p className="mb-4 max-w-sm text-center text-muted-foreground">
              Create a project to group thumbnails and save default settings.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first project
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project: DbProject) => (
            <ProjectCard
              key={project.id}
              project={project}
              isActive={activeProjectId === project.id}
              onUse={handleUse}
              onDelete={handleDeleteClick}
              onShare={handleShare}
              isDeleting={deletingId === project.id}
            />
          ))}
        </div>
      )}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="projects-view-project-name">Name</Label>
            <Input
              id="projects-view-project-name"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Q1 video"
              onKeyDown={(e) => e.key === "Enter" && handleCreateSubmit()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={!createName.trim() || isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              Thumbnails in this project will not be deleted; they will be unassigned from the
              project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deletingId !== null}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingId ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {shareDialogProject && (
        <ShareProjectDialog
          project={shareDialogProject}
          open={!!shareDialogProject}
          onOpenChange={(open) => !open && setShareDialogProject(null)}
        />
      )}
    </div>
  );
}

export default memo(StudioViewProjects);
