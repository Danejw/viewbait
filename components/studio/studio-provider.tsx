"use client";

import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { useThumbnailGeneration } from "@/lib/hooks/useThumbnailGeneration";
import { useThumbnails, useDeleteThumbnail, useToggleFavorite } from "@/lib/hooks/useThumbnails";
import { useFaces } from "@/lib/hooks/useFaces";
import { useAuth } from "@/lib/hooks/useAuth";
import type { Thumbnail, PublicStyle, DbStyle, PublicPalette, DbPalette, DbFace } from "@/lib/types/database";
import { DeleteConfirmationModal } from "@/components/studio/delete-confirmation-modal";
import { ThumbnailEditModal, type ThumbnailEditData } from "@/components/studio/thumbnail-edit-modal";
import { ImageModal, PaletteViewModal } from "@/components/ui/modal";

/**
 * Studio View Types
 * All views available in the SPA
 */
export type StudioView =
  | "generator"
  | "gallery"
  | "browse"
  | "styles"
  | "palettes"
  | "faces"
  | "youtube";

/**
 * Studio State Interface
 * Defines the shape of state managed by StudioProvider
 */
export interface StudioState {
  // Current view/page in the SPA
  currentView: StudioView;
  // Generation mode: 'manual' | 'chat'
  mode: "manual" | "chat";
  // Sidebar collapse states
  leftSidebarCollapsed: boolean;
  rightSidebarCollapsed: boolean;
  // Chat assistant state
  chatAssistant: {
    isOpen: boolean;
    conversationHistory: Array<{
      role: "user" | "assistant";
      content: string;
      uiComponents?: string[];
      formStateUpdates?: Record<string, any>;
    }>;
    isProcessing: boolean;
  };
  // Thumbnail text input
  thumbnailText: string;
  // Custom instructions
  customInstructions: string;
  // Face selection
  includeFaces: boolean;
  selectedFaces: string[];
  // Expression and pose for faces
  faceExpression: string;
  facePose: string;
  // Style and palette selection
  includeStyles: boolean;
  selectedStyle: string | null;
  includePalettes: boolean;
  selectedPalette: string | null;
  selectedAspectRatio: string;
  selectedResolution: string;
  variations: number;
  styleReferences: string[];
  // Loading state
  isGenerating: boolean;
  // Generation error
  generationError: string | null;
  // Modal state
  deleteModalOpen: boolean;
  editModalOpen: boolean;
  imageModalOpen: boolean;
  thumbnailToDelete: Thumbnail | null;
  thumbnailToEdit: Thumbnail | null;
  thumbnailToView: Thumbnail | null;
  isDeleting: boolean;
  isRegenerating: boolean;
  // Style modal state
  styleImageModalOpen: boolean;
  styleToView: PublicStyle | DbStyle | null;
  // Palette view modal state
  paletteViewModalOpen: boolean;
  paletteToView: PublicPalette | DbPalette | null;
}

/**
 * Studio Actions Interface
 * Defines actions that can modify studio state
 */
export interface StudioActions {
  // View navigation
  setView: (view: StudioView) => void;
  // Generation mode
  setMode: (mode: "manual" | "chat") => void;
  // Sidebar collapse
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  // Chat assistant
  openChatAssistant: () => void;
  closeChatAssistant: () => void;
  sendChatMessage: (message: string) => Promise<void>;
  // Form state
  setThumbnailText: (text: string) => void;
  setCustomInstructions: (instructions: string) => void;
  setIncludeFaces: (include: boolean) => void;
  toggleFace: (faceId: string) => void;
  setFaceExpression: (expression: string) => void;
  setFacePose: (pose: string) => void;
  setIncludeStyles: (include: boolean) => void;
  setSelectedStyle: (styleId: string | null) => void;
  setIncludePalettes: (include: boolean) => void;
  setSelectedPalette: (paletteId: string | null) => void;
  setSelectedAspectRatio: (ratio: string) => void;
  setSelectedResolution: (resolution: string) => void;
  setVariations: (count: number) => void;
  setStyleReferences: (references: string[]) => void;
  addStyleReference: (url: string) => void;
  removeStyleReference: (index: number) => void;
  // Generation
  generateThumbnails: () => Promise<void>;
  // Thumbnail actions
  onFavoriteToggle: (id: string) => void;
  onDeleteThumbnail: (id: string) => void;
  onDownloadThumbnail: (id: string) => void;
  onShareThumbnail: (id: string) => void;
  onCopyThumbnail: (id: string) => void;
  onEditThumbnail: (thumbnail: Thumbnail) => void;
  // Modal actions
  closeDeleteModal: () => void;
  confirmDelete: () => Promise<void>;
  closeEditModal: () => void;
  onRegenerateThumbnail: (data: ThumbnailEditData) => Promise<void>;
  onViewThumbnail: (thumbnail: Thumbnail) => void;
  closeImageModal: () => void;
  // Style actions
  onViewStyle: (style: PublicStyle | DbStyle) => void;
  closeStyleImageModal: () => void;
  // Palette view actions
  onViewPalette: (palette: PublicPalette | DbPalette) => void;
  closePaletteViewModal: () => void;
  // Face view actions
  onViewFace: (face: DbFace) => void;
  closeFaceImageModal: () => void;
  // Clear error
  clearError: () => void;
  // Apply form state updates from assistant
  applyFormStateUpdates: (updates: Record<string, any>) => void;
  // Reset chat and optionally form state (e.g. when user clicks Reset in chat panel)
  resetChat: (clearForm?: boolean) => void;
}

/**
 * Studio Meta Interface
 * Defines metadata and refs for studio components
 */
export interface StudioMeta {
  thumbnailTextRef: React.RefObject<HTMLInputElement>;
  customInstructionsRef: React.RefObject<HTMLTextAreaElement>;
}

/**
 * Studio Data Interface
 * Defines data from hooks for consumption by components
 */
export interface StudioData {
  // Current user ID for ownership checks
  currentUserId: string | undefined;
  // Thumbnails from database
  thumbnails: Thumbnail[];
  thumbnailsLoading: boolean;
  thumbnailsError: Error | null;
  // Items currently being generated (skeleton state)
  generatingItems: Map<string, Thumbnail>;
  // Pagination
  hasNextPage: boolean;
  fetchNextPage: () => void;
  isFetchingNextPage: boolean;
  // Refresh function
  refreshThumbnails: () => Promise<void>;
}

/**
 * Studio Context Value
 * Complete interface for dependency injection
 */
export interface StudioContextValue {
  state: StudioState;
  actions: StudioActions;
  meta: StudioMeta;
  data: StudioData;
}

const StudioContext = createContext<StudioContextValue | null>(null);

/**
 * Hook to access Studio context
 * Throws if used outside StudioProvider
 */
export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error("useStudio must be used within StudioProvider");
  }
  return context;
}

/**
 * Hook for thumbnail-specific actions
 * Provides all actions needed by ThumbnailCard without prop drilling
 */
export function useThumbnailActions() {
  const { actions, data } = useStudio();
  return {
    currentUserId: data.currentUserId,
    onFavoriteToggle: actions.onFavoriteToggle,
    onDownload: actions.onDownloadThumbnail,
    onShare: actions.onShareThumbnail,
    onCopy: actions.onCopyThumbnail,
    onEdit: actions.onEditThumbnail,
    onDelete: actions.onDeleteThumbnail,
    onView: actions.onViewThumbnail,
  };
}

/**
 * Hook for style-specific actions
 * Provides all actions needed by StyleThumbnailCard without prop drilling
 */
export function useStyleActions() {
  const { actions, data } = useStudio();
  return {
    currentUserId: data.currentUserId,
    onView: actions.onViewStyle,
    onUseStyle: actions.setSelectedStyle,
  };
}

/**
 * Hook for palette-specific actions (view modal, etc.)
 */
export function usePaletteActions() {
  const { actions, data } = useStudio();
  return {
    currentUserId: data.currentUserId,
    onViewPalette: actions.onViewPalette,
  };
}

/**
 * StudioProvider
 * Lifts state management into a provider component.
 * UI components consume the context interface, not the implementation.
 * 
 * Integrates with:
 * - useThumbnailGeneration for API calls with optimistic UI
 * - useThumbnails for React Query data fetching
 * - useAuth for user context
 */
export function StudioProvider({ children }: { children: React.ReactNode }) {
  // Auth hook for user context
  const { user, isAuthenticated } = useAuth();
  
  // Thumbnail generation hook
  const {
    state: generationState,
    generate,
    clearGeneratingItems,
    removeGeneratingItem,
    clearError: clearGenerationError,
  } = useThumbnailGeneration();

  // Thumbnails data hook (React Query)
  // Uses default sorting (created_at desc) for the generator results view
  const {
    thumbnails,
    isLoading: thumbnailsLoading,
    isError,
    error: thumbnailsError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refreshFirstPage,
    invalidateAll: invalidateAllThumbnails,
  } = useThumbnails({
    userId: user?.id,
    enabled: isAuthenticated,
    limit: 24,
  });

  // Faces data hook (React Query)
  // Used to look up face image URLs when generating
  const { faces } = useFaces();

  // Mutation hooks
  const deleteMutation = useDeleteThumbnail();
  const favoriteMutation = useToggleFavorite();

  const [state, setState] = useState<StudioState>({
    currentView: "generator",
    mode: "manual",
    leftSidebarCollapsed: false,
    rightSidebarCollapsed: false,
    chatAssistant: {
      isOpen: false,
      conversationHistory: [],
      isProcessing: false,
    },
    thumbnailText: "",
    customInstructions: "",
    includeFaces: false,
    selectedFaces: [],
    faceExpression: "None",
    facePose: "None",
    includeStyles: false,
    selectedStyle: null,
    includePalettes: false,
    selectedPalette: null,
    selectedAspectRatio: "16:9",
    selectedResolution: "1K",
    variations: 1,
    styleReferences: [],
    isGenerating: false,
    generationError: null,
    // Modal state
    deleteModalOpen: false,
    editModalOpen: false,
    imageModalOpen: false,
    thumbnailToDelete: null,
    thumbnailToEdit: null,
    thumbnailToView: null,
    isDeleting: false,
    isRegenerating: false,
    // Style modal state
    styleImageModalOpen: false,
    styleToView: null,
    // Palette view modal state
    paletteViewModalOpen: false,
    paletteToView: null,
    // Face view modal state
    faceImageModalOpen: false,
    faceToView: null,
  });

  // Sync generation state
  React.useEffect(() => {
    setState((s) => ({
      ...s,
      isGenerating: generationState.isGenerating,
      generationError: generationState.error,
    }));
  }, [generationState.isGenerating, generationState.error]);

  const thumbnailTextRef = useRef<HTMLInputElement>(null);
  const customInstructionsRef = useRef<HTMLTextAreaElement>(null);

  // Memoized refresh function
  // Uses invalidateAllThumbnails to refresh ALL thumbnail queries (including gallery with different sorting)
  const refreshThumbnails = useCallback(async () => {
    // Invalidate all thumbnail queries to refresh both generator view and gallery view
    await invalidateAllThumbnails();
    // Clear generating items after refresh so they don't show as duplicates
    // Wait a bit for React Query cache to propagate
    setTimeout(() => {
      clearGeneratingItems();
    }, 500);
  }, [invalidateAllThumbnails, clearGeneratingItems]);

  // Generate thumbnails action
  const generateThumbnails = useCallback(async () => {
    if (!state.thumbnailText.trim()) {
      setState((s) => ({ ...s, generationError: "Please enter thumbnail text" }));
      return;
    }

    // Build face characters from selected faces
    // Each selected face becomes a character with its reference images (up to 3 per face)
    // The API expects: faceCharacters: Array<{ images: string[] }> where images are actual URLs
    let faceCharacters: Array<{ images: string[] }> | undefined;
    
    if (state.includeFaces && state.selectedFaces.length > 0) {
      faceCharacters = state.selectedFaces
        .map((faceId) => {
          // Look up the face object to get its image_urls
          const face = faces.find((f) => f.id === faceId);
          if (face && face.image_urls && face.image_urls.length > 0) {
            // Return the face's actual image URLs (up to 3 per face)
            return { images: face.image_urls };
          }
          return null;
        })
        .filter((fc): fc is { images: string[] } => fc !== null && fc.images.length > 0);

      // If no valid faces with images, set to undefined
      if (faceCharacters.length === 0) {
        faceCharacters = undefined;
      }
    }

    const results = await generate({
      thumbnailText: state.thumbnailText,
      customInstructions: state.customInstructions,
      selectedStyle: state.includeStyles ? state.selectedStyle : null,
      selectedPalette: state.includePalettes ? state.selectedPalette : null,
      selectedAspectRatio: state.selectedAspectRatio,
      selectedResolution: state.selectedResolution,
      variations: state.variations,
      styleReferences: state.styleReferences.length > 0 ? state.styleReferences : undefined,
      faceCharacters,
      expression: state.includeFaces && state.faceExpression !== "None" ? state.faceExpression : null,
      pose: state.includeFaces && state.facePose !== "None" ? state.facePose : null,
    });

    // Refresh thumbnails after generation completes
    if (results.some((r) => r.success)) {
      await refreshThumbnails();
    }
  }, [state, generate, refreshThumbnails, faces]);

  // Thumbnail action handlers
  const onFavoriteToggle = useCallback((id: string) => {
    favoriteMutation.mutate(id);
  }, [favoriteMutation]);

  const onDeleteThumbnail = useCallback((id: string) => {
    // Open confirmation modal instead of deleting directly
    const thumbnail = thumbnails.find((t) => t.id === id);
    if (thumbnail) {
      setState((s) => ({
        ...s,
        deleteModalOpen: true,
        thumbnailToDelete: thumbnail,
      }));
    }
  }, [thumbnails]);

  const closeDeleteModal = useCallback(() => {
    setState((s) => ({
      ...s,
      deleteModalOpen: false,
      thumbnailToDelete: null,
    }));
  }, []);

  const confirmDelete = useCallback(async () => {
    const thumbnailId = state.thumbnailToDelete?.id;
    if (!thumbnailId) return;

    setState((s) => ({ ...s, isDeleting: true }));
    
    try {
      await deleteMutation.mutateAsync(thumbnailId);
      setState((s) => ({
        ...s,
        deleteModalOpen: false,
        thumbnailToDelete: null,
        isDeleting: false,
      }));
    } catch (error) {
      console.error("Error deleting thumbnail:", error);
      setState((s) => ({ ...s, isDeleting: false }));
    }
  }, [state.thumbnailToDelete?.id, deleteMutation]);

  const onDownloadThumbnail = useCallback((id: string) => {
    // Find the thumbnail and trigger download
    const thumbnail = thumbnails.find((t) => t.id === id);
    if (thumbnail?.imageUrl) {
      const link = document.createElement("a");
      link.href = thumbnail.imageUrl;
      link.download = `${thumbnail.name || "thumbnail"}.png`;
      link.click();
    }
  }, [thumbnails]);

  const onShareThumbnail = useCallback((id: string) => {
    // Copy URL to clipboard for sharing
    const thumbnail = thumbnails.find((t) => t.id === id);
    if (thumbnail?.imageUrl) {
      navigator.clipboard.writeText(thumbnail.imageUrl);
      // Could add toast notification here
    }
  }, [thumbnails]);

  const onCopyThumbnail = useCallback((id: string) => {
    // Copy image URL to clipboard
    const thumbnail = thumbnails.find((t) => t.id === id);
    if (thumbnail?.imageUrl) {
      navigator.clipboard.writeText(thumbnail.imageUrl);
      // Could add toast notification here
    }
  }, [thumbnails]);

  const onEditThumbnail = useCallback((thumbnail: Thumbnail) => {
    setState((s) => ({
      ...s,
      editModalOpen: true,
      thumbnailToEdit: thumbnail,
    }));
  }, []);

  const closeEditModal = useCallback(() => {
    setState((s) => ({
      ...s,
      editModalOpen: false,
      thumbnailToEdit: null,
    }));
  }, []);

  const onRegenerateThumbnail = useCallback(async (data: ThumbnailEditData) => {
    const thumbnail = state.thumbnailToEdit;
    if (!thumbnail) return;

    setState((s) => ({ ...s, isRegenerating: true }));

    try {
      // Regenerate creates a NEW thumbnail with the edited settings
      // We use the generate function with the custom prompt and title
      const results = await generate({
        thumbnailText: data.title,
        customInstructions: data.customPrompt || state.customInstructions,
        selectedStyle: state.includeStyles ? state.selectedStyle : null,
        selectedPalette: state.includePalettes ? state.selectedPalette : null,
        selectedAspectRatio: state.selectedAspectRatio,
        selectedResolution: state.selectedResolution,
        variations: 1, // Only generate one variation for regeneration
      });

      // Close modal and refresh thumbnails
      if (results.some((r) => r.success)) {
        await refreshThumbnails();
      }

      setState((s) => ({
        ...s,
        editModalOpen: false,
        thumbnailToEdit: null,
        isRegenerating: false,
      }));
    } catch (error) {
      console.error("Error regenerating thumbnail:", error);
      setState((s) => ({ ...s, isRegenerating: false }));
    }
  }, [state.thumbnailToEdit, state.customInstructions, state.includeStyles, state.selectedStyle, state.includePalettes, state.selectedPalette, state.selectedAspectRatio, state.selectedResolution, generate, refreshThumbnails]);

  // Image modal handlers
  const onViewThumbnail = useCallback((thumbnail: Thumbnail) => {
    setState((s) => ({
      ...s,
      imageModalOpen: true,
      thumbnailToView: thumbnail,
    }));
  }, []);

  const closeImageModal = useCallback(() => {
    setState((s) => ({
      ...s,
      imageModalOpen: false,
    }));
    // Delay clearing thumbnail to allow exit animation
    setTimeout(() => {
      setState((s) => ({ ...s, thumbnailToView: null }));
    }, 300);
  }, []);

  // Style modal handlers
  const onViewStyle = useCallback((style: PublicStyle | DbStyle) => {
    setState((s) => ({
      ...s,
      styleImageModalOpen: true,
      styleToView: style,
    }));
  }, []);

  const closeStyleImageModal = useCallback(() => {
    setState((s) => ({
      ...s,
      styleImageModalOpen: false,
    }));
    // Delay clearing style to allow exit animation
    setTimeout(() => {
      setState((s) => ({ ...s, styleToView: null }));
    }, 300);
  }, []);

  // Palette view modal handlers
  const onViewPalette = useCallback((palette: PublicPalette | DbPalette) => {
    setState((s) => ({
      ...s,
      paletteViewModalOpen: true,
      paletteToView: palette,
    }));
  }, []);

  const closePaletteViewModal = useCallback(() => {
    setState((s) => ({
      ...s,
      paletteViewModalOpen: false,
    }));
    setTimeout(() => {
      setState((s) => ({ ...s, paletteToView: null }));
    }, 300);
  }, []);

  // Face view modal handlers
  const onViewFace = useCallback((face: DbFace) => {
    setState((s) => ({
      ...s,
      faceImageModalOpen: true,
      faceToView: face,
    }));
  }, []);

  const closeFaceImageModal = useCallback(() => {
    setState((s) => ({
      ...s,
      faceImageModalOpen: false,
    }));
    setTimeout(() => {
      setState((s) => ({ ...s, faceToView: null }));
    }, 300);
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, generationError: null }));
    clearGenerationError();
  }, [clearGenerationError]);

  const actions: StudioActions = {
    setView: (view) => setState((s) => ({ ...s, currentView: view })),
    setMode: (mode) => setState((s) => ({ ...s, mode })),
    toggleLeftSidebar: () =>
      setState((s) => ({ ...s, leftSidebarCollapsed: !s.leftSidebarCollapsed })),
    toggleRightSidebar: () =>
      setState((s) => ({ ...s, rightSidebarCollapsed: !s.rightSidebarCollapsed })),
    openChatAssistant: () =>
      setState((s) => ({
        ...s,
        chatAssistant: { ...s.chatAssistant, isOpen: true },
        mode: "chat",
      })),
    closeChatAssistant: () =>
      setState((s) => ({
        ...s,
        chatAssistant: { ...s.chatAssistant, isOpen: false },
      })),
    sendChatMessage: async (message: string) => {
      setState((s) => ({
        ...s,
        chatAssistant: {
          ...s.chatAssistant,
          isProcessing: true,
          conversationHistory: [
            ...s.chatAssistant.conversationHistory,
            { role: "user", content: message },
          ],
        },
      }));

      try {
        // Build form state for API
        const formState = {
          thumbnailText: state.thumbnailText,
          includeFace: state.includeFaces,
          selectedFaces: state.selectedFaces,
          expression: state.faceExpression !== "None" ? state.faceExpression : null,
          pose: state.facePose !== "None" ? state.facePose : null,
          styleReferences: state.styleReferences,
          selectedStyle: state.selectedStyle,
          selectedColor: state.includePalettes ? state.selectedPalette : null,
          selectedAspectRatio: state.selectedAspectRatio,
          selectedResolution: state.selectedResolution,
          variations: state.variations,
          customInstructions: state.customInstructions,
        };

        const response = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationHistory: [
              ...state.chatAssistant.conversationHistory,
              { role: "user", content: message },
            ],
            formState,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to send chat message");
        }

        const data = await response.json();

        // Apply form state updates if provided
        if (data.form_state_updates) {
          actions.applyFormStateUpdates(data.form_state_updates);
        }

        setState((s) => ({
          ...s,
          chatAssistant: {
            ...s.chatAssistant,
            isProcessing: false,
            conversationHistory: [
              ...s.chatAssistant.conversationHistory,
              { role: "user", content: message },
              {
                role: "assistant",
                content: data.human_readable_message,
                uiComponents: data.ui_components,
                formStateUpdates: data.form_state_updates,
              },
            ],
          },
        }));
      } catch (error) {
        console.error("Error sending chat message:", error);
        setState((s) => ({
          ...s,
          chatAssistant: {
            ...s.chatAssistant,
            isProcessing: false,
            conversationHistory: [
              ...s.chatAssistant.conversationHistory,
              { role: "user", content: message },
              {
                role: "assistant",
                content: "Sorry, I encountered an error. Please try again.",
              },
            ],
          },
        }));
      }
    },
    setThumbnailText: (text) => setState((s) => ({ ...s, thumbnailText: text })),
    setCustomInstructions: (instructions) =>
      setState((s) => ({ ...s, customInstructions: instructions })),
    setIncludeFaces: (include) => setState((s) => ({ ...s, includeFaces: include })),
    toggleFace: (faceId) =>
      setState((s) => ({
        ...s,
        selectedFaces: s.selectedFaces.includes(faceId)
          ? s.selectedFaces.filter((id) => id !== faceId)
          : [...s.selectedFaces, faceId],
      })),
    setFaceExpression: (expression) => setState((s) => ({ ...s, faceExpression: expression })),
    setFacePose: (pose) => setState((s) => ({ ...s, facePose: pose })),
    setIncludeStyles: (include) => setState((s) => ({ ...s, includeStyles: include })),
    setSelectedStyle: (styleId) => setState((s) => ({ ...s, selectedStyle: styleId })),
    setIncludePalettes: (include) => setState((s) => ({ ...s, includePalettes: include })),
    setSelectedPalette: (paletteId) => setState((s) => ({ ...s, selectedPalette: paletteId })),
    setSelectedAspectRatio: (ratio) => setState((s) => ({ ...s, selectedAspectRatio: ratio })),
    setSelectedResolution: (resolution) =>
      setState((s) => ({ ...s, selectedResolution: resolution })),
    setVariations: (count) => setState((s) => ({ ...s, variations: count })),
    setStyleReferences: (references) => setState((s) => ({ ...s, styleReferences: references })),
    addStyleReference: (url) =>
      setState((s) =>
        s.styleReferences.length < 10 ? { ...s, styleReferences: [...s.styleReferences, url] } : s
      ),
    removeStyleReference: (index) =>
      setState((s) => ({
        ...s,
        styleReferences: s.styleReferences.filter((_, i) => i !== index),
      })),
    generateThumbnails,
    onFavoriteToggle,
    onDeleteThumbnail,
    onDownloadThumbnail,
    onShareThumbnail,
    onCopyThumbnail,
    onEditThumbnail,
    closeDeleteModal,
    confirmDelete,
    closeEditModal,
    onRegenerateThumbnail,
    onViewThumbnail,
    closeImageModal,
    onViewStyle,
    closeStyleImageModal,
    onViewPalette,
    closePaletteViewModal,
    onViewFace,
    closeFaceImageModal,
    clearError,
    applyFormStateUpdates: (updates) => {
      setState((s) => {
        const newState = { ...s };
        if (updates.thumbnailText !== undefined) newState.thumbnailText = updates.thumbnailText;
        if (updates.includeFace !== undefined) newState.includeFaces = updates.includeFace;
        if (updates.includeStyles !== undefined) newState.includeStyles = updates.includeStyles;
        if (updates.selectedStyle !== undefined) newState.selectedStyle = updates.selectedStyle;
        if (updates.includePalettes !== undefined) newState.includePalettes = updates.includePalettes;
        if (updates.selectedColor !== undefined) newState.selectedPalette = updates.selectedColor;
        if (updates.selectedAspectRatio !== undefined)
          newState.selectedAspectRatio = updates.selectedAspectRatio;
        if (updates.selectedResolution !== undefined)
          newState.selectedResolution = updates.selectedResolution;
        if (updates.variations !== undefined) newState.variations = updates.variations;
        if (updates.customInstructions !== undefined)
          newState.customInstructions = updates.customInstructions;
        if (updates.expression !== undefined)
          newState.faceExpression = updates.expression || "None";
        if (updates.pose !== undefined) newState.facePose = updates.pose || "None";
        return newState;
      });
    },
    resetChat: (clearForm) => {
      setState((s) => ({
        ...s,
        chatAssistant: {
          ...s.chatAssistant,
          conversationHistory: [],
          isProcessing: false,
        },
        ...(clearForm
          ? {
              thumbnailText: "",
              customInstructions: "",
              includeFaces: false,
              selectedFaces: [] as string[],
              faceExpression: "None",
              facePose: "None",
              includeStyles: false,
              selectedStyle: null as string | null,
              includePalettes: false,
              selectedPalette: null as string | null,
              selectedAspectRatio: "16:9",
              selectedResolution: "1K",
              variations: 1,
              styleReferences: [] as string[],
            }
          : {}),
      }));
    },
  };

  const meta: StudioMeta = {
    thumbnailTextRef,
    customInstructionsRef,
  };

  const data: StudioData = {
    currentUserId: user?.id,
    thumbnails,
    thumbnailsLoading,
    thumbnailsError: isError ? (thumbnailsError as Error) : null,
    generatingItems: generationState.generatingItems,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refreshThumbnails,
  };

  return (
    <StudioContext.Provider value={{ state, actions, meta, data }}>
      {children}
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        open={state.deleteModalOpen}
        onOpenChange={(open) => {
          if (!open) closeDeleteModal();
        }}
        thumbnail={state.thumbnailToDelete}
        onConfirm={confirmDelete}
        isDeleting={state.isDeleting}
      />
      
      {/* Edit/Regenerate Modal */}
      <ThumbnailEditModal
        open={state.editModalOpen}
        onOpenChange={(open) => {
          if (!open) closeEditModal();
        }}
        thumbnail={state.thumbnailToEdit}
        onRegenerate={onRegenerateThumbnail}
        isRegenerating={state.isRegenerating}
      />
      
      {/* Image View Modal */}
      {state.thumbnailToView && (
        <ImageModal
          open={state.imageModalOpen}
          onOpenChange={(open) => {
            if (!open) closeImageModal();
          }}
          src={state.thumbnailToView.imageUrl}
          alt={state.thumbnailToView.name}
          title={state.thumbnailToView.name}
        />
      )}
      
      {/* Style Image View Modal */}
      {state.styleToView && state.styleToView.preview_thumbnail_url && (
        <ImageModal
          open={state.styleImageModalOpen}
          onOpenChange={(open) => {
            if (!open) closeStyleImageModal();
          }}
          src={state.styleToView.preview_thumbnail_url}
          alt={state.styleToView.name}
          title={state.styleToView.name}
        />
      )}

      {/* Palette View Modal */}
      {state.paletteToView && (
        <PaletteViewModal
          open={state.paletteViewModalOpen}
          onOpenChange={(open) => {
            if (!open) closePaletteViewModal();
          }}
          name={state.paletteToView.name}
          colors={state.paletteToView.colors}
        />
      )}

      {/* Face Image View Modal */}
      {state.faceToView && state.faceToView.image_urls?.[0] && (
        <ImageModal
          open={state.faceImageModalOpen}
          onOpenChange={(open) => {
            if (!open) closeFaceImageModal();
          }}
          src={state.faceToView.image_urls[0]}
          alt={state.faceToView.name}
          title={state.faceToView.name}
        />
      )}
    </StudioContext.Provider>
  );
}
