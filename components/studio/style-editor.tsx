"use client";

/**
 * StyleEditor Component
 * 
 * Modal dialog for creating and editing styles.
 * Supports AI-powered style analysis from reference images.
 * 
 * Workflow:
 * 1. Upload reference images (drag-drop or file picker)
 * 2. [Analyze Style] - Calls AI to extract style info
 * 3. Auto-fills name, description, prompt
 * 4. [Generate Preview] - Creates preview thumbnail
 * 5. [Save] - Creates/updates style record
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Palette,
  ImagePlus,
  X,
  Upload,
  Sparkles,
  Wand2,
  AlertCircle,
} from "lucide-react";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import type { DbStyle, StyleInsert, StyleUpdate } from "@/lib/types/database";
import * as stylesService from "@/lib/services/styles";

const MAX_REFERENCE_IMAGES = 10;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface StyleEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  style?: DbStyle | null; // null = create mode, DbStyle = edit mode
  onSave: (
    data: StyleInsert | StyleUpdate,
    newImages: File[],
    existingUrls: string[],
    previewUrl: string | null
  ) => Promise<void>;
  isLoading?: boolean;
}

interface ImagePreview {
  id: string;
  url: string;
  file?: File;
  isExisting: boolean;
}

/**
 * Image preview with remove button
 */
function ImagePreviewItem({
  preview,
  onRemove,
  isRemoving,
}: {
  preview: ImagePreview;
  onRemove: (id: string) => void;
  isRemoving?: boolean;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="group relative">
      <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted">
        {!isLoaded && <Skeleton className="absolute inset-0 h-full w-full" />}
        <img
          src={preview.url}
          alt="Reference"
          onLoad={() => setIsLoaded(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity",
            isLoaded ? "opacity-100" : "opacity-0"
          )}
        />
        {isRemoving && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <ViewBaitLogo className="h-5 w-5 animate-spin text-white" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onRemove(preview.id)}
        disabled={isRemoving}
        className={cn(
          "absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full",
          "bg-destructive text-destructive-foreground shadow-sm",
          "opacity-0 transition-opacity group-hover:opacity-100",
          "hover:bg-destructive/90 focus:outline-none focus:ring-2 focus:ring-destructive",
          isRemoving && "opacity-100"
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

/**
 * Drop zone for image uploads
 */
function DropZone({
  onFilesAdded,
  disabled,
  remainingSlots,
}: {
  onFilesAdded: (files: File[]) => void;
  disabled?: boolean;
  remainingSlots: number;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const files = Array.from(e.dataTransfer.files).filter(
        (file) => file.type.startsWith("image/") && file.size <= MAX_FILE_SIZE
      );
      if (files.length > 0) {
        onFilesAdded(files.slice(0, remainingSlots));
      }
    },
    [disabled, onFilesAdded, remainingSlots]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragging(true);
      }
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!disabled) {
      inputRef.current?.click();
    }
  }, [disabled]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []).filter(
        (file) => file.type.startsWith("image/") && file.size <= MAX_FILE_SIZE
      );
      if (files.length > 0) {
        onFilesAdded(files.slice(0, remainingSlots));
      }
      // Reset input
      e.target.value = "";
    },
    [onFilesAdded, remainingSlots]
  );

  if (remainingSlots <= 0) {
    return null;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleClick();
        }
      }}
      className={cn(
        "flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed transition-colors",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <Upload className="h-5 w-5 text-muted-foreground" />
      <span className="px-1 text-center text-[10px] leading-tight text-muted-foreground">
        Add or Paste
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

/**
 * Preview thumbnail display
 */
function PreviewThumbnail({
  url,
  isGenerating,
}: {
  url: string | null;
  isGenerating?: boolean;
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  if (isGenerating) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
        <Skeleton className="h-full w-full" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">
            Generating preview...
          </span>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <ImagePlus className="h-8 w-8" />
          <span className="text-sm">No preview yet</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
      {!isLoaded && <Skeleton className="absolute inset-0 h-full w-full" />}
      <img
        src={url}
        alt="Style preview"
        onLoad={() => setIsLoaded(true)}
        className={cn(
          "h-full w-full object-cover transition-opacity",
          isLoaded ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}

export function StyleEditor({
  open,
  onOpenChange,
  style,
  onSave,
  isLoading = false,
}: StyleEditorProps) {
  const isEditMode = !!style;

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<ImagePreview[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Operation states
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  // Initialize state when style changes or dialog opens
  useEffect(() => {
    if (open) {
      if (style) {
        setName(style.name);
        setDescription(style.description || "");
        setPrompt(style.prompt || "");
        setPreviewUrl(style.preview_thumbnail_url);
        setImages(
          (style.reference_images || []).map((url, index) => ({
            id: `existing-${index}`,
            url,
            isExisting: true,
          }))
        );
        setAnalysisComplete(true); // Edit mode means already analyzed
      } else {
        setName("");
        setDescription("");
        setPrompt("");
        setPreviewUrl(null);
        setImages([]);
        setAnalysisComplete(false);
      }
      setError(null);
    }
  }, [open, style]);

  // Clean up blob URLs on unmount
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (!img.isExisting && img.url.startsWith("blob:")) {
          URL.revokeObjectURL(img.url);
        }
      });
    };
  }, [images]);

  const handleFilesAdded = useCallback((files: File[]) => {
    setError(null);
    setAnalysisComplete(false); // Reset analysis when new images added
    const newPreviews: ImagePreview[] = files.map((file, index) => ({
      id: `new-${Date.now()}-${index}`,
      url: URL.createObjectURL(file),
      file,
      isExisting: false,
    }));

    setImages((prev) => {
      const combined = [...prev, ...newPreviews];
      // Limit to MAX_REFERENCE_IMAGES
      if (combined.length > MAX_REFERENCE_IMAGES) {
        combined.slice(MAX_REFERENCE_IMAGES).forEach((img) => {
          if (!img.isExisting && img.url.startsWith("blob:")) {
            URL.revokeObjectURL(img.url);
          }
        });
        return combined.slice(0, MAX_REFERENCE_IMAGES);
      }
      return combined;
    });
  }, []);

  const handleRemoveImage = useCallback((id: string) => {
    setImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img && !img.isExisting && img.url.startsWith("blob:")) {
        URL.revokeObjectURL(img.url);
      }
      return prev.filter((i) => i.id !== id);
    });
    setAnalysisComplete(false); // Reset analysis when images change
  }, []);

  /**
   * Analyze images with AI to extract style info
   */
  const handleAnalyze = useCallback(async () => {
    const newFiles = images
      .filter((img) => !img.isExisting && img.file)
      .map((img) => img.file!);

    if (newFiles.length === 0 && images.length === 0) {
      setError("Please add at least one reference image to analyze");
      return;
    }

    // For existing images (edit mode), we can't re-analyze without files
    // Use the first new file if available, otherwise show error
    if (newFiles.length === 0) {
      setError("Add new images to re-analyze the style");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const { result, error: analyzeError } = await stylesService.analyzeStyle(newFiles);

      if (analyzeError || !result) {
        setError(analyzeError?.message || "Failed to analyze style");
        return;
      }

      // Auto-fill form with AI-generated values
      setName(result.name || name);
      setDescription(result.description || description);
      setPrompt(result.prompt || prompt);
      setAnalysisComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }, [images, name, description, prompt]);

  /**
   * Generate preview thumbnail using AI
   */
  const handleGeneratePreview = useCallback(async () => {
    if (!prompt.trim()) {
      setError("Please provide a style prompt first (analyze images or enter manually)");
      return;
    }

    setIsGeneratingPreview(true);
    setError(null);

    try {
      // Use first reference image if available
      const firstImage = images[0];
      const referenceUrl = firstImage?.isExisting
        ? firstImage.url
        : undefined;

      const { imageUrl, error: previewError } = await stylesService.generateStylePreview({
        prompt: prompt.trim(),
        referenceImageUrl: referenceUrl,
      });

      if (previewError || !imageUrl) {
        setError(previewError?.message || "Failed to generate preview");
        return;
      }

      setPreviewUrl(imageUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview generation failed");
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [prompt, images]);

  /**
   * Save the style
   */
  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const newFiles = images
        .filter((img) => !img.isExisting && img.file)
        .map((img) => img.file!);
      const existingUrls = images
        .filter((img) => img.isExisting)
        .map((img) => img.url);

      const data: StyleInsert | StyleUpdate = {
        name: trimmedName,
        description: description.trim() || null,
        prompt: prompt.trim() || null,
      };

      await onSave(data, newFiles, existingUrls, previewUrl);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save style");
    } finally {
      setIsSaving(false);
    }
  }, [name, description, prompt, images, previewUrl, onSave, onOpenChange]);

  const remainingSlots = MAX_REFERENCE_IMAGES - images.length;
  const hasImages = images.length > 0;
  const hasNewImages = images.some((img) => !img.isExisting);
  const canAnalyze = hasNewImages && !isAnalyzing && !isGeneratingPreview && !isSaving;
  const canGeneratePreview = prompt.trim().length > 0 && !isAnalyzing && !isGeneratingPreview && !isSaving;
  const canSave = name.trim().length > 0 && !isSaving && !isLoading && !isAnalyzing && !isGeneratingPreview;
  const isProcessing = isAnalyzing || isGeneratingPreview || isSaving || isLoading;

  // Ref for paste handler to access latest remaining slots without re-registering
  const remainingSlotsRef = useRef(remainingSlots);
  remainingSlotsRef.current = remainingSlots;

  // Paste listener for clipboard images
  useEffect(() => {
    if (!open) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file && file.size <= MAX_FILE_SIZE) {
            imageFiles.push(file);
          }
        }
      }

      // Only handle paste if we have image files and slots available
      if (imageFiles.length > 0 && remainingSlotsRef.current > 0) {
        e.preventDefault();
        handleFilesAdded(imageFiles.slice(0, remainingSlotsRef.current));
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [open, handleFilesAdded]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {isEditMode ? "Edit Style" : "Create New Style"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update your style settings and preview."
              : "Upload reference images and let AI analyze the visual style, or enter details manually."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Reference Images */}
          <div className="space-y-2">
            <Label>
              Reference Images ({images.length}/{MAX_REFERENCE_IMAGES})
            </Label>
            <p className="text-xs text-muted-foreground">
              Add images that represent this visual style. Drag, click, or paste (Ctrl+V). AI will analyze them to extract style characteristics.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {images.map((preview) => (
                <ImagePreviewItem
                  key={preview.id}
                  preview={preview}
                  onRemove={handleRemoveImage}
                  isRemoving={isProcessing}
                />
              ))}
              <DropZone
                onFilesAdded={handleFilesAdded}
                disabled={isProcessing}
                remainingSlots={remainingSlots}
              />
            </div>
          </div>

          {/* Analyze Button */}
          {hasImages && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleAnalyze}
                disabled={!canAnalyze}
                className="gap-2"
              >
                {isAnalyzing ? (
                  <>
                    <ViewBaitLogo className="h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze with AI
                  </>
                )}
              </Button>
              {analysisComplete && (
                <span className="text-sm text-green-600">
                  ✓ Analysis complete
                </span>
              )}
            </div>
          )}

          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="style-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="style-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g., Neon Cyberpunk, Vintage Film Noir"
              disabled={isProcessing}
            />
          </div>

          {/* Description Input */}
          <div className="space-y-2">
            <Label htmlFor="style-description">Description</Label>
            <Textarea
              id="style-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of what makes this style distinctive..."
              rows={2}
              disabled={isProcessing}
            />
          </div>

          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor="style-prompt">Generation Prompt</Label>
            <p className="text-xs text-muted-foreground">
              Detailed instructions for AI to recreate this style when generating thumbnails.
            </p>
            <Textarea
              id="style-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the visual style in detail: colors, lighting, composition, effects, mood..."
              rows={4}
              disabled={isProcessing}
            />
          </div>

          {/* Preview Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Preview Thumbnail</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGeneratePreview}
                disabled={!canGeneratePreview}
                className="gap-2"
              >
                {isGeneratingPreview ? (
                  <>
                    <ViewBaitLogo className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Generate Preview
                  </>
                )}
              </Button>
            </div>
            <PreviewThumbnail
              url={previewUrl}
              isGenerating={isGeneratingPreview}
            />
          </div>

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave}>
            {isSaving || isLoading ? (
              <>
                <ViewBaitLogo className="mr-2 h-4 w-4 animate-spin" />
                {isEditMode ? "Saving..." : "Creating..."}
              </>
            ) : isEditMode ? (
              "Save Changes"
            ) : (
              "Create Style"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StyleEditor;
