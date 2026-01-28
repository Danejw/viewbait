"use client";

import React, { useCallback, useState, useMemo } from "react";
import {
  Settings,
  MessageSquare,
  Link as LinkIcon,
  ImagePlus,
  X,
  Palette,
  Plus,
  User,
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
import { useFaces } from "@/lib/hooks/useFaces";
import { useStyles } from "@/lib/hooks/useStyles";
import { StyleEditor } from "./style-editor";
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

  return (
    <div className="mb-6">
      <label className="mb-2 block text-sm font-medium">Style References</label>
      <p className="mb-2 text-xs text-muted-foreground">
        Drag and drop images here or paste from clipboard. Used as reference when generating (max{" "}
        {MAX_STYLE_REFERENCES}).
      </p>
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
          "flex min-h-24 flex-wrap items-center gap-2 rounded-md border-2 border-dashed p-3 transition-colors",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        )}
      >
        {styleReferences.map((url, index) => (
          <div key={`${url}-${index}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded border border-border">
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => removeStyleReference(index)}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {styleReferences.length < MAX_STYLE_REFERENCES && (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed border-border text-muted-foreground">
            {isUploading ? (
              <span className="text-xs">...</span>
            ) : (
              <ImagePlus className="h-6 w-6" />
            )}
          </div>
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

  // Combine user styles and default styles for selection
  const availableStyles = useMemo(() => {
    // Filter to show user's own styles + default styles
    const userStyles = styles.filter((s) => !s.is_default);
    return [...defaultStyles, ...userStyles];
  }, [styles, defaultStyles]);

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
          <p className="mb-2 text-xs text-muted-foreground">
            Select a style to guide the visual appearance of your thumbnail.
          </p>

          <div className="mb-2 flex flex-wrap gap-2">
            {isLoading ? (
              // Loading skeletons
              <>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <Skeleton className="h-12 w-12 rounded-md" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                ))}
              </>
            ) : availableStyles.length === 0 ? (
              // No styles available
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
            ) : (
              // Show available styles
              <>
                {availableStyles.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => handleSelectStyle(style.id)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-md border-2 p-2 transition-all",
                      selectedStyle === style.id
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="relative h-12 w-12 overflow-hidden rounded bg-muted">
                      {style.preview_thumbnail_url ? (
                        <img
                          src={style.preview_thumbnail_url}
                          alt={style.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Palette className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      {/* Default style badge */}
                      {style.is_default && (
                        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                          <Sparkles className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                    <span className="max-w-16 truncate text-xs">
                      {style.name || "Style"}
                    </span>
                  </button>
                ))}
              </>
            )}

            {/* Quick-create button */}
            <button
              type="button"
              onClick={handleQuickCreate}
              className="flex h-[72px] w-14 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Plus className="h-5 w-5" />
              <span className="text-xs">New</span>
            </button>
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
      <p className="mb-2 text-xs text-muted-foreground">
        Number of thumbnails to generate at once (1–4).
      </p>
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
    actions: { setIncludeFaces, toggleFace, setFaceExpression, setFacePose, setView },
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
          <div className="mb-4">
            <p className="mb-2 text-xs text-muted-foreground">
              Select faces to include in generation ({selectedFaces.length} selected)
            </p>
            <div className="flex flex-wrap gap-2">
              {isLoading ? (
                // Loading state
                <>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                  ))}
                </>
              ) : faces.length === 0 ? (
                // No faces saved
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
              ) : (
                // Show saved faces
                faces.map((face) => {
                  const firstImage = face.image_urls?.[0];
                  const isSelected = selectedFaces.includes(face.id);

                  return (
                    <button
                      key={face.id}
                      type="button"
                      onClick={() => toggleFace(face.id)}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-md p-1 transition-all",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        isSelected && "ring-2 ring-primary ring-offset-2"
                      )}
                    >
                      <div
                        className={cn(
                          "h-12 w-12 overflow-hidden rounded-full border-2 transition-all",
                          isSelected
                            ? "border-primary"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        {firstImage ? (
                          <img
                            src={firstImage}
                            alt={face.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-muted">
                            <User className="h-5 w-5 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <span className="max-w-14 truncate text-xs text-muted-foreground">
                        {face.name}
                      </span>
                    </button>
                  );
                })
              )}
              {/* Add new face button */}
              <button
                type="button"
                onClick={handleAddFace}
                className="flex flex-col items-center gap-1 rounded-md p-1"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-border hover:border-primary transition-colors">
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </div>
                <span className="text-xs text-muted-foreground">Add</span>
              </button>
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
 * Chat mode interface - shows chat assistant when in chat mode
 */
export function StudioGeneratorChat() {
  const {
    state: { mode },
    actions: { openChatAssistant },
  } = useStudio();

  // When switching to chat mode, open the chat assistant
  React.useEffect(() => {
    if (mode === "chat") {
      openChatAssistant();
    }
  }, [mode, openChatAssistant]);

  return (
    <div className="flex h-full flex-col items-center justify-center py-12">
      <div className="text-center">
        <MessageSquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="mb-2 text-xl font-semibold">Chat Mode</h2>
        <p className="mb-6 text-muted-foreground">
          Use the chat assistant to generate thumbnails through conversation
        </p>
        <Button onClick={openChatAssistant} size="lg">
          <MessageSquare className="mr-2 h-4 w-4" />
          Open Chat Assistant
        </Button>
      </div>
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
    return <StudioGeneratorChat />;
  }

  return (
    <div>
      <StudioGeneratorTabs />
      <StudioGeneratorThumbnailText />
      <StudioGeneratorCustomInstructions />
      <StudioGeneratorStyleReferences />
      <StudioGeneratorStyleSelection />
      <StudioGeneratorAspectAndResolution />
      <StudioGeneratorVariations />
      <StudioGeneratorFaces />
      <StudioGeneratorSubmit />
    </div>
  );
}
