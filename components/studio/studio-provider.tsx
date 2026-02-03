"use client";

import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useTransition } from "react";
import { useThumbnailGeneration } from "@/lib/hooks/useThumbnailGeneration";
import { getGenerateCooldownMs } from "@/lib/constants/subscription-tiers";
import { useThumbnails, useDeleteThumbnail, useToggleFavorite } from "@/lib/hooks/useThumbnails";
import { useFaces } from "@/lib/hooks/useFaces";
import { useAuth } from "@/lib/hooks/useAuth";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { useProjects } from "@/lib/hooks/useProjects";
import type {
  ProjectDefaultSettings,
  Thumbnail,
  PublicStyle,
  DbStyle,
  PublicPalette,
  DbPalette,
  DbFace,
  DbProject,
  DbThumbnail,
} from "@/lib/types/database";
import * as thumbnailsService from "@/lib/services/thumbnails";
import { toast } from "sonner";
import { useWatermarkedImage } from "@/lib/hooks/useWatermarkedImage";
import { applyQrWatermark } from "@/lib/utils/watermarkUtils";
import { DeleteConfirmationModal } from "@/components/studio/delete-confirmation-modal";
import { ThumbnailEditModal, type ThumbnailEditData } from "@/components/studio/thumbnail-edit-modal";
import { YouTubeVideoAnalyticsModal } from "@/components/studio/youtube-video-analytics-modal";
import { ImageModal, PaletteViewModal } from "@/components/ui/modal";
import { SnapshotViewModal } from "@/components/studio/snapshot-view-modal";
import {
  analyzeYouTubeVideo,
  type YouTubeVideoAnalytics,
} from "@/lib/services/youtube-video-analyze";

/** Payload for opening the snapshot view modal (full-size image, draggable to Faces/References) */
export interface SnapshotToView {
  videoId: string;
  index: number;
  characterName?: string;
  placeName?: string;
  imageBlobUrl: string;
  blob: Blob;
}

/**
 * Studio View Types
 * All views available in the SPA
 */
export type StudioView =
  | "generator"
  | "gallery"
  | "browse"
  | "projects"
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
  // Left sidebar width (px) when expanded; user can resize via drag
  leftSidebarWidth: number;
  // Right settings panel width (px) when expanded; user can resize via drag
  rightSidebarWidth: number;
  // Mobile layout: which panel is visible (results = center content, settings = right sidebar content)
  mobilePanel: "results" | "settings";
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
  includeStyleReferences: boolean;
  styleReferences: string[];
  // Loading state
  isGenerating: boolean;
  // Generate button disabled during tier-based cooldown after submission
  isButtonDisabled: boolean;
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
  // Face view modal state
  faceImageModalOpen: boolean;
  faceToView: DbFace | null;
  // YouTube video analytics modal (Gemini video understanding)
  videoAnalyticsModalOpen: boolean;
  videoAnalyticsVideo: { videoId: string; title: string; thumbnailUrl: string } | null;
  videoAnalyticsData: YouTubeVideoAnalytics | null;
  videoAnalyticsLoading: boolean;
  videoAnalyticsError: string | null;
  /** Cache of analytics by videoId; session-only, cleared on refresh */
  videoAnalyticsCache: Record<string, YouTubeVideoAnalytics>;
  /** Video ids currently being analyzed (drives spinners and effect) */
  videoAnalyticsLoadingVideoIds: string[];
  /** Metadata for each loading id so completion can set modal video */
  videoAnalyticsLoadingVideos: Record<string, { videoId: string; title: string; thumbnailUrl: string; channel?: { title: string; description?: string } }>;
  /** Channel context for the analytics modal (set when opening from YouTube My channel). */
  videoAnalyticsChannelContext: { title: string; description?: string } | null;
  /** Cache of thumbnail style descriptions by imageUrl or thumbnailId; session-only, avoids re-analyzing */
  thumbnailStyleAnalysisCache: Record<string, string>;
  /** Character snapshots from video frame extraction (FFmpeg.wasm); session-only, keyed by videoId */
  characterSnapshotsByVideoId: Record<string, Array<{ characterName: string; imageBlobUrl: string; blob: Blob }>>;
  /** Place snapshots from video frame extraction (FFmpeg.wasm); session-only, keyed by videoId */
  placeSnapshotsByVideoId: Record<string, Array<{ placeName: string; imageBlobUrl: string; blob: Blob }>>;
  /** Snapshot view modal (full-size image, draggable to Faces/References) */
  snapshotViewModalOpen: boolean;
  snapshotToView: SnapshotToView | null;
  /** When set, open create-face modal with this file pre-filled (e.g. from dropping a snapshot on Faces) */
  pendingFaceFromSnapshot: File | null;
  /** Suggested name when opening create-face from a snapshot (e.g. character name) */
  pendingFaceDefaultName: string | null;
  // Active project (null = All thumbnails)
  activeProjectId: string | null;
  /** Set when generation completes successfully; consumed by onboarding to advance to step 5 */
  lastGeneratedThumbnail: Thumbnail | null;
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
  setLeftSidebarWidth: (width: number) => void;
  setRightSidebarWidth: (width: number) => void;
  // Mobile panel (results | settings)
  setMobilePanel: (panel: "results" | "settings") => void;
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
  setIncludeStyleReferences: (include: boolean) => void;
  setStyleReferences: (references: string[]) => void;
  addStyleReference: (url: string) => void;
  /** Upload a blob (e.g. from a snapshot) to storage and add as style reference */
  addStyleReferenceFromBlob: (blob: Blob) => Promise<void>;
  removeStyleReference: (index: number) => void;
  // Generation
  generateThumbnails: () => Promise<void>;
  /** Remove a failed generating item from the grid (e.g. Dismiss on error card) */
  removeGeneratingItem: (id: string) => void;
  // Thumbnail actions
  onFavoriteToggle: (id: string) => void;
  onDeleteThumbnail: (id: string) => void;
  onDownloadThumbnail: (id: string) => void;
  onShareThumbnail: (id: string) => void;
  onCopyThumbnail: (id: string) => void;
  onEditThumbnail: (thumbnail: Thumbnail) => void;
  onAddToProject: (id: string, projectId: string | null, previousProjectId?: string | null) => void;
  /** Analyze thumbnail style and append description to custom instructions. Returns success/cached for card border feedback. */
  onAnalyzeThumbnailForInstructions: (params: { imageUrl?: string; thumbnailId?: string }) => Promise<{ success: boolean; cached?: boolean }>;
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
  // Snapshot view modal (full-size, draggable to Faces/References)
  onViewSnapshot: (data: SnapshotToView) => void;
  closeSnapshotViewModal: () => void;
  // YouTube video analytics (Gemini video understanding)
  onRequestVideoAnalytics: (
    video: { videoId: string; title: string; thumbnailUrl: string },
    channel?: { title: string; description?: string } | null
  ) => void;
  /** Open the Video Analytics modal with pre-fetched result (e.g. from chat youtube_analyze_video). */
  openVideoAnalyticsWithResult: (
    video: { videoId: string; title?: string; thumbnailUrl?: string },
    analytics: YouTubeVideoAnalytics,
    channel?: { title: string; description?: string } | null
  ) => void;
  closeVideoAnalyticsModal: () => void;
  /** Append video understanding context block to custom instructions (key: "video understanding context"). */
  appendToCustomInstructions: (summary: string) => void;
  /** Set character snapshots for a video (from FFmpeg frame extraction) */
  setCharacterSnapshots: (videoId: string, snapshots: Array<{ characterName: string; imageBlobUrl: string; blob: Blob }>) => void;
  /** Clear character snapshots for a video */
  clearCharacterSnapshots: (videoId: string) => void;
  /** Set place snapshots for a video (from FFmpeg frame extraction) */
  setPlaceSnapshots: (videoId: string, snapshots: Array<{ placeName: string; imageBlobUrl: string; blob: Blob }>) => void;
  /** Clear place snapshots for a video */
  clearPlaceSnapshots: (videoId: string) => void;
  /** Set pending face image to open create-face modal with (e.g. from snapshot drop); clear after modal uses it */
  setPendingFaceFromSnapshot: (file: File | null, defaultName?: string | null) => void;
  // Clear error
  clearError: () => void;
  // Apply form state updates from assistant
  applyFormStateUpdates: (updates: Record<string, any>) => void;
  // Reset chat and optionally form state (e.g. when user clicks Reset in chat panel)
  resetChat: (clearForm?: boolean) => void;
  // Project workflow
  setActiveProjectId: (id: string | null) => void;
  saveProjectSettings: () => Promise<void>;
  /** Clear lastGeneratedThumbnail after onboarding consumes it */
  clearLastGeneratedThumbnail: () => void;
}

/**
 * Studio Meta Interface
 * Defines metadata and refs for studio components
 */
export interface StudioMeta {
  thumbnailTextRef: React.RefObject<HTMLInputElement | null>;
  customInstructionsRef: React.RefObject<HTMLTextAreaElement | null>;
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
  /** Thumbnail from last successful generation; used by onboarding to advance to step 5 */
  lastGeneratedThumbnail: Thumbnail | null;
  // Projects (for switcher and load defaults)
  projects: DbProject[];
  projectsLoading: boolean;
  activeProjectId: string | null;
  isSavingProjectSettings: boolean;
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

/** Separate context for state only; consumers that only need state (e.g. StudioSidebarCredits) re-render only when state changes, not when data/thumbnails/generatingItems change. */
const StudioStateContext = createContext<StudioState | null>(null);

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
 * Hook to access only studio state. Use in components that only need state (e.g. leftSidebarCollapsed) so they do not re-render when data (thumbnails, generatingItems) changes.
 */
export function useStudioState(): StudioState {
  const state = useContext(StudioStateContext);
  if (!state) {
    throw new Error("useStudioState must be used within StudioProvider");
  }
  return state;
}

/**
 * Hook for thumbnail-specific actions
 * Provides all actions needed by ThumbnailCard without prop drilling
 */
export function useThumbnailActions() {
  const { actions, data } = useStudio();
  return {
    currentUserId: data.currentUserId,
    projects: data.projects,
    onFavoriteToggle: actions.onFavoriteToggle,
    onDownload: actions.onDownloadThumbnail,
    onShare: actions.onShareThumbnail,
    onCopy: actions.onCopyThumbnail,
    onEdit: actions.onEditThumbnail,
    onDelete: actions.onDeleteThumbnail,
    onAddToProject: actions.onAddToProject,
    onAnalyzeThumbnailForInstructions: actions.onAnalyzeThumbnailForInstructions,
    onView: actions.onViewThumbnail,
    onDismissFailed: actions.removeGeneratingItem,
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
  const { canCreateCustomAssets, hasWatermark, tier } = useSubscription();

  // Thumbnail generation hook (cooldown duration based on subscription tier)
  const cooldownMs = getGenerateCooldownMs(tier);
  const {
    state: generationState,
    generate,
    clearGeneratingItems,
    removeGeneratingItem,
    removeGeneratingItemsByIds,
    clearError: clearGenerationError,
  } = useThumbnailGeneration({ cooldownMs });

  // Projects data hook (for switcher and default_settings)
  const {
    projects,
    isLoading: projectsLoading,
    createProject: createProjectFn,
    updateProject: updateProjectFn,
    deleteProject: deleteProjectFn,
    isUpdating: isSavingProjectSettings,
    refetch: refetchProjects,
  } = useProjects();

  // Studio state (declared before useThumbnails so projectId can be passed).
  // Hydrate activeProjectId from localStorage in initial state to avoid a second thumbnails GET after mount.
  const [state, setState] = useState<StudioState>(() => {
    const activeProjectId =
      typeof window !== "undefined" ? localStorage.getItem("studio-active-project-id") : null;
    return {
      currentView: "generator",
      mode: "manual",
      leftSidebarCollapsed: false,
      rightSidebarCollapsed: false,
      leftSidebarWidth: 256, // 16rem default (w-64)
      rightSidebarWidth: 384, // 24rem default (w-96)
      mobilePanel: "results",
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
      includeStyleReferences: false,
      styleReferences: [],
      isGenerating: false,
      isButtonDisabled: false,
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
      snapshotViewModalOpen: false,
      snapshotToView: null,
      // YouTube video analytics modal
      videoAnalyticsModalOpen: false,
      videoAnalyticsVideo: null,
      videoAnalyticsData: null,
      videoAnalyticsLoading: false,
      videoAnalyticsError: null,
      videoAnalyticsCache: {},
      videoAnalyticsLoadingVideoIds: [],
      videoAnalyticsLoadingVideos: {},
      videoAnalyticsChannelContext: null,
      thumbnailStyleAnalysisCache: {},
      characterSnapshotsByVideoId: {},
      placeSnapshotsByVideoId: {},
      pendingFaceFromSnapshot: null,
      pendingFaceDefaultName: null,
      activeProjectId,
      lastGeneratedThumbnail: null,
    };
  });

  // Thumbnails data hook (React Query); filter by activeProjectId when set
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
    refetchAllThumbnails,
    refetch: refetchThumbnails,
  } = useThumbnails({
    userId: user?.id,
    enabled: isAuthenticated,
    limit: 24,
    projectId: state.activeProjectId,
  });

  // Faces data hook (React Query)
  // Used to look up face image URLs when generating; refresh used when agent adds a new face
  const { faces, refresh: refreshFaces } = useFaces();

  // Mutation hooks
  const deleteMutation = useDeleteThumbnail();
  const favoriteMutation = useToggleFavorite();

  // When activeProjectId changes, apply project default_settings to form once (if any)
  const lastAppliedProjectIdRef = useRef<string | null>(null);
  useEffect(() => {
    const projectId = state.activeProjectId;
    if (!projectId || !projects.length) {
      lastAppliedProjectIdRef.current = null;
      return;
    }
    if (lastAppliedProjectIdRef.current === projectId) return;
    lastAppliedProjectIdRef.current = projectId;
    const project = projects.find((p) => p.id === projectId);
    const settings = project?.default_settings;
    if (!settings || typeof settings !== "object") return;
    setState((s) => {
      const next = { ...s };
      if (settings.thumbnailText !== undefined) next.thumbnailText = settings.thumbnailText ?? "";
      if (settings.customInstructions !== undefined) next.customInstructions = settings.customInstructions ?? "";
      if (settings.includeStyles !== undefined) next.includeStyles = settings.includeStyles ?? false;
      if (settings.selectedStyle !== undefined) next.selectedStyle = settings.selectedStyle ?? null;
      if (settings.includePalettes !== undefined) next.includePalettes = settings.includePalettes ?? false;
      if (settings.selectedPalette !== undefined) next.selectedPalette = settings.selectedPalette ?? null;
      if (settings.selectedAspectRatio !== undefined) next.selectedAspectRatio = settings.selectedAspectRatio ?? "16:9";
      if (settings.selectedResolution !== undefined) next.selectedResolution = settings.selectedResolution ?? "1K";
      if (settings.variations !== undefined) next.variations = settings.variations ?? 1;
      if (settings.includeStyleReferences !== undefined) next.includeStyleReferences = settings.includeStyleReferences ?? false;
      if (settings.styleReferences !== undefined) next.styleReferences = Array.isArray(settings.styleReferences) ? settings.styleReferences : [];
      if (settings.includeFaces !== undefined) next.includeFaces = settings.includeFaces ?? false;
      if (settings.selectedFaces !== undefined) next.selectedFaces = Array.isArray(settings.selectedFaces) ? settings.selectedFaces : [];
      if (settings.faceExpression !== undefined) next.faceExpression = settings.faceExpression ?? "None";
      if (settings.facePose !== undefined) next.facePose = settings.facePose ?? "None";
      return next;
    });
  }, [state.activeProjectId, projects]);

  // Sync generation state (including cooldown so button stays disabled during tier-based interval).
  // Defer update via startTransition to avoid stacking with hook/query updates and exceeding React's update depth.
  const [isPending, startTransition] = useTransition();
  useEffect(() => {
    startTransition(() => {
      setState((s) => {
        if (
          s.isGenerating === generationState.isGenerating &&
          s.isButtonDisabled === generationState.isButtonDisabled &&
          s.generationError === generationState.error
        ) {
          return s;
        }
        return {
          ...s,
          isGenerating: generationState.isGenerating,
          isButtonDisabled: generationState.isButtonDisabled,
          generationError: generationState.error,
        };
      });
    });
  }, [generationState.isGenerating, generationState.isButtonDisabled, generationState.error, startTransition]);

  const thumbnailTextRef = useRef<HTMLInputElement | null>(null);
  const customInstructionsRef = useRef<HTMLTextAreaElement | null>(null);

  // Memoized refresh function
  // Uses invalidateAllThumbnails to refresh ALL thumbnail queries (including gallery with different sorting)
  // Placeholders are cleared only when thumbnails appear in the list (see effect below), not on a timer
  const refreshThumbnails = useCallback(async () => {
    await invalidateAllThumbnails();
  }, [invalidateAllThumbnails]);

  // Clear generating placeholders only when the corresponding thumbnail is in the fetched list.
  // Keeps placeholders visible until the real thumbnail appears, regardless of refetch timing.
  // Depend on stable keys (IDs/size) so the effect does not run on every parent re-render when
  // thumbnails or generatingItems get new array/Map references, which was causing an infinite
  // re-render loop (Maximum update depth exceeded).
  const thumbnailIdsKey = React.useMemo(
    () => thumbnails.map((t) => t.id).sort().join(","),
    [thumbnails]
  );
  const generatingSize = generationState.generatingItems.size;
  const generatingIdsKey = React.useMemo(
    () =>
      generatingSize === 0
        ? ""
        : Array.from(generationState.generatingItems.keys()).sort().join(","),
    [generationState.generatingItems, generatingSize]
  );
  useEffect(() => {
    if (generatingSize === 0) return;
    const thumbnailIds = new Set(thumbnails.map((t) => t.id));
    const idsToRemove: string[] = [];
    for (const item of generationState.generatingItems.values()) {
      if (thumbnailIds.has(item.id)) idsToRemove.push(item.id);
    }
    if (idsToRemove.length > 0) removeGeneratingItemsByIds(idsToRemove);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Depend on stable keys only to avoid infinite re-renders (thumbnails/generatingItems read from closure when keys change).
  }, [thumbnailIdsKey, generatingSize, generatingIdsKey, removeGeneratingItemsByIds]);

  // Generate thumbnails action
  const generateThumbnails = useCallback(async () => {
    if (!state.thumbnailText.trim()) {
      setState((s) => ({ ...s, generationError: "Please enter thumbnail text" }));
      return;
    }

    // Switch to Preview tab on mobile so user sees results feed and loading state
    setState((s) => ({ ...s, mobilePanel: "results" }));

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

    const allowCustom = canCreateCustomAssets();
    const results = await generate({
      thumbnailText: state.thumbnailText,
      customInstructions: state.customInstructions,
      selectedStyle: allowCustom && state.includeStyles ? state.selectedStyle : null,
      selectedPalette: allowCustom && state.includePalettes ? state.selectedPalette : null,
      selectedAspectRatio: state.selectedAspectRatio,
      selectedResolution: state.selectedResolution,
      variations: state.variations,
      styleReferences:
        allowCustom && state.includeStyleReferences && state.styleReferences.length > 0
          ? state.styleReferences
          : undefined,
      faceCharacters: allowCustom ? faceCharacters : undefined,
      expression: allowCustom && state.includeFaces && state.faceExpression !== "None" ? state.faceExpression : null,
      pose: allowCustom && state.includeFaces && state.facePose !== "None" ? state.facePose : null,
      project_id: state.activeProjectId ?? undefined,
    });

    // Refresh thumbnails after generation completes
    if (results.some((r) => r.success)) {
      const firstSuccess = results.find((r) => r.success && r.thumbnailId && r.imageUrl);
      const thumbId = firstSuccess?.thumbnailId;
      const thumbUrl = firstSuccess?.imageUrl;
      if (thumbId && thumbUrl) {
        setState((s) => ({
          ...s,
          lastGeneratedThumbnail: {
            id: thumbId,
            name: state.thumbnailText.trim() || "Thumbnail",
            imageUrl: thumbUrl,
            thumbnail400wUrl: null,
            thumbnail800wUrl: null,
            prompt: state.thumbnailText.trim() || "",
            isFavorite: false,
            isPublic: false,
            createdAt: new Date(),
          },
        }));
      }
      await refreshThumbnails();
    }
  }, [state, generate, refreshThumbnails, faces, canCreateCustomAssets]);

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

  const thumbnailToViewImageUrl = state.thumbnailToView?.imageUrl ?? null;
  const { url: watermarkedThumbnailModalUrl } = useWatermarkedImage(thumbnailToViewImageUrl, {
    enabled: hasWatermark() && !!state.thumbnailToView,
  });

  /**
   * Download thumbnail image to the user's device.
   * Always fetches the image as a blob then triggers download via object URL so that
   * cross-origin URLs (e.g. storage) result in an actual file download on desktop and mobile.
   */
  const onDownloadThumbnail = useCallback(
    async (id: string) => {
      const thumbnail = thumbnails.find((t) => t.id === id);
      if (!thumbnail?.imageUrl) return;
      const rawName = (thumbnail.name || "thumbnail").replace(/[<>:"/\\|?*]/g, "").trim() || "thumbnail";
      const filename = `${rawName}.png`;

      try {
        const res = await fetch(thumbnail.imageUrl, { mode: "cors" });
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
        let blob = await res.blob();
        if (hasWatermark()) {
          blob = await applyQrWatermark(blob);
        }
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = filename;
        link.rel = "noopener noreferrer";
        link.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 200);
      } catch (err) {
        console.error("Download failed:", err);
        const link = document.createElement("a");
        link.href = thumbnail.imageUrl;
        link.download = filename;
        link.rel = "noopener noreferrer";
        link.target = "_blank";
        link.click();
      }
    },
    [thumbnails, hasWatermark]
  );

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

  /**
   * Move thumbnail to a project (or remove from project when projectId is null).
   * Calls PATCH /api/thumbnails/[id] with { project_id }, then invalidates and refetches all thumbnail lists.
   */
  const onAddToProject = useCallback(
    async (
      thumbnailId: string,
      newProjectId: string | null,
      _previousProjectId?: string | null
    ) => {
      const { error } = await thumbnailsService.updateThumbnailProject(
        thumbnailId,
        newProjectId
      );
      if (error) {
        toast.error("Could not move thumbnail. Try again.");
        return;
      }
      await invalidateAllThumbnails();
      await refetchAllThumbnails();
    },
    [invalidateAllThumbnails, refetchAllThumbnails]
  );

  const onAnalyzeThumbnailForInstructions = useCallback(
    async (params: { imageUrl?: string; thumbnailId?: string }): Promise<{ success: boolean; cached?: boolean }> => {
      const key =
        (typeof params.thumbnailId === "string" && params.thumbnailId.trim()) ||
        (typeof params.imageUrl === "string" && params.imageUrl.trim()) ||
        "";
      if (!key) {
        toast.error("Image URL or thumbnail ID is required.");
        return { success: false };
      }

      setState((s) => {
        const cached = s.thumbnailStyleAnalysisCache[key];
        if (cached) {
          return {
            ...s,
            customInstructions:
              (s.customInstructions?.trimEnd() ?? "") +
              (s.customInstructions ? "\n\n" : "") +
              cached,
          };
        }
        return s;
      });

      const hadCached = state.thumbnailStyleAnalysisCache[key];
      if (hadCached) {
        toast.success("Added to custom instructions.");
        return { success: true, cached: true };
      }

      const { description, error: analyzeError } =
        await thumbnailsService.analyzeThumbnailStyleForInstructions(params);
      if (analyzeError) {
        toast.error(analyzeError.message || "Failed to analyze thumbnail style.");
        return { success: false };
      }
      if (description) {
        setState((s) => ({
          ...s,
          thumbnailStyleAnalysisCache: {
            ...s.thumbnailStyleAnalysisCache,
            [key]: description,
          },
          customInstructions:
            (s.customInstructions?.trimEnd() ?? "") +
            (s.customInstructions ? "\n\n" : "") +
            description,
        }));
        toast.success("Added to custom instructions.");
        return { success: true };
      }
      return { success: false };
    },
    [state.thumbnailStyleAnalysisCache]
  );

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
      // Regenerate via edit API: use this thumbnail as image reference and apply custom prompt.
      // Edit API loads the thumbnail by ID and creates a new thumbnail (original is kept).
      const editPrompt =
        data.customPrompt?.trim() || "Keep the same style and composition.";
      const referenceImages = [
        thumbnail.thumbnail800wUrl ?? thumbnail.imageUrl,
      ].filter(Boolean) as string[];

      const { result, error: editError } = await thumbnailsService.editThumbnail(
        thumbnail.id,
        editPrompt,
        referenceImages.length > 0 ? referenceImages : undefined,
        data.title?.trim() || undefined
      );

      if (editError) {
        setState((s) => ({
          ...s,
          generationError: editError.message,
          isRegenerating: false,
        }));
        return;
      }

      if (result) {
        await refreshThumbnails();
      }

      setState((s) => ({
        ...s,
        editModalOpen: false,
        thumbnailToEdit: null,
        isRegenerating: false,
        generationError: null,
      }));
    } catch (error) {
      console.error("Error regenerating thumbnail:", error);
      setState((s) => ({
        ...s,
        isRegenerating: false,
        generationError:
          error instanceof Error ? error.message : "Failed to regenerate thumbnail",
      }));
    }
  }, [state.thumbnailToEdit, refreshThumbnails]);

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

  const onViewSnapshot = useCallback((data: SnapshotToView) => {
    setState((s) => ({
      ...s,
      snapshotViewModalOpen: true,
      snapshotToView: data,
    }));
  }, []);

  const closeSnapshotViewModal = useCallback(() => {
    setState((s) => ({
      ...s,
      snapshotViewModalOpen: false,
    }));
    setTimeout(() => {
      setState((s) => ({ ...s, snapshotToView: null }));
    }, 300);
  }, []);

  const onRequestVideoAnalytics = useCallback(
    (
      video: { videoId: string; title: string; thumbnailUrl: string },
      channel?: { title: string; description?: string } | null
    ) => {
      const vid = video.videoId;
      const channelContext = channel ?? null;
      setState((s) => {
        const cached = s.videoAnalyticsCache[vid];
        const loadingThis = s.videoAnalyticsLoadingVideoIds.includes(vid);
        const modalOpenForThis =
          s.videoAnalyticsModalOpen && s.videoAnalyticsVideo?.videoId === vid;

        // 1) Cached: toggle close or open with cached data
        if (cached) {
          if (modalOpenForThis) {
            return { ...s, videoAnalyticsModalOpen: false };
          }
          return {
            ...s,
            videoAnalyticsVideo: video,
            videoAnalyticsData: cached,
            videoAnalyticsLoading: false,
            videoAnalyticsError: null,
            videoAnalyticsModalOpen: true,
            videoAnalyticsChannelContext: channelContext,
          };
        }

        // 2) Currently loading this video: don't open modal; close if it was open
        if (loadingThis) {
          if (modalOpenForThis) {
            return { ...s, videoAnalyticsModalOpen: false };
          }
          return s;
        }

        // 3) Not cached and not loading: add to loading sets; modal opens when analysis completes
        const loadingEntry = channel
          ? { ...video, channel }
          : video;
        return {
          ...s,
          videoAnalyticsLoadingVideoIds: [...s.videoAnalyticsLoadingVideoIds, vid],
          videoAnalyticsLoadingVideos: { ...s.videoAnalyticsLoadingVideos, [vid]: loadingEntry },
          videoAnalyticsChannelContext: channelContext,
          videoAnalyticsLoading: true,
          videoAnalyticsModalOpen: false,
        };
      });
    },
    []
  );

  const inFlightIdsRef = useRef<Set<string>>(new Set());
  const cancelledRef = useRef(false);

  /** Effect: for each id in loading list not yet in flight, start analyze API; on completion update cache, remove id, open modal. */
  useEffect(() => {
    cancelledRef.current = false;
    const loadingIds = state.videoAnalyticsLoadingVideoIds;
    const cache = state.videoAnalyticsCache;
    const inFlight = inFlightIdsRef.current;

    for (const id of loadingIds) {
      if (cache[id] != null) continue;
      if (inFlight.has(id)) continue;
      inFlight.add(id);
      analyzeYouTubeVideo(id).then(({ analytics, error }) => {
        if (cancelledRef.current) return;
        inFlight.delete(id);
        setState((s) => {
          const videoMeta = s.videoAnalyticsLoadingVideos[id];
          const next: StudioState = {
            ...s,
            videoAnalyticsLoadingVideoIds: s.videoAnalyticsLoadingVideoIds.filter((x) => x !== id),
            videoAnalyticsLoadingVideos: (() => {
              const { [id]: _, ...rest } = s.videoAnalyticsLoadingVideos;
              return rest;
            })(),
            videoAnalyticsLoading: false,
            videoAnalyticsVideo: videoMeta ?? null,
            videoAnalyticsData: analytics ?? null,
            videoAnalyticsError: error?.message ?? null,
            videoAnalyticsModalOpen: true,
            videoAnalyticsChannelContext: videoMeta?.channel ?? s.videoAnalyticsChannelContext,
          };
          if (analytics) {
            next.videoAnalyticsCache = { ...s.videoAnalyticsCache, [id]: analytics };
          }
          return next;
        });
      });
    }

    return () => {
      cancelledRef.current = true;
    };
  }, [state.videoAnalyticsLoadingVideoIds]);

  const closeVideoAnalyticsModal = useCallback(() => {
    setState((s) => ({ ...s, videoAnalyticsModalOpen: false, videoAnalyticsChannelContext: null }));
  }, []);

  /** Open the Video Analytics modal with pre-fetched result (e.g. from chat youtube_analyze_video). */
  const openVideoAnalyticsWithResult = useCallback(
    (
      video: { videoId: string; title?: string; thumbnailUrl?: string },
      analytics: YouTubeVideoAnalytics,
      channel?: { title: string; description?: string } | null
    ) => {
      setState((s) => ({
        ...s,
        videoAnalyticsVideo: {
          videoId: video.videoId,
          title: video.title ?? 'Video',
          thumbnailUrl: video.thumbnailUrl ?? `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`,
        },
        videoAnalyticsData: analytics,
        videoAnalyticsLoading: false,
        videoAnalyticsError: null,
        videoAnalyticsModalOpen: true,
        videoAnalyticsChannelContext: channel ?? null,
        videoAnalyticsCache: { ...s.videoAnalyticsCache, [video.videoId]: analytics },
      }));
    },
    []
  );

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, generationError: null }));
    clearGenerationError();
  }, [clearGenerationError]);

  const setActiveProjectId = useCallback((id: string | null) => {
    setState((s) => ({ ...s, activeProjectId: id }));
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem("studio-active-project-id", id);
      else localStorage.removeItem("studio-active-project-id");
    }
  }, []);

  const saveProjectSettings = useCallback(async () => {
    if (!state.activeProjectId) return;
    const payload: ProjectDefaultSettings = {
      thumbnailText: state.thumbnailText,
      customInstructions: state.customInstructions,
      includeStyles: state.includeStyles,
      selectedStyle: state.selectedStyle,
      includePalettes: state.includePalettes,
      selectedPalette: state.selectedPalette,
      selectedAspectRatio: state.selectedAspectRatio,
      selectedResolution: state.selectedResolution,
      variations: state.variations,
      includeStyleReferences: state.includeStyleReferences,
      styleReferences: state.styleReferences,
      includeFaces: state.includeFaces,
      selectedFaces: state.selectedFaces,
      faceExpression: state.faceExpression,
      facePose: state.facePose,
    };
    await updateProjectFn(state.activeProjectId, { default_settings: payload });
    await refetchProjects();
  }, [state.activeProjectId, state.thumbnailText, state.customInstructions, state.includeStyles, state.selectedStyle, state.includePalettes, state.selectedPalette, state.selectedAspectRatio, state.selectedResolution, state.variations, state.includeStyleReferences, state.styleReferences, state.includeFaces, state.selectedFaces, state.faceExpression, state.facePose, updateProjectFn, refetchProjects]);

  const actions: StudioActions = {
    setView: (view) => setState((s) => ({ ...s, currentView: view })),
    setMode: (mode) => setState((s) => ({ ...s, mode })),
    toggleLeftSidebar: () =>
      setState((s) => ({ ...s, leftSidebarCollapsed: !s.leftSidebarCollapsed })),
    toggleRightSidebar: () =>
      setState((s) => ({ ...s, rightSidebarCollapsed: !s.rightSidebarCollapsed })),
    setLeftSidebarWidth: (width) =>
      setState((s) => ({ ...s, leftSidebarWidth: width })),
    setRightSidebarWidth: (width) =>
      setState((s) => ({ ...s, rightSidebarWidth: width })),
    setMobilePanel: (panel) =>
      setState((s) => ({ ...s, mobilePanel: panel })),
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
          styleReferences: state.includeStyleReferences ? state.styleReferences : [],
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
    appendToCustomInstructions: (summary) =>
      setState((s) => ({
        ...s,
        customInstructions:
          (s.customInstructions || "").trimEnd() +
          "\n\nvideo understanding context:\n" +
          summary,
      })),
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
    setIncludeStyleReferences: (include) =>
      setState((s) => ({ ...s, includeStyleReferences: include })),
    setStyleReferences: (references) => setState((s) => ({ ...s, styleReferences: references })),
    addStyleReference: (url) =>
      setState((s) =>
        s.styleReferences.length < 10 ? { ...s, styleReferences: [...s.styleReferences, url] } : s
      ),
    addStyleReferenceFromBlob: async (blob: Blob) => {
      if (state.styleReferences.length >= 10) return;
      const file = new File([blob], "snapshot.png", { type: blob.type || "image/png" });
      const userId = user?.id;
      if (!userId) return;
      const path = `${userId}/ref-${Date.now()}-${state.styleReferences.length}.png`;
      const formData = new FormData();
      formData.set("file", file);
      formData.set("bucket", "style-references");
      formData.set("path", path);
      const res = await fetch("/api/storage/upload", { method: "POST", body: formData });
      if (!res.ok) return;
      const data = await res.json();
      const url = data?.url ?? data?.path ?? null;
      if (url) setState((s) => (s.styleReferences.length < 10 ? { ...s, styleReferences: [...s.styleReferences, url] } : s));
    },
    removeStyleReference: (index) =>
      setState((s) => ({
        ...s,
        styleReferences: s.styleReferences.filter((_, i) => i !== index),
      })),
    generateThumbnails,
    removeGeneratingItem,
    onFavoriteToggle,
    onDeleteThumbnail,
    onDownloadThumbnail,
    onShareThumbnail,
    onCopyThumbnail,
    onEditThumbnail,
    onAddToProject,
    onAnalyzeThumbnailForInstructions,
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
    onViewSnapshot,
    closeSnapshotViewModal,
    onRequestVideoAnalytics,
    openVideoAnalyticsWithResult,
    closeVideoAnalyticsModal,
    setCharacterSnapshots: (videoId, snapshots) =>
      setState((s) => ({ ...s, characterSnapshotsByVideoId: { ...s.characterSnapshotsByVideoId, [videoId]: snapshots } })),
    clearCharacterSnapshots: (videoId) =>
      setState((s) => {
        const next = { ...s.characterSnapshotsByVideoId };
        delete next[videoId];
        return { ...s, characterSnapshotsByVideoId: next };
      }),
    setPlaceSnapshots: (videoId, snapshots) =>
      setState((s) => ({ ...s, placeSnapshotsByVideoId: { ...s.placeSnapshotsByVideoId, [videoId]: snapshots } })),
    clearPlaceSnapshots: (videoId) =>
      setState((s) => {
        const next = { ...s.placeSnapshotsByVideoId };
        delete next[videoId];
        return { ...s, placeSnapshotsByVideoId: next };
      }),
    setPendingFaceFromSnapshot: (file, defaultName) =>
      setState((s) => ({ ...s, pendingFaceFromSnapshot: file ?? null, pendingFaceDefaultName: defaultName ?? null })),
    clearError,
    setActiveProjectId,
    saveProjectSettings,
    clearLastGeneratedThumbnail: () =>
      setState((s) => ({ ...s, lastGeneratedThumbnail: null })),
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
        if (updates.includeStyleReferences !== undefined)
          newState.includeStyleReferences = updates.includeStyleReferences;
        if (updates.styleReferences !== undefined) newState.styleReferences = updates.styleReferences;
        if (updates.selectedFaces !== undefined) newState.selectedFaces = updates.selectedFaces;
        return newState;
      });
      // When agent created a new face from an attached image, refetch faces then select it
      if (updates.newFaceId !== undefined) {
        refreshFaces().then(() => {
          setState((s) => ({
            ...s,
            includeFaces: true,
            selectedFaces: s.selectedFaces?.includes(updates.newFaceId!)
              ? s.selectedFaces
              : [...(s.selectedFaces ?? []), updates.newFaceId!],
          }));
        });
      }
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
              includeStyleReferences: false,
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

  const data = React.useMemo<StudioData>(
    () => ({
      currentUserId: user?.id,
      thumbnails,
      thumbnailsLoading,
      thumbnailsError: isError ? (thumbnailsError as Error) : null,
      generatingItems: generationState.generatingItems,
      hasNextPage,
      fetchNextPage,
      isFetchingNextPage,
      refreshThumbnails,
      lastGeneratedThumbnail: state.lastGeneratedThumbnail,
      projects,
      projectsLoading,
      activeProjectId: state.activeProjectId,
      isSavingProjectSettings,
    }),
    [
      user?.id,
      thumbnails,
      thumbnailsLoading,
      isError,
      thumbnailsError,
      generationState.generatingItems,
      hasNextPage,
      fetchNextPage,
      isFetchingNextPage,
      refreshThumbnails,
      state.lastGeneratedThumbnail,
      state.activeProjectId,
      projects,
      projectsLoading,
      isSavingProjectSettings,
    ]
  );

  const contextValue = React.useMemo<StudioContextValue>(
    () => ({ state, actions, meta, data }),
    [state, data]
  );

  const stateContextValue = React.useMemo<StudioState>(() => state, [state]);

  return (
    <StudioStateContext.Provider value={stateContextValue}>
    <StudioContext.Provider value={contextValue}>
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
          src={watermarkedThumbnailModalUrl ?? state.thumbnailToView.imageUrl}
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

      {/* Snapshot View Modal (full-size, draggable to Faces/References) */}
      {state.snapshotToView && (
        <SnapshotViewModal
          open={state.snapshotViewModalOpen}
          onOpenChange={(open) => {
            if (!open) closeSnapshotViewModal();
          }}
          snapshot={state.snapshotToView}
        />
      )}

      {/* YouTube Video Analytics Modal (Gemini video understanding) */}
      <YouTubeVideoAnalyticsModal
        open={state.videoAnalyticsModalOpen}
        onOpenChange={(open) => {
          if (!open) closeVideoAnalyticsModal();
        }}
        video={state.videoAnalyticsVideo}
        analytics={state.videoAnalyticsData}
        loading={state.videoAnalyticsLoading}
        error={state.videoAnalyticsError}
        channelForContext={state.videoAnalyticsChannelContext}
        onAppendToCustomInstructions={actions.appendToCustomInstructions}
        onSetCharacterSnapshots={actions.setCharacterSnapshots}
        onSetPlaceSnapshots={actions.setPlaceSnapshots}
      />
    </StudioContext.Provider>
    </StudioStateContext.Provider>
  );
}
