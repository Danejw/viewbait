"use client";

/**
 * Faces Hook (React Query)
 * 
 * Provides face data and CRUD operations using React Query for caching and deduplication.
 * Accepts initial data from SSR to avoid duplicate requests.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import * as facesService from "@/lib/services/faces";
import type { DbFace } from "@/lib/types/database";

export interface UseFacesOptions {
  autoFetch?: boolean;
  initialData?: DbFace[]; // Initial data from SSR
}

export interface UseFacesReturn {
  faces: DbFace[];
  isLoading: boolean;
  error: Error | null;
  
  // Actions
  fetchFaces: () => Promise<void>;
  createFace: (name: string, images?: File[]) => Promise<DbFace | null>;
  updateFace: (id: string, data: Parameters<typeof facesService.updateFace>[1]) => Promise<DbFace | null>;
  deleteFace: (id: string) => Promise<boolean>;
  addImage: (faceId: string, file: File) => Promise<string | null>;
  removeImage: (faceId: string, imageUrl: string) => Promise<boolean>;
  updateName: (id: string, name: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useFaces(options: UseFacesOptions = {}): UseFacesReturn {
  const { autoFetch = true, initialData } = options;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query keys for React Query cache
  const facesQueryKey = ['faces', user?.id];

  /**
   * Main query for user's faces
   */
  const {
    data: facesData,
    isLoading: facesLoading,
    error: facesError,
    refetch: refetchFaces,
  } = useQuery({
    queryKey: facesQueryKey,
    queryFn: async () => {
      if (!user) {
        return [];
      }
      const { faces: data, error } = await facesService.getFaces(user.id);
      if (error) {
        throw error;
      }
      return data;
    },
    enabled: autoFetch && !!user,
    initialData: initialData,
    staleTime: 10 * 60 * 1000, // 10 minutes - faces rarely change
    gcTime: 30 * 60 * 1000, // 30 minutes cache time
    refetchOnWindowFocus: false,
  });

  // Derive data from queries
  const faces = facesData || [];

  /**
   * Mutation for creating a face with images
   */
  const createWithImagesMutation = useMutation({
    mutationFn: ({ userId, name, images }: { userId: string; name: string; images: File[] }) =>
      facesService.createFaceWithImages(userId, name, images),
    onSuccess: (result) => {
      if (result.face) {
        queryClient.invalidateQueries({ queryKey: facesQueryKey });
      }
    },
  });

  /**
   * Mutation for creating a face without images
   */
  const createMutation = useMutation({
    mutationFn: facesService.createFace,
    onSuccess: (result) => {
      if (result.face) {
        queryClient.invalidateQueries({ queryKey: facesQueryKey });
      }
    },
  });

  /**
   * Mutation for updating a face
   */
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof facesService.updateFace>[1] }) =>
      facesService.updateFace(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facesQueryKey });
    },
  });

  /**
   * Mutation for deleting a face
   */
  const deleteMutation = useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      facesService.deleteFace(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facesQueryKey });
    },
  });

  /**
   * Mutation for adding an image to a face
   */
  const addImageMutation = useMutation({
    mutationFn: ({ faceId, userId, file }: { faceId: string; userId: string; file: File }) =>
      facesService.addFaceImage(faceId, userId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facesQueryKey });
    },
  });

  /**
   * Mutation for removing an image from a face
   */
  const removeImageMutation = useMutation({
    mutationFn: ({ faceId, imageUrl }: { faceId: string; imageUrl: string }) =>
      facesService.removeFaceImage(faceId, imageUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facesQueryKey });
    },
  });

  /**
   * Mutation for updating face name
   */
  const updateNameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      facesService.updateFaceName(id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: facesQueryKey });
    },
  });

  // Action wrappers to maintain backward compatibility

  const fetchFaces = async () => {
    await refetchFaces();
  };

  const createFace = async (name: string, images?: File[]): Promise<DbFace | null> => {
    if (!user) return null;

    try {
      if (images && images.length > 0) {
        const result = await createWithImagesMutation.mutateAsync({
          userId: user.id,
          name,
          images,
        });
        return result.face || null;
      } else {
        const result = await createMutation.mutateAsync({
          user_id: user.id,
          name,
          image_urls: [],
        });
        return result.face || null;
      }
    } catch {
      return null;
    }
  };

  const updateFace = async (
    id: string,
    data: Parameters<typeof facesService.updateFace>[1]
  ): Promise<DbFace | null> => {
    try {
      const result = await updateMutation.mutateAsync({ id, data });
      return result.face || null;
    } catch {
      return null;
    }
  };

  const deleteFace = async (id: string): Promise<boolean> => {
    if (!user) return false;
    try {
      await deleteMutation.mutateAsync({ id, userId: user.id });
      return true;
    } catch {
      return false;
    }
  };

  const addImage = async (faceId: string, file: File): Promise<string | null> => {
    if (!user) return null;
    try {
      const result = await addImageMutation.mutateAsync({
        faceId,
        userId: user.id,
        file,
      });
      return result.imageUrl || null;
    } catch {
      return null;
    }
  };

  const removeImage = async (faceId: string, imageUrl: string): Promise<boolean> => {
    try {
      await removeImageMutation.mutateAsync({ faceId, imageUrl });
      return true;
    } catch {
      return false;
    }
  };

  const updateName = async (id: string, name: string): Promise<boolean> => {
    try {
      await updateNameMutation.mutateAsync({ id, name });
      return true;
    } catch {
      return false;
    }
  };

  const refresh = async () => {
    await refetchFaces();
  };

  // Combine loading and error states
  const isLoading = facesLoading || 
    createMutation.isPending || 
    createWithImagesMutation.isPending ||
    updateMutation.isPending || 
    deleteMutation.isPending || 
    addImageMutation.isPending ||
    removeImageMutation.isPending ||
    updateNameMutation.isPending;

  const error = (facesError as Error | null) || 
    (createMutation.error as Error | null) || 
    (createWithImagesMutation.error as Error | null) ||
    (updateMutation.error as Error | null) || 
    (deleteMutation.error as Error | null) ||
    (addImageMutation.error as Error | null) ||
    (removeImageMutation.error as Error | null) ||
    (updateNameMutation.error as Error | null);

  return {
    faces,
    isLoading,
    error,
    fetchFaces,
    createFace,
    updateFace,
    deleteFace,
    addImage,
    removeImage,
    updateName,
    refresh,
  };
}
