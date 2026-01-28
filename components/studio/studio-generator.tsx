"use client";

import React, { useCallback, useState, useMemo, useRef } from "react";
import {
  Settings,
  MessageSquare,
  Link as LinkIcon,
  ImagePlus,
  X,
  Palette,
  Plus,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { useStudio } from "./studio-provider";
import { StudioChatPanel } from "./studio-chat";
import { useFaces } from "@/lib/hooks/useFaces";
import { FaceThumbnail, FaceThumbnailSkeleton } from "./face-thumbnail";
import { useStyles } from "@/lib/hooks/useStyles";
import { usePalettes } from "@/lib/hooks/usePalettes";
import { StyleEditor } from "./style-editor";
import { PaletteColorStrip } from "./palette-thumbnail-card";
import { cn } from "@/lib/utils";
import type { StyleInsert, StyleUpdate, DbStyle } from "@/lib/types/database";

const MAX_STYLE_REFERENCES = 10;
const ASPECT_RATIO_OPTIONS = ["16:9", "1:1", "4:3", "9:16"] as const;
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
    <div className="mb-6 flex gap-2 border-b border-border">
      <button
        onClick={() => setMode("manual")}
        className={cn(
          "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
          mode === "manual"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
      >
        <Settings className="h-4 w-4" />
        Manual
      </button>
      <button
        onClick={() => setMode("chat")}
        className={cn(
          "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
          mode === "chat"
            ? "border-primary text-primary"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
      >
        <MessageSquare className="h-4 w-4" />
        Chat
      </button>
    </div>
  );
}

/**
 * StudioGeneratorThumbnailText
 * Text input for thumbnail text
 */
export function StudioGeneratorThumbnailText() {
  const {
    state: { thumbnailText },
    actions: { setThumbnailText },
    meta: { thumbnailTextRef },
  } = useStudio();

  return (
    <div className="mb-6">
      <label className="mb-2 block text-sm font-medium">Thumbnail Text</label>
      <div className="relative">
        <Input
          ref={thumbnailTextRef}
          value={thumbnailText}
          onChange={(e) => setThumbnailText(e.target.value)}
          placeholder="Enter thumbnail text..."
          className="pr-10"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          className="absolute right-1 top-1/2 -translate-y-1/2"
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
      </div>
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
    <div className="mb-6">
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
 */
export function StudioGeneratorStyleReferences() {
  const {
    state: { styleReferences },
    actions: { addStyleReference, removeStyleReference },
  } = useStudio();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
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

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-baseline gap-1.5">
        <label className="text-sm font-medium">Style References</label>
        <span className="text-xs text-muted-foreground">(max {MAX_STYLE_REFERENCES})</span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileInputChange}
      />
      <div
        tabIndex={0}
        role="button"
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onPaste={handlePaste}
        className={cn(
          "grid grid-cols-3 gap-1 rounded-md border-2 border-dashed p-2 transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        )}
      >
        {styleReferences.map((url, index) => (
          <div
            key={`${url}-${index}`}
            className="group relative aspect-square overflow-hidden rounded-md border-2 border-border transition-all hover:border-primary/50"
          >
            <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeStyleReference(index);
              }}
              className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-100"
              aria-label="Remove reference"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {styleReferences.length < MAX_STYLE_REFERENCES && (
          <button
            type="button"
            onClick={handleAddCellClick}
            disabled={isUploading}
            className="flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            {isUploading ? (
              <span className="text-xs">...</span>
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
          </button>
        )}
      </div>
      {uploadError && <p className="mt-1 text-xs text-destructive">{uploadError}</p>}
    </div>
  );
}

/**
 * StudioGeneratorStyleSelection
 * Opt-in toggle to use a saved style; list of styles + create new.
 * Uses useStyles hook for proper caching and React Query integration.
 */
export function StudioGeneratorStyleSelection() {
  const {
    state: { includeStyles, selectedStyle },
    actions: { setIncludeStyles, setSelectedStyle, setView },
  } = useStudio();

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
    enabled: includeStyles, // Only fetch when section is enabled
    autoFetch: includeStyles,
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
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <label className="text-sm font-medium">Style Selection</label>
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
                  No styles available.{" "}
                  <button
                    type="button"
                    onClick={handleQuickCreate}
                    className="text-primary underline hover:no-underline"
                  >
                    Create your first style
                  </button>
                </p>
              </div>
            ) : (
              // Style previews: fill container, title on hover only
              availableStyles.map((style) => (
                <button
                  key={style.id}
                  type="button"
                  onClick={() => handleSelectStyle(style.id)}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-md border-2 transition-all",
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
                </button>
              ))
            )}

            {/* Quick-create cell – same aspect as grid items */}
            {!isLoading && (
              <button
                type="button"
                onClick={handleQuickCreate}
                className="flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
            </div>
          </div>

          {/* Link to full styles management */}
          {availableStyles.length > 0 && (
            <button
              type="button"
              onClick={handleManageStyles}
              className="text-xs text-muted-foreground underline hover:no-underline hover:text-foreground"
            >
              Manage all styles
            </button>
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

  const effectivePalettes = useMemo(() => {
    const defaults = defaultPalettes ?? [];
    const user = (palettes ?? []).filter((p) => !p.is_default);
    return [...defaults, ...user];
  }, [palettes, defaultPalettes]);

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <label className="text-sm font-medium">Color Palette</label>
        <Switch checked={includePalettes} onCheckedChange={setIncludePalettes} />
      </div>

      {includePalettes && (
        <>
          {isLoading ? (
            <div className="h-16 animate-pulse rounded-md bg-muted" />
          ) : effectivePalettes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No palettes yet.{" "}
              <button
                type="button"
                onClick={() => setView("palettes")}
                className="text-primary underline hover:no-underline"
              >
                Add a palette
              </button>
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 max-h-[14rem] overflow-y-auto hide-scrollbar">
                {effectivePalettes.map((palette) => (
                  <button
                    key={palette.id}
                    type="button"
                    onClick={() =>
                      setSelectedPalette(selectedPalette === palette.id ? null : palette.id)
                    }
                    className={cn(
                      "rounded-md border-2 p-1 text-left transition-all",
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
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setView("palettes")}
                className="mt-1 text-xs text-muted-foreground underline hover:no-underline hover:text-foreground"
              >
                Manage palettes
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * StudioGeneratorAspectRatio
 * Aspect ratio selector: 16:9, 1:1, 4:3, 9:16
 */
export function StudioGeneratorAspectRatio() {
  const {
    state: { selectedAspectRatio },
    actions: { setSelectedAspectRatio },
  } = useStudio();

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">Aspect Ratio</label>
      <div className="flex flex-wrap gap-2">
        {ASPECT_RATIO_OPTIONS.map((ratio) => (
          <Button
            key={ratio}
            type="button"
            variant={selectedAspectRatio === ratio ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedAspectRatio(ratio)}
          >
            {ratio}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * StudioGeneratorResolution
 * Resolution selector: 1K, 2K, 4K
 */
export function StudioGeneratorResolution() {
  const {
    state: { selectedResolution },
    actions: { setSelectedResolution },
  } = useStudio();

  return (
    <div>
      <label className="mb-2 block text-sm font-medium">Resolution</label>
      <div className="flex flex-wrap gap-2">
        {RESOLUTION_OPTIONS.map((res) => (
          <Button
            key={res}
            type="button"
            variant={selectedResolution === res ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedResolution(res)}
          >
            {res}
          </Button>
        ))}
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
 * Number of variations to generate (1-4)
 */
export function StudioGeneratorVariations() {
  const {
    state: { variations },
    actions: { setVariations },
  } = useStudio();

  return (
    <div className="mb-6">
      <label className="mb-2 block text-sm font-medium">Variations</label>
      <div className="flex flex-wrap gap-2">
        {VARIATIONS_OPTIONS.map((n) => (
          <Button
            key={n}
            type="button"
            variant={variations === n ? "default" : "outline"}
            size="sm"
            onClick={() => setVariations(n)}
          >
            {n}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * StudioGeneratorFaces
 * Face selection section - uses real faces from database via useFaces hook
 */
export function StudioGeneratorFaces() {
  const {
    state: { includeFaces, selectedFaces, faceExpression, facePose },
    actions: { setIncludeFaces, toggleFace, setFaceExpression, setFacePose, setView, onViewFace },
  } = useStudio();

  // Use real faces from database
  const { faces, isLoading } = useFaces();

  // Navigate to faces management view to add new face
  const handleAddFace = useCallback(() => {
    setView("faces");
  }, [setView]);

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <label className="text-sm font-medium">Include Faces</label>
        <Switch checked={includeFaces} onCheckedChange={setIncludeFaces} />
      </div>

      {includeFaces && (
        <>
          <div className="mb-4 max-h-[22rem] overflow-y-auto hide-scrollbar">
            <div className="grid grid-cols-3 gap-1">
              {isLoading ? (
                // Loading state – same tight grid as style selection
                Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-md" />
                ))
              ) : faces.length === 0 ? (
                <div className="col-span-3 py-2">
                  <p className="text-xs text-muted-foreground">
                    No faces saved yet.{" "}
                    <button
                      type="button"
                      onClick={handleAddFace}
                      className="text-primary underline hover:no-underline"
                    >
                      Add your first face
                    </button>
                  </p>
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
              {/* Add new face cell – same aspect as grid items */}
              {!isLoading && (
                <button
                  type="button"
                  onClick={handleAddFace}
                  className="flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  <Plus className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Expression and Pose selectors (only show when faces are selected) */}
          {selectedFaces.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
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
                    <SelectItem value="Serious">Serious</SelectItem>
                    <SelectItem value="Surprised">Surprised</SelectItem>
                    <SelectItem value="Confident">Confident</SelectItem>
                    <SelectItem value="Thoughtful">Thoughtful</SelectItem>
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
    </div>
  );
}

/**
 * StudioGeneratorSubmit
 * Generate button with validation and loading state
 */
export function StudioGeneratorSubmit() {
  const {
    state: { isGenerating, thumbnailText, variations, selectedResolution },
    actions: { generateThumbnails },
  } = useStudio();

  // Basic validation
  const isDisabled = isGenerating || !thumbnailText.trim();
  
  // Calculate credit cost for display
  const creditCost = {
    "1K": 1,
    "2K": 2,
    "4K": 4,
  }[selectedResolution] || 1;
  const totalCost = creditCost * variations;

  return (
    <div className="space-y-2">
      <Button
        onClick={generateThumbnails}
        disabled={isDisabled}
        size="lg"
        className="w-full"
      >
        {isGenerating ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Generating...
          </span>
        ) : (
          "GENERATE THUMBNAILS"
        )}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        {variations} thumbnail{variations > 1 ? "s" : ""} • {totalCost} credit{totalCost > 1 ? "s" : ""}
      </p>
    </div>
  );
}

/**
 * StudioGeneratorChat
 * Chat mode interface - in-sidebar chat panel (messages, suggestions, dynamic UI).
 */
export function StudioGeneratorChat() {
  return (
    <div className="flex h-full flex-col min-h-0">
      <StudioChatPanel />
    </div>
  );
}

/**
 * StudioGenerator
 * Complete generator composition - switches between Manual and Chat modes
 */
export function StudioGenerator() {
  const {
    state: { mode },
  } = useStudio();

  if (mode === "chat") {
    return (
      <div className="flex h-full flex-col min-h-0">
        <StudioGeneratorTabs />
        <StudioGeneratorChat />
      </div>
    );
  }

  return (
    <div>
      <StudioGeneratorTabs />
      <StudioGeneratorThumbnailText />
      <StudioGeneratorCustomInstructions />
      <StudioGeneratorStyleReferences />
      <StudioGeneratorFaces />
      <StudioGeneratorStyleSelection />
      <StudioGeneratorPalette />
      <StudioGeneratorAspectAndResolution />
      <StudioGeneratorVariations />
      <StudioGeneratorSubmit />
    </div>
  );
}
