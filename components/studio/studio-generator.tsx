"use client";

import React, { useCallback, useState, useMemo, useRef } from "react";
import { useDroppable, useDndContext } from "@dnd-kit/core";
import {
  Settings,
  MessageSquare,
  ImagePlus,
  Lock,
  Palette,
  Plus,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloseButton } from "@/components/ui/close-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { useStudio } from "@/components/studio/studio-provider";
import { useSubscription } from "@/lib/hooks/useSubscription";
import { StudioChatPanel } from "@/components/studio/studio-chat";
import { useFaces } from "@/lib/hooks/useFaces";
import { FaceThumbnail, FaceThumbnailSkeleton } from "./face-thumbnail";
import { useStyles } from "@/lib/hooks/useStyles";
import { usePalettes } from "@/lib/hooks/usePalettes";
import { StyleEditor } from "@/components/studio/style-editor";
import { FaceEditor } from "@/components/studio/face-editor";
import { PaletteColorStrip } from "@/components/studio/palette-thumbnail-card";
import { cn } from "@/lib/utils";
import SubscriptionModal from "@/components/subscription-modal";
import { DROP_ZONE_IDS, type DragData } from "@/components/studio/studio-dnd-context";
import type { StyleInsert, StyleUpdate, DbStyle } from "@/lib/types/database";
import { ASPECT_RATIO_DISPLAY_ORDER } from "@/lib/constants/subscription-tiers";
import { enhanceTitle } from "@/lib/services/thumbnails";
import { useOnboarding } from "@/lib/contexts/onboarding-context";
import { toast } from "sonner";

const MAX_STYLE_REFERENCES = 10;
const RESOLUTION_OPTIONS = ["1K", "2K", "4K"] as const;
const VARIATIONS_OPTIONS = [1, 2, 3, 4] as const;

/**
 * StudioGeneratorTabs
 * Mode selector tabs (Manual/Chat)
 */
export function StudioGeneratorTabs() {
  const {
    state: { mode },
    actions: { setMode },
  } = useStudio();

  return (
    <div className="flex gap-2 border-b border-border">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setMode("manual")}
        className={cn(
          "rounded-none border-b-2 -mb-px",
          mode === "manual"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Manual
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setMode("chat")}
        className={cn(
          "rounded-none border-b-2 -mb-px",
          mode === "chat"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
      >
        <MessageSquare className="h-4 w-4" />
        Chat
      </Button>
    </div>
  );
}

/**
 * StudioGeneratorThumbnailText
 * Text input for thumbnail text with optional AI-enhanced title suggestions.
 */
export function StudioGeneratorThumbnailText() {
  const {
    state: { thumbnailText },
    actions: { setThumbnailText },
    meta: { thumbnailTextRef },
  } = useStudio();
  const { canUseEnhance } = useSubscription();

  const [isEnhancing, setIsEnhancing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [enhanceError, setEnhanceError] = useState<string | null>(null);

  const handleEnhanceClick = useCallback(async () => {
    const text = thumbnailText.trim();
    if (!text) {
      setEnhanceError("Enter some text to enhance");
      setSuggestions([]);
      return;
    }
    setEnhanceError(null);
    setSuggestions([]);
    setIsEnhancing(true);
    const { suggestions: next, error } = await enhanceTitle({ title: text });
    setIsEnhancing(false);
    if (error) {
      setEnhanceError(error.message);
      setSuggestions([]);
      return;
    }
    setSuggestions(next ?? []);
  }, [thumbnailText]);

  const handleSelectSuggestion = useCallback(
    (suggestion: string) => {
      setThumbnailText(suggestion);
      setSuggestions([]);
      setEnhanceError(null);
    },
    [setThumbnailText]
  );

  const canEnhance = canUseEnhance() && !!thumbnailText.trim() && !isEnhancing;
  const isLocked = !canUseEnhance();

  return (
    <div className="mb-6">
      <label className="mb-2 mt-4 block text-sm font-medium">Thumbnail Text</label>
      <div className="relative">
        <Input
          ref={thumbnailTextRef}
          value={thumbnailText}
          onChange={(e) => setThumbnailText(e.target.value)}
          placeholder="Enter thumbnail text..."
          className="pr-10"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2",
            isLocked && "cursor-not-allowed opacity-50 text-muted-foreground"
          )}
          disabled={isLocked || !canEnhance}
          onClick={handleEnhanceClick}
          aria-label={
            isLocked
              ? "Title enhancement (Starter and above)"
              : isEnhancing
                ? "Enhancing title…"
                : "Enhance title for click-through"
          }
          aria-busy={isEnhancing}
        >
          {isEnhancing ? (
            <ViewBaitLogo className="h-4 w-4 animate-spin" />
          ) : isLocked ? (
            <Lock className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </Button>
      </div>
      {enhanceError && (
        <p className="mt-1.5 text-sm text-destructive">{enhanceError}</p>
      )}
      {suggestions.length > 0 && (
        <div className="mt-2">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Suggested titles — click to use
          </p>
          <ul className="flex flex-col gap-1">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-left text-sm hover:bg-muted hover:text-foreground"
                  onClick={() => handleSelectSuggestion(s)}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * StudioGeneratorCustomInstructions
 * Textarea for custom instructions
 */
export function StudioGeneratorCustomInstructions() {
  const {
    state: { customInstructions },
    actions: { setCustomInstructions },
    meta: { customInstructionsRef },
  } = useStudio();

  return (
    <div className="my-3">
      <label className="mb-2 block text-sm font-medium">Custom Instructions</label>
      <Textarea
        ref={customInstructionsRef}
        value={customInstructions}
        onChange={(e) => setCustomInstructions(e.target.value)}
        placeholder="Describe your thumbnail in detail..."
        className="min-h-32"
      />
    </div>
  );
}

/**
 * StudioGeneratorStyleReferences
 * Drop/paste area for style reference images (max 10). Uploads to storage and stores URLs.
 * 
 * Drop Zone: Accepts thumbnails dragged from Generator/Gallery/Browse tabs.
 * Visual feedback: Highlights when a thumbnail is being dragged over.
 */
export function StudioGeneratorStyleReferences() {
  const {
    state: { includeStyleReferences, styleReferences },
    actions: { setIncludeStyleReferences, addStyleReference, removeStyleReference },
  } = useStudio();
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Setup drop zone for thumbnail items
  const { active } = useDndContext();
  const activeData = active?.data.current as DragData | undefined;
  const isThumbnailBeingDragged = activeData?.type === "thumbnail";
  
  const { setNodeRef, isOver } = useDroppable({
    id: DROP_ZONE_IDS.STYLE_REFERENCES,
  });

  const getUserId = useCallback(async (): Promise<string | null> => {
    const res = await fetch("/api/profiles");
    if (!res.ok) return null;
    const data = await res.json();
    return data?.profile?.id ?? null;
  }, []);

  const uploadImage = useCallback(
    async (file: File): Promise<string | null> => {
      setUploadError(null);
      const userId = await getUserId();
      if (!userId) {
        setUploadError("Sign in to add style references");
        return null;
      }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/ref-${Date.now()}-${styleReferences.length}.${ext}`;
      const formData = new FormData();
      formData.set("file", file);
      formData.set("bucket", "style-references");
      formData.set("path", path);
      const res = await fetch("/api/storage/upload", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setUploadError(err?.message || "Upload failed");
        return null;
      }
      const data = await res.json();
      return data?.url ?? data?.path ?? null;
    },
    [getUserId, styleReferences.length]
  );

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || styleReferences.length >= MAX_STYLE_REFERENCES) return;
      setUploadError(null);
      setIsUploading(true);
      try {
        for (let i = 0; i < files.length && styleReferences.length + i < MAX_STYLE_REFERENCES; i++) {
          const file = files[i];
          if (!file.type.startsWith("image/")) continue;
          const url = await uploadImage(file);
          if (url) {
            setUploadError(null);
            addStyleReference(url);
          }
        }
      } finally {
        setIsUploading(false);
      }
    },
    [styleReferences.length, uploadImage, addStyleReference]
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  /** When toggle is off, dropping files on the header row turns the toggle on and adds the files */
  const handleOuterFileDrop = useCallback(
    (e: React.DragEvent) => {
      if (!includeStyleReferences && e.dataTransfer?.files?.length) {
        e.preventDefault();
        setIsDraggingFile(false);
        setIncludeStyleReferences(true);
        addFiles(e.dataTransfer.files);
      }
    },
    [includeStyleReferences, setIncludeStyleReferences, addFiles]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length && styleReferences.length < MAX_STYLE_REFERENCES) {
        e.preventDefault();
        const dt = new DataTransfer();
        files.slice(0, MAX_STYLE_REFERENCES - styleReferences.length).forEach((f) => dt.items.add(f));
        addFiles(dt.files);
      }
    },
    [styleReferences.length, addFiles]
  );

  const handleAddCellClick = useCallback(() => {
    if (styleReferences.length >= MAX_STYLE_REFERENCES || isUploading) return;
    fileInputRef.current?.click();
  }, [styleReferences.length, isUploading]);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      addFiles(e.target.files ?? null);
      e.target.value = "";
    },
    [addFiles]
  );

  const hasRoom = styleReferences.length < MAX_STYLE_REFERENCES;
  const isDropTarget = isOver && isThumbnailBeingDragged;
  const showDropFeedback =
    (isThumbnailBeingDragged && hasRoom) || (isDraggingFile && hasRoom);

  return (
    <div
      ref={setNodeRef}
      onDrop={handleOuterFileDrop}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setIsDraggingFile(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDraggingFile(false);
        }
      }}
      className={cn(
        "rounded-lg px-1 transition-all duration-200",
        // Drop zone visual feedback (thumbnail DnD or file drag)
        showDropFeedback && "border-2 border-dashed",
        showDropFeedback &&
          !isOver &&
          !isDraggingFile &&
          "border-primary/30 bg-primary/5",
        showDropFeedback &&
          (isOver || isDraggingFile) &&
          "border-primary bg-primary/10 drop-zone-active"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="my-2 text-sm font-medium">References</label>
          <span className="text-xs text-muted-foreground">(max {MAX_STYLE_REFERENCES})</span>
          {/* Drop hint when dragging thumbnail */}
          {isThumbnailBeingDragged && hasRoom && (
            <span className="text-xs text-primary animate-pulse">
              {isOver ? "Release to add" : "Drop thumbnail here"}
            </span>
          )}
          {isThumbnailBeingDragged && !hasRoom && (
            <span className="text-xs text-muted-foreground">Max references reached</span>
          )}
        </div>
        <Switch
          checked={includeStyleReferences}
          onCheckedChange={setIncludeStyleReferences}
        />
      </div>

      {includeStyleReferences && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileInputChange}
          />
          <Button
            asChild
            type="button"
            variant="outline"
            className={cn(
              "grid grid-cols-3 gap-1 rounded-md border-2 border-dashed p-2 h-auto min-h-[6rem]",
              isDraggingFile ? "border-primary bg-primary/5" : "border-border hover:border-primary/50",
              isDropTarget && "border-primary bg-primary/10"
            )}
          >
            <div
              tabIndex={0}
              role="button"
              onDrop={handleFileDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDraggingFile(true);
              }}
              onDragLeave={() => setIsDraggingFile(false)}
              onPaste={handlePaste}
            >
            {styleReferences.map((url, index) => (
              <div
                key={`${url}-${index}`}
                className="group relative aspect-square overflow-hidden rounded-md border-2 border-border transition-all hover:border-primary/50"
              >
                <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <CloseButton
                  onClick={(e) => {
                    e.stopPropagation();
                    removeStyleReference(index);
                  }}
                  className="absolute right-0.5 top-0.5 h-6 w-6 opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100"
                  aria-label="Remove reference"
                />
              </div>
            ))}
            {hasRoom && (
              <Button
                type="button"
                variant="outline"
                onClick={handleAddCellClick}
                disabled={isUploading}
                className={cn(
                  "aspect-square h-auto w-full border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary",
                  isDropTarget && "border-primary text-primary"
                )}
              >
                {isUploading ? (
                  <span className="text-xs">...</span>
                ) : (
                  <ImagePlus className="h-5 w-5" />
                )}
              </Button>
            )}
            </div>
          </Button>
          {uploadError && <p className="mt-1 text-xs text-destructive">{uploadError}</p>}
        </>
      )}
    </div>
  );
}

/**
 * StudioGeneratorStyleSelection
 * Opt-in toggle to use a saved style; list of styles + create new.
 * Uses useStyles hook for proper caching and React Query integration.
 * 
 * Drop Zone: Accepts style items dragged from Styles/Browse tabs.
 * Visual feedback: Highlights when a style is being dragged over.
 */
export function StudioGeneratorStyleSelection() {
  const {
    state: { includeStyles, selectedStyle },
    actions: { setIncludeStyles, setSelectedStyle, setView },
  } = useStudio();
  const { isOnboarding } = useOnboarding();

  // Setup drop zone for style items
  const { active } = useDndContext();
  const activeData = active?.data.current as DragData | undefined;
  const isStyleBeingDragged = activeData?.type === "style";
  
  const { setNodeRef, isOver } = useDroppable({
    id: DROP_ZONE_IDS.STYLE,
  });

  // Use the styles hook for proper caching
  const {
    styles,
    defaultStyles,
    isLoading,
    favoriteIds,
    createStyle,
    addReferenceImages,
    updatePreview,
  } = useStyles({
    enabled: includeStyles || isOnboarding, // Fetch when enabled or in onboarding (grid always visible)
    autoFetch: includeStyles || isOnboarding,
  });

  // State for quick-create modal
  const [editorOpen, setEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Combine user styles and default styles; sort favorites first
  const availableStyles = useMemo(() => {
    const userStyles = styles.filter((s) => !s.is_default);
    const combined = [...defaultStyles, ...userStyles];
    return [...combined].sort((a, b) => {
      const aFav = favoriteIds.has(a.id) ? 1 : 0;
      const bFav = favoriteIds.has(b.id) ? 1 : 0;
      if (bFav !== aFav) return bFav - aFav; // favorites first
      return 0; // keep relative order
    });
  }, [styles, defaultStyles, favoriteIds]);

  // Handle style selection
  const handleSelectStyle = useCallback(
    (styleId: string) => {
      setSelectedStyle(selectedStyle === styleId ? null : styleId);
    },
    [selectedStyle, setSelectedStyle]
  );

  // Open quick-create modal
  const handleQuickCreate = useCallback(() => {
    setEditorOpen(true);
  }, []);

  // Navigate to full styles management view
  const handleManageStyles = useCallback(() => {
    setView("styles");
  }, [setView]);

  // Handle save from quick-create modal
  const handleSave = useCallback(
    async (
      data: StyleInsert | StyleUpdate,
      newImages: File[],
      existingUrls: string[],
      previewUrl: string | null
    ) => {
      setIsSaving(true);
      try {
        // Upload images first
        const uploadedUrls: string[] = [];
        const tempId = crypto.randomUUID();

        for (const file of newImages) {
          const ext = file.name.split(".").pop() || "jpg";
          const path = `temp/${tempId}/ref-${Date.now()}-${uploadedUrls.length}.${ext}`;

          const formData = new FormData();
          formData.set("file", file);
          formData.set("bucket", "style-references");
          formData.set("path", path);

          const res = await fetch("/api/storage/upload", {
            method: "POST",
            body: formData,
          });

          if (res.ok) {
            const uploadData = await res.json();
            if (uploadData?.url) {
              uploadedUrls.push(uploadData.url);
            }
          }
        }

        // Create the style
        const insertData: StyleInsert = {
          ...data,
          name: data.name || "New Style",
          reference_images: uploadedUrls,
          preview_thumbnail_url: previewUrl,
        };

        const createdStyle = await createStyle(insertData);
        
        // Auto-select the newly created style
        if (createdStyle) {
          setSelectedStyle(createdStyle.id);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [createStyle, setSelectedStyle]
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg px-1 transition-all duration-200",
        // Drop zone visual feedback
        isStyleBeingDragged && "border-2 border-dashed",
        isStyleBeingDragged && !isOver && "border-primary/30 bg-primary/5",
        isStyleBeingDragged && isOver && "border-primary bg-primary/10 drop-zone-active"
      )}
    >
      <div className=" flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="my-2 text-sm font-medium">Style Selection</label>
          {/* Drop hint when dragging */}
          {isStyleBeingDragged && (
            <span className="text-xs text-primary animate-pulse">
              {isOver ? "Release to apply" : "Drop style here"}
            </span>
          )}
        </div>
        <Switch checked={includeStyles} onCheckedChange={setIncludeStyles} />
      </div>

      {includeStyles && (
        <>
          <div className="mb-2 max-h-[22rem] overflow-y-auto hide-scrollbar">
            <div className="grid grid-cols-3 gap-1">
              {isLoading ? (
              // Loading skeletons – tight grid, preview-sized cells
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-md" />
              ))
            ) : availableStyles.length === 0 ? (
              // No styles: single full-width message cell
              <div className="col-span-3 py-2">
                <p className="text-xs text-muted-foreground">
                  No styles available.
                  {!isOnboarding && " "}
                  {!isOnboarding && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={handleQuickCreate}
                      className="h-auto p-0 text-primary"
                    >
                      Create your first style
                    </Button>
                  )}
                </p>
              </div>
            ) : (
              // Style previews: fill container, title on hover only
              availableStyles.map((style) => (
                <Button
                  key={style.id}
                  type="button"
                  variant="outline"
                  onClick={() => handleSelectStyle(style.id)}
                  className={cn(
                    "group relative aspect-square h-auto w-full overflow-hidden rounded-md border-2 p-0 transition-all",
                    selectedStyle === style.id
                      ? "border-primary ring-2 ring-primary/20"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  {/* Preview fills the cell */}
                  {style.preview_thumbnail_url ? (
                    <img
                      src={style.preview_thumbnail_url}
                      alt={style.name ?? "Style"}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-muted">
                      <Palette className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  {/* Default style badge */}
                  {style.is_default && (
                    <div className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                      <Sparkles className="h-2.5 w-2.5 text-primary-foreground" />
                    </div>
                  )}
                  {/* Title overlay – visible only on hover */}
                  <span
                    className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1.5 py-1 text-center text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                    title={style.name ?? "Style"}
                  >
                    {style.name || "Style"}
                  </span>
                </Button>
              ))
            )}

            {/* Quick-create cell – same aspect as grid items (hidden in onboarding) */}
            {!isLoading && !isOnboarding && (
              <Button
                type="button"
                variant="outline"
                onClick={handleQuickCreate}
                className="aspect-square h-auto w-full border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Plus className="h-5 w-5" />
              </Button>
            )}
            </div>
          </div>

          {/* Link to full styles management (hidden in onboarding) */}
          {availableStyles.length > 0 && !isOnboarding && (
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={handleManageStyles}
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
            >
              Manage all styles
            </Button>
          )}
        </>
      )}

      {/* Quick-create Style Editor Modal */}
      <StyleEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        style={null}
        onSave={handleSave}
        isLoading={isSaving}
      />
    </div>
  );
}

/**
 * StudioGeneratorPalette
 * Color palette selector for manual form and chat DynamicUIRenderer.
 * Toggle on/off like Style Selection and Include Faces.
 * 
 * Drop Zone: Accepts palette items dragged from Palettes/Browse tabs.
 * Visual feedback: Highlights when a palette is being dragged over.
 */
export function StudioGeneratorPalette() {
  const {
    state: { includePalettes, selectedPalette },
    actions: { setIncludePalettes, setSelectedPalette, setView },
  } = useStudio();
  const { palettes, defaultPalettes, isLoading } = usePalettes({
    includeDefaults: true,
    enabled: includePalettes,
    autoFetch: includePalettes,
  });

  // Setup drop zone for palette items
  const { active } = useDndContext();
  const activeData = active?.data.current as DragData | undefined;
  const isPaletteBeingDragged = activeData?.type === "palette";
  
  const { setNodeRef, isOver } = useDroppable({
    id: DROP_ZONE_IDS.PALETTE,
  });

  const effectivePalettes = useMemo(() => {
    const defaults = defaultPalettes ?? [];
    const user = (palettes ?? []).filter((p) => !p.is_default);
    return [...defaults, ...user];
  }, [palettes, defaultPalettes]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg px-1 transition-all duration-200",
        // Drop zone visual feedback
        isPaletteBeingDragged && "border-2 border-dashed",
        isPaletteBeingDragged && !isOver && "border-primary/30 bg-primary/5",
        isPaletteBeingDragged && isOver && "border-primary bg-primary/10 drop-zone-active"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="my-2 text-sm font-medium">Color Palette</label>
          {/* Drop hint when dragging */}
          {isPaletteBeingDragged && (
            <span className="text-xs text-primary animate-pulse">
              {isOver ? "Release to apply" : "Drop palette here"}
            </span>
          )}
        </div>
        <Switch checked={includePalettes} onCheckedChange={setIncludePalettes} />
      </div>

      {includePalettes && (
        <>
          {isLoading ? (
            <div className="h-16 animate-pulse rounded-md bg-muted" />
          ) : effectivePalettes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No palettes yet.{" "}
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setView("palettes")}
                className="h-auto p-0 text-primary"
              >
                Add a palette
              </Button>
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 max-h-[14rem] overflow-y-auto hide-scrollbar">
                {effectivePalettes.map((palette) => (
                  <Button
                    key={palette.id}
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setSelectedPalette(selectedPalette === palette.id ? null : palette.id)
                    }
                    className={cn(
                      "h-auto flex-col items-stretch rounded-md border-2 p-1 text-left transition-all",
                      selectedPalette === palette.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <PaletteColorStrip
                      colors={palette.colors ?? []}
                      heightClass="h-10"
                      rounded="rounded-sm"
                    />
                    <p className="mt-1 truncate text-xs text-muted-foreground">{palette.name}</p>
                  </Button>
                ))}
              </div>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => setView("palettes")}
                className="mt-1 h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              >
                Manage palettes
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * StudioGeneratorAspectRatio
 * Aspect ratio selector: all 10 options; disallowed by tier shown disabled with lock icon.
 */
export function StudioGeneratorAspectRatio() {
  const {
    state: { selectedAspectRatio },
    actions: { setSelectedAspectRatio },
  } = useStudio();
  const { canUseAspectRatio } = useSubscription();

  const allowedRatios = useMemo(
    () => ASPECT_RATIO_DISPLAY_ORDER.filter((ratio) => canUseAspectRatio(ratio)),
    [canUseAspectRatio]
  );
  const firstAllowed = allowedRatios[0] ?? "16:9";
  React.useEffect(() => {
    if (allowedRatios.length > 0 && !(allowedRatios as readonly string[]).includes(selectedAspectRatio)) {
      setSelectedAspectRatio(firstAllowed);
    }
  }, [allowedRatios, firstAllowed, selectedAspectRatio, setSelectedAspectRatio]);

  return (
    <div className="mt-4 ml-1">
      <label className="mb-2 block text-sm font-medium">Aspect Ratio</label>
      <div className="flex flex-wrap gap-2">
        {ASPECT_RATIO_DISPLAY_ORDER.map((ratio) => {
          const allowed = canUseAspectRatio(ratio);
          return (
            <Button
              key={ratio}
              type="button"
              variant={selectedAspectRatio === ratio ? "default" : "outline"}
              size="sm"
              disabled={!allowed}
              onClick={() => allowed && setSelectedAspectRatio(ratio)}
              className="gap-1"
            >
              {!allowed && <Lock className="h-3 w-3 shrink-0" />}
              {ratio}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * StudioGeneratorResolution
 * Resolution selector: 1K, 2K, 4K. Disallowed options shown disabled with lock icon.
 */
export function StudioGeneratorResolution() {
  const {
    state: { selectedResolution },
    actions: { setSelectedResolution },
  } = useStudio();
  const { canUseResolution } = useSubscription();

  const allowedResolutions = useMemo(
    () => RESOLUTION_OPTIONS.filter((res) => canUseResolution(res)),
    [canUseResolution]
  );

  const firstAllowed = allowedResolutions[0] ?? "1K";
  React.useEffect(() => {
    if (allowedResolutions.length > 0 && !allowedResolutions.includes(selectedResolution as "1K" | "2K" | "4K")) {
      setSelectedResolution(firstAllowed);
    }
  }, [allowedResolutions, firstAllowed, selectedResolution, setSelectedResolution]);

  return (
    <div className="mt-4">
      <label className="mb-2 block text-sm font-medium">Resolution</label>
      <div className="flex flex-wrap gap-2">
        {RESOLUTION_OPTIONS.map((res) => {
          const allowed = canUseResolution(res);
          return (
            <Button
              key={res}
              type="button"
              variant={selectedResolution === res ? "default" : "outline"}
              size="sm"
              disabled={!allowed}
              onClick={() => allowed && setSelectedResolution(res)}
              className="gap-1"
            >
              {!allowed && <Lock className="h-3 w-3 shrink-0" />}
              {res}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * StudioGeneratorAspectAndResolution
 * Aspect ratio and resolution on one row
 */
export function StudioGeneratorAspectAndResolution() {
  return (
    <div className="mb-6 grid grid-cols-2 gap-4">
      <StudioGeneratorAspectRatio />
      <StudioGeneratorResolution />
    </div>
  );
}

/**
 * StudioGeneratorVariations
 * Number of variations (1–4). Options above tier max shown disabled with lock icon.
 */
export function StudioGeneratorVariations() {
  const {
    state: { variations },
    actions: { setVariations },
  } = useStudio();
  const { getMaxVariations } = useSubscription();

  const maxVariations = getMaxVariations();

  React.useEffect(() => {
    if (variations > maxVariations) {
      setVariations(maxVariations);
    }
  }, [maxVariations, variations, setVariations]);

  return (
    <div className="mb-6 ml-1">
      <label className="mb-2 block text-sm font-medium">Variations</label>
      <div className="flex flex-wrap gap-2">
        {VARIATIONS_OPTIONS.map((n) => {
          const allowed = n <= maxVariations;
          return (
            <Button
              key={n}
              type="button"
              variant={variations === n ? "default" : "outline"}
              size="sm"
              disabled={!allowed}
              onClick={() => allowed && setVariations(n)}
              className="gap-1"
            >
              {!allowed && <Lock className="h-3 w-3 shrink-0" />}
              {n}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * StudioGeneratorFaces
 * Face selection section - uses real faces from database via useFaces hook
 * 
 * Drop Zone: Accepts face items dragged from Faces tab.
 * Visual feedback: Highlights when a face is being dragged over.
 * Multi-select: Dropped faces are added to the selection.
 */
export function StudioGeneratorFaces() {
  const {
    state: { includeFaces, selectedFaces, faceExpression, facePose },
    actions: { setIncludeFaces, toggleFace, setFaceExpression, setFacePose, setView, onViewFace },
  } = useStudio();
  const { isOnboarding } = useOnboarding();

  // Use real faces from database
  const { faces, isLoading, createFace } = useFaces();

  // Onboarding: upload first face – local state for name and uploading
  const [firstFaceName, setFirstFaceName] = useState("");
  const [isUploadingFirst, setIsUploadingFirst] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Create new face modal (add-new-face button opens this instead of navigating to faces)
  const [faceEditorOpen, setFaceEditorOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Setup drop zone for face items
  const { active } = useDndContext();
  const activeData = active?.data.current as DragData | undefined;
  const isFaceBeingDragged = activeData?.type === "face";
  
  const { setNodeRef, isOver } = useDroppable({
    id: DROP_ZONE_IDS.FACES,
  });

  // Navigate to faces management view (used by empty-state "Add your first face" link)
  const handleAddFace = useCallback(() => {
    if (isOnboarding) return;
    setView("faces");
  }, [isOnboarding, setView]);

  // Open create-new-face modal (add-new-face grid button)
  const handleOpenCreateFace = useCallback(() => {
    if (isOnboarding) return;
    setFaceEditorOpen(true);
  }, [isOnboarding]);

  // Save from create-new-face modal; auto-select new face and close
  const handleSaveFace = useCallback(
    async (name: string, newImages: File[], _existingUrls: string[]) => {
      setIsSaving(true);
      try {
        const created = await createFace(name, newImages);
        if (created) {
          toggleFace(created.id);
          setFaceEditorOpen(false);
          toast.success("Face added! You can use it in your thumbnail.");
        }
      } finally {
        setIsSaving(false);
      }
    },
    [createFace, toggleFace]
  );

  // Onboarding: upload first face via file input
  const handleUploadFirstFace = useCallback(
    async (file: File) => {
      setUploadError(null);
      setIsUploadingFirst(true);
      try {
        const name = firstFaceName.trim() || "My face";
        const face = await createFace(name, [file]);
        if (face) {
          toggleFace(face.id);
          setFirstFaceName("");
          if (fileInputRef.current) fileInputRef.current.value = "";
          toast.success("Face added! You can use it in your thumbnail.");
        } else {
          setUploadError("Upload failed. Try again.");
        }
      } finally {
        setIsUploadingFirst(false);
      }
    },
    [firstFaceName, createFace, toggleFace]
  );

  const handleFirstFaceFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      handleUploadFirstFace(file);
    },
    [handleUploadFirstFace]
  );

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg px-1 transition-all duration-200",
        // Drop zone visual feedback
        isFaceBeingDragged && "border-2 border-dashed",
        isFaceBeingDragged && !isOver && "border-primary/30 bg-primary/5",
        isFaceBeingDragged && isOver && "border-primary bg-primary/10 drop-zone-active"
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <label className="my-2 text-sm font-medium">Include Faces</label>
          {/* Drop hint when dragging */}
          {isFaceBeingDragged && (
            <span className="text-xs text-primary animate-pulse">
              {isOver ? "Release to add" : "Drop face here"}
            </span>
          )}
        </div>
        <Switch checked={includeFaces} onCheckedChange={setIncludeFaces} />
      </div>

      {includeFaces && (
        <>
          {/* Hidden file input for onboarding: used by "first face" block and by "+" add-new cell */}
          {isOnboarding && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Choose face photo"
              onChange={handleFirstFaceFileChange}
              disabled={isUploadingFirst}
            />
          )}
          <div className="max-h-[22rem] overflow-y-auto hide-scrollbar">
            <div className="grid grid-cols-3 gap-1">
              {/* When onboarding and no faces, always show upload UI (even while uploading) */}
              {isLoading && !(isOnboarding && faces.length === 0) ? (
                // Loading state – same tight grid as style selection
                Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-md" />
                ))
              ) : faces.length === 0 ? (
                <div className="col-span-3 space-y-3 py-2">
                  {isOnboarding ? (
                    <>
                      <p className="text-xs text-muted-foreground">
                        Upload a photo so we can use your face in thumbnails. You can add more later in Studio.
                      </p>
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Face name (e.g. My face)"
                          value={firstFaceName}
                          onChange={(e) => setFirstFaceName(e.target.value)}
                          className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                          disabled={isUploadingFirst}
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingFirst}
                          className={cn(
                            "flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed py-6 text-sm transition-colors",
                            "border-border text-muted-foreground hover:border-primary hover:text-primary",
                            "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                            "disabled:pointer-events-none disabled:opacity-60"
                          )}
                        >
                          {isUploadingFirst ? (
                            <>
                              <ViewBaitLogo className="h-5 w-5 animate-spin" />
                              Uploading…
                            </>
                          ) : (
                            <>
                              <Plus className="h-5 w-5" />
                              Choose photo to upload your first face
                            </>
                          )}
                        </button>
                      </div>
                      {uploadError && (
                        <p className="text-xs text-destructive">{uploadError}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        You can add more faces anytime in Studio.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No faces saved yet.{" "}
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        onClick={handleAddFace}
                        className="h-auto p-0 text-primary"
                      >
                        Add your first face
                      </Button>
                    </p>
                  )}
                </div>
              ) : (
                faces.map((face) => (
                  <FaceThumbnail
                    key={face.id}
                    face={face}
                    variant="compact"
                    onView={onViewFace}
                    onSelect={toggleFace}
                    isSelected={selectedFaces.includes(face.id)}
                  />
                ))
              )}
              {/* Add new face cell – same aspect as grid items; in onboarding opens file picker; otherwise opens create-face modal */}
              {!isLoading && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={isOnboarding ? () => fileInputRef.current?.click() : handleOpenCreateFace}
                  disabled={isOnboarding && isUploadingFirst}
                  className="aspect-square h-auto w-full border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  {isOnboarding && isUploadingFirst ? (
                    <ViewBaitLogo className="h-5 w-5 animate-spin" />
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Expression and Pose selectors (only show when faces are selected) */}
          {selectedFaces.length > 0 && (
            <div className="grid grid-cols-2 gap-4 m-2">
              <div>
                <label className="mb-2 block text-xs text-muted-foreground">
                  Expression
                </label>
                <Select value={faceExpression} onValueChange={setFaceExpression}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Happy">Happy</SelectItem>
                    <SelectItem value="Excited">Excited</SelectItem>
                    <SelectItem value="Thinking">Thinking</SelectItem>
                    <SelectItem value="Shocked">Shocked</SelectItem>
                    <SelectItem value="Fire">Fire</SelectItem>
                    <SelectItem value="Cool">Cool</SelectItem>
                    <SelectItem value="Mind blown">Mind blown</SelectItem>
                    <SelectItem value="Serious">Serious</SelectItem>
                    <SelectItem value="Surprised">Surprised</SelectItem>
                    <SelectItem value="Confident">Confident</SelectItem>
                    <SelectItem value="Thoughtful">Thoughtful</SelectItem>
                    <SelectItem value="Sad">Sad</SelectItem>
                    <SelectItem value="Angry">Angry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-xs text-muted-foreground">Pose</label>
                <Select value={facePose} onValueChange={setFacePose}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Front">Front Facing</SelectItem>
                    <SelectItem value="Side">Side Profile</SelectItem>
                    <SelectItem value="Pointing">Pointing</SelectItem>
                    <SelectItem value="Thumbs Up">Thumbs Up</SelectItem>
                    <SelectItem value="Arms Crossed">Arms Crossed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create new face modal – opened by add-new-face button (Create tab / mobile) */}
      <FaceEditor
        open={faceEditorOpen}
        onOpenChange={setFaceEditorOpen}
        face={null}
        onSave={handleSaveFace}
        isLoading={isSaving}
      />
    </div>
  );
}

type StudioGeneratorSubmitProps = {
  /** Optional class for the main button (e.g. onboarding btn-primary pulse-glow) */
  className?: string;
  /** Optional label when not generating (e.g. "Generate Thumbnail") */
  buttonLabel?: string;
  /** Optional icon element shown before label when not generating */
  icon?: React.ReactNode;
  /** When true, hide the credits line (e.g. onboarding) */
  hideCredits?: boolean;
  /** When true, hide "Save settings to project" (e.g. onboarding) */
  hideSaveToProject?: boolean;
};

/**
 * StudioGeneratorSubmit
 * Generate button with validation and loading state; optional Save settings to project when a project is selected.
 */
export function StudioGeneratorSubmit({
  className,
  buttonLabel = "CREATE THUMBNAILS",
  icon,
  hideCredits = false,
  hideSaveToProject = false,
}: StudioGeneratorSubmitProps = {}) {
  const {
    state: { isButtonDisabled, thumbnailText, variations, selectedResolution, activeProjectId },
    data: { isSavingProjectSettings },
    actions: { generateThumbnails, saveProjectSettings },
  } = useStudio();
  const { getResolutionCost } = useSubscription();

  // Disabled during tier-based cooldown or when text is empty (time-only debounce per tier)
  const isDisabled = isButtonDisabled || !thumbnailText.trim();

  const creditCost = getResolutionCost(selectedResolution as "1K" | "2K" | "4K");
  const totalCost = creditCost * variations;

  return (
    <div className="space-y-2">
      {!hideCredits && (
        <p className="text-center text-xs text-muted-foreground">
          {variations} thumbnail{variations > 1 ? "s" : ""} • {totalCost} credit{totalCost > 1 ? "s" : ""}
        </p>
      )}
      <Button
        onClick={generateThumbnails}
        disabled={isDisabled}
        size="lg"
        className={cn("w-full", className)}
      >
        {isButtonDisabled ? (
          <span className="flex items-center gap-2">
            <ViewBaitLogo className="h-4 w-4 animate-spin" />
            Creating...
          </span>
        ) : (
          <>
            {icon}
            {buttonLabel}
          </>
        )}
      </Button>
      {!hideSaveToProject && activeProjectId && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={saveProjectSettings}
          disabled={isSavingProjectSettings}
        >
          {isSavingProjectSettings ? "Saving..." : "Save current settings to project"}
        </Button>
      )}
    </div>
  );
}

/**
 * StudioGeneratorChat
 * Chat mode interface - in-sidebar chat panel (messages, suggestions, dynamic UI).
 */
export function StudioGeneratorChat() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <StudioChatPanel />
    </div>
  );
}

/**
 * StudioGenerator
 * Complete generator composition - switches between Manual and Chat modes.
 * Style, palette, and face sections are always visible; Free tier sees them disabled with lock + "Upgrade to unlock".
 */
export function StudioGenerator() {
  const {
    state: { mode },
  } = useStudio();
  const { canCreateCustomAssets, tier, productId } = useSubscription();
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const locked = !canCreateCustomAssets();

  if (mode === "chat") {
    return (
      <div className="flex h-full flex-col min-h-0">
        <StudioGeneratorTabs />
        <div className="flex-1 min-h-0 flex flex-col">
          <StudioGeneratorChat />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <StudioGeneratorTabs />
      <div className="flex-1 min-h-0 overflow-y-auto hide-scrollbar mb-6">
        <StudioGeneratorThumbnailText />
        <StudioGeneratorCustomInstructions />
        <div className={cn(locked && "relative")}>
          {locked && (
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Starter+ to unlock
              </span>
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-primary"
                onClick={() => setSubscriptionModalOpen(true)}
              >
                Upgrade to unlock
              </Button>
            </div>
          )}
          <div
            className={cn(
              locked && "pointer-events-none select-none opacity-60"
            )}
          >
            <StudioGeneratorStyleReferences />
            <StudioGeneratorFaces />
            <StudioGeneratorStyleSelection />
            <StudioGeneratorPalette />
          </div>
        </div>
        <StudioGeneratorAspectAndResolution />
        <StudioGeneratorVariations />
      </div>
      <div className="flex-shrink-0 pt-2">
        <StudioGeneratorSubmit />
      </div>
      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        currentTier={tier}
        currentProductId={productId}
      />
    </div>
  );
}
