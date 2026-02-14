"use client";

/**
 * Projects Hook (React Query)
 *
 * Provides project list and CRUD operations for the project-based workflow.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import * as projectsService from "@/lib/services/projects";
import type { DbProject, ProjectDefaultSettings } from "@/lib/types/database";

export const projectsQueryKeys = {
  all: ["projects"] as const,
  list: () => [...projectsQueryKeys.all, "list"] as const,
};

export const sharedProjectGalleryQueryKeys = {
  all: ["shared-project-gallery"] as const,
  slug: (slug: string) => [...sharedProjectGalleryQueryKeys.all, slug] as const,
};

export const sharedProjectGalleryAccessQueryKeys = {
  all: ["shared-project-gallery-access"] as const,
  slug: (slug: string) => ["shared-project-gallery-access", slug] as const,
};

export interface UseProjectsReturn {
  projects: DbProject[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
  createProject: (payload: projectsService.CreateProjectPayload) => Promise<DbProject | null>;
  updateProject: (id: string, payload: projectsService.UpdateProjectPayload) => Promise<DbProject | null>;
  deleteProject: (id: string) => Promise<boolean>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}

export function useProjects(): UseProjectsReturn {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    data: projects = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: projectsQueryKeys.list(),
    queryFn: async () => {
      const result = await projectsService.getProjects();
      if (result.error) throw result.error;
      return result.projects;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5,
  });

  const createMutation = useMutation({
    mutationFn: projectsService.createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKeys.all });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: projectsService.UpdateProjectPayload }) =>
      projectsService.updateProject(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKeys.all });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: projectsService.deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectsQueryKeys.all });
    },
  });

  const createProjectFn = async (payload: projectsService.CreateProjectPayload) => {
    const result = await createMutation.mutateAsync(payload);
    return result.project;
  };

  const updateProjectFn = async (id: string, payload: projectsService.UpdateProjectPayload) => {
    const result = await updateMutation.mutateAsync({ id, payload });
    return result.project;
  };

  const deleteProjectFn = async (id: string) => {
    const { error } = await deleteMutation.mutateAsync(id);
    return !error;
  };

  return {
    projects,
    isLoading,
    error: error instanceof Error ? error : null,
    refetch,
    createProject: createProjectFn,
    updateProject: updateProjectFn,
    deleteProject: deleteProjectFn,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

const SHARED_GALLERY_POLL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Hook for fetching a shared project gallery by slug. Sends credentials so
 * the server can include canComment and projectId when the user is authenticated.
 * Refetches every 2 minutes while the tab is visible; no refetch on window focus.
 */
export function useSharedProjectGallery(slug: string | null) {
  const [isTabVisible, setIsTabVisible] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const onVisibilityChange = () => {
      setIsTabVisible(document.visibilityState !== "hidden");
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const query = useQuery({
    queryKey: sharedProjectGalleryQueryKeys.slug(slug ?? ""),
    queryFn: async () => {
      if (!slug) return null;
      const result = await projectsService.getSharedProjectGallery(slug);
      if (result.error) throw result.error;
      return result.data;
    },
    enabled: !!slug,
    staleTime: SHARED_GALLERY_POLL_MS,
    refetchInterval: isTabVisible ? SHARED_GALLERY_POLL_MS : false,
    refetchOnWindowFocus: false,
  });

  const data = query.data ?? null;
  return {
    data,
    canComment: data?.canComment ?? false,
    projectId: data?.projectId ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
}

/**
 * Hook for current user's access to a shared project gallery (can comment + projectId).
 * Only runs when user is logged in and slug is set.
 */
export function useSharedProjectGalleryAccess(slug: string | null) {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: sharedProjectGalleryAccessQueryKeys.slug(slug ?? ""),
    queryFn: async () => {
      if (!slug) return { canComment: false as const, projectId: null as string | null };
      const result = await projectsService.getSharedProjectGalleryAccess(slug);
      if (result.error) throw result.error;
      return {
        canComment: result.canComment,
        projectId: result.projectId,
      };
    },
    enabled: !!user && !!slug,
    staleTime: 1000 * 60 * 2,
  });

  return {
    canComment: query.data?.canComment ?? false,
    projectId: query.data?.projectId ?? null,
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
}

export type { ProjectDefaultSettings };
