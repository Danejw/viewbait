"use client";

/**
 * Thumbnail Comments Hooks
 *
 * useThumbnailComments: fetch comments for a thumbnail (when modal is open).
 * usePostThumbnailComment: mutation to post a comment; invalidates comments and optional shared gallery.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as thumbnailsService from "@/lib/services/thumbnails";
import type { ThumbnailComment } from "@/lib/types/database";
import { sharedProjectGalleryQueryKeys } from "./useProjects";

export const thumbnailCommentsQueryKeys = {
  all: ["thumbnail-comments"] as const,
  /** projectIdOrOwner: use projectId when in project context, or 'owner' for owner-only (no project). */
  key: (thumbnailId: string, projectIdOrOwner: string) =>
    ["thumbnail-comments", thumbnailId, projectIdOrOwner] as const,
};

export interface UseThumbnailCommentsOptions {
  enabled?: boolean;
}

/**
 * Fetches comments for a thumbnail. Enable when modal is open and user has access.
 * When projectId is null, uses owner-only API path (thumbnail owner can read comments in studio).
 */
export function useThumbnailComments(
  thumbnailId: string | null,
  projectId: string | null,
  options: UseThumbnailCommentsOptions = {}
) {
  const { enabled = true } = options;
  const projectIdOrOwner = projectId ?? "owner";
  const query = useQuery({
    queryKey: thumbnailCommentsQueryKeys.key(thumbnailId ?? "", projectIdOrOwner),
    queryFn: async (): Promise<ThumbnailComment[]> => {
      if (!thumbnailId) return [];
      const result = await thumbnailsService.getThumbnailComments(thumbnailId, projectId ?? null);
      if (result.error) throw result.error;
      return result.comments;
    },
    enabled: !!thumbnailId && enabled,
  });

  return {
    comments: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error instanceof Error ? query.error : null,
    refetch: query.refetch,
  };
}

export interface UsePostThumbnailCommentOptions {
  /** When set, invalidates shared gallery cache after posting (e.g. shared gallery slug). */
  slug?: string | null;
}

/**
 * Mutation to post a comment. On success invalidates comments and optionally shared gallery.
 */
export function usePostThumbnailComment(options: UsePostThumbnailCommentOptions = {}) {
  const { slug } = options;
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      thumbnailId,
      projectId,
      comment,
    }: {
      thumbnailId: string;
      projectId: string;
      comment: string;
    }) => thumbnailsService.postThumbnailComment(thumbnailId, projectId, comment),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: thumbnailCommentsQueryKeys.key(variables.thumbnailId, variables.projectId),
      });
      if (slug) {
        queryClient.invalidateQueries({ queryKey: sharedProjectGalleryQueryKeys.slug(slug) });
      }
    },
  });

  return {
    postComment: mutation.mutateAsync,
    isPosting: mutation.isPending,
    error: mutation.error instanceof Error ? mutation.error : null,
  };
}
