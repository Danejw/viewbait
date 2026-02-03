"use client";

/**
 * PaletteEditor Component
 * 
 * Modal dialog for creating and editing color palettes.
 * Supports AI-powered color extraction from images.
 * 
 * Workflow:
 * 1. Upload an image OR manually add colors
 * 2. [Analyze Colors] - Calls AI to extract color palette
 * 3. Auto-fills name and colors from analysis
 * 4. Edit colors manually (add, remove, modify)
 * 5. [Save] - Creates/updates palette record
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  Droplets,
  Upload,
  X,
  Sparkles,
  Plus,
  AlertCircle,
  ImageIcon,
  Trash2,
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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/lib/utils/error";
import { VALIDATION_NAME_REQUIRED } from "@/lib/constants/validation-messages";
import type { DbPalette, PaletteInsert, PaletteUpdate } from "@/lib/types/database";
import * as palettesService from "@/lib/services/palettes";

const MAX_COLORS = 10;
const MIN_COLORS = 1;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Default color when adding a new one
const DEFAULT_NEW_COLOR = "#6366F1";

export interface PaletteEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  palette?: DbPalette | null; // null = create mode, DbPalette = edit mode
  onSave: (data: PaletteInsert | PaletteUpdate) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Validates hex color format
 */
function isValidHexColor(color: string): boolean {
  return /^#([0-9A-Fa-f]{3}){1,2}$/.test(color);
}

/**
 * Normalizes color to 6-digit hex format
 */
function normalizeHexColor(color: string): string {
  // Remove # if present
  let hex = color.replace("#", "").toUpperCase();
  
  // Expand 3-digit to 6-digit
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  
  return `#${hex}`;
}

/**
 * Calculate contrast color (black or white) for text on a background
 */
function getContrastColor(hexColor: string): string {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#FFFFFF";
}

/**
 * Individual color chip with edit and delete
 */
function ColorChip({
  color,
  index,
  onUpdate,
  onDelete,
  canDelete,
  disabled,
}: {
  color: string;
  index: number;
  onUpdate: (index: number, newColor: string) => void;
  onDelete: (index: number) => void;
  canDelete: boolean;
  disabled?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(color);
  const inputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(color);
  }, [color]);

  const handleEditStart = useCallback(() => {
    if (disabled) return;
    setIsEditing(true);
    setEditValue(color);
    setTimeout(() => inputRef.current?.select(), 0);
  }, [color, disabled]);

  const handleEditEnd = useCallback(() => {
    setIsEditing(false);
    if (isValidHexColor(editValue)) {
      const normalized = normalizeHexColor(editValue);
      if (normalized !== color) {
        onUpdate(index, normalized);
      }
    } else {
      setEditValue(color);
    }
  }, [editValue, color, index, onUpdate]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleEditEnd();
      } else if (e.key === "Escape") {
        setEditValue(color);
        setIsEditing(false);
      }
    },
    [handleEditEnd, color]
  );

  const handleColorPickerChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newColor = e.target.value.toUpperCase();
      setEditValue(newColor);
      onUpdate(index, newColor);
    },
    [index, onUpdate]
  );

  const contrastColor = getContrastColor(color);

  return (
    <div
      className={cn(
        "group relative flex h-16 w-full min-w-[80px] items-center justify-center rounded-lg transition-all",
        !disabled && "hover:ring-2 hover:ring-primary/50"
      )}
      style={{ backgroundColor: color }}
    >
      {/* Hidden color input for native picker */}
      <input
        ref={colorInputRef}
        type="color"
        value={color}
        onChange={handleColorPickerChange}
        disabled={disabled}
        className="sr-only"
      />

      {/* Color value display */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.toUpperCase())}
          onBlur={handleEditEnd}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          className={cn(
            "w-20 rounded border-0 bg-transparent px-1 text-center text-xs font-mono",
            "focus:outline-none focus:ring-1 focus:ring-white/50"
          )}
          style={{ color: contrastColor }}
          maxLength={7}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleEditStart}
          onDoubleClick={() => colorInputRef.current?.click()}
          disabled={disabled}
          className={cn(
            "min-w-0 text-xs font-mono transition-opacity h-auto py-0",
            !disabled && "cursor-pointer hover:opacity-80"
          )}
          style={{ color: contrastColor }}
          title="Click to edit, double-click for color picker"
        >
          {color}
        </Button>
      )}

      {/* Delete button */}
      {canDelete && !disabled && (
        <Button
          type="button"
          variant="destructive"
          size="icon-xs"
          onClick={() => onDelete(index)}
          className={cn(
            "absolute -right-2 -top-2 h-6 w-6 rounded-full shadow-sm",
            "opacity-0 transition-opacity group-hover:opacity-100"
          )}
          aria-label="Remove color"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

/**
 * Add color button
 */
function AddColorButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-16 w-full min-w-[80px] border-2 border-dashed border-border bg-muted/50 rounded-lg",
        !disabled && "hover:border-primary/50 hover:bg-muted",
        disabled && "cursor-not-allowed opacity-50"
      )}
    >
      <Plus className="h-5 w-5 text-muted-foreground" />
    </Button>
  );
}

/**
 * Image upload zone for AI analysis
 */
function ImageUploadZone({
  onFileSelected,
  disabled,
  currentFile,
  onClear,
}: {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  currentFile: File | null;
  onClear: () => void;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentFile) {
      const url = URL.createObjectURL(currentFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [currentFile]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const file = Array.from(e.dataTransfer.files).find(
        (f) => f.type.startsWith("image/") && f.size <= MAX_FILE_SIZE
      );
      if (file) {
        onFileSelected(file);
      }
    },
    [disabled, onFileSelected]
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
      const file = e.target.files?.[0];
      if (file && file.type.startsWith("image/") && file.size <= MAX_FILE_SIZE) {
        onFileSelected(file);
      }
      e.target.value = "";
    },
    [onFileSelected]
  );

  if (currentFile && previewUrl) {
    return (
      <div className="relative aspect-video w-full max-w-xs overflow-hidden rounded-lg border border-border">
        <img
          src={previewUrl}
          alt="Source for color analysis"
          className="h-full w-full object-cover"
        />
        {!disabled && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            onClick={onClear}
            className="absolute right-2 top-2 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground"
            aria-label="Clear image"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <Button
      asChild
      type="button"
      variant="outline"
      className={cn(
        "flex aspect-video w-full max-w-xs cursor-pointer flex-col items-center justify-center gap-2 h-auto border-2 border-dashed rounded-lg",
        isDragging
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/50",
        disabled && "cursor-not-allowed opacity-50"
      )}
      onClick={handleClick}
      disabled={disabled}
    >
      <div
        tabIndex={0}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleClick();
          }
        }}
      >
        <ImageIcon className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">Drop an image here</p>
          <p className="text-xs text-muted-foreground">or click to browse, or paste (Ctrl+V)</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </Button>
  );
}

/**
 * Color palette preview strip
 */
function PalettePreview({ colors }: { colors: string[] }) {
  if (colors.length === 0) {
    return (
      <div className="flex h-12 w-full items-center justify-center rounded-lg border border-dashed border-border bg-muted">
        <span className="text-xs text-muted-foreground">No colors added</span>
      </div>
    );
  }

  return (
    <div className="flex h-12 w-full overflow-hidden rounded-lg">
      {colors.map((color, index) => (
        <div
          key={`preview-${index}`}
          className="flex-1 transition-all"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export function PaletteEditor({
  open,
  onOpenChange,
  palette,
  onSave,
  isLoading = false,
}: PaletteEditorProps) {
  const isEditMode = !!palette;

  // Form state
  const [name, setName] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [sourceImage, setSourceImage] = useState<File | null>(null);

  // Operation states
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisComplete, setAnalysisComplete] = useState(false);

  // Initialize state when palette changes or dialog opens
  useEffect(() => {
    if (open) {
      if (palette) {
        setName(palette.name);
        setColors([...palette.colors]);
        setAnalysisComplete(true);
      } else {
        setName("");
        setColors([]);
        setAnalysisComplete(false);
      }
      setSourceImage(null);
      setError(null);
    }
  }, [open, palette]);

  const handleAddColor = useCallback(() => {
    if (colors.length < MAX_COLORS) {
      setColors((prev) => [...prev, DEFAULT_NEW_COLOR]);
    }
  }, [colors.length]);

  const handleUpdateColor = useCallback((index: number, newColor: string) => {
    setColors((prev) => {
      const updated = [...prev];
      updated[index] = newColor;
      return updated;
    });
  }, []);

  const handleDeleteColor = useCallback((index: number) => {
    setColors((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleImageSelected = useCallback((file: File) => {
    setSourceImage(file);
    setError(null);
    setAnalysisComplete(false);
  }, []);

  const handleClearImage = useCallback(() => {
    setSourceImage(null);
  }, []);

  /**
   * Analyze image with AI to extract color palette
   */
  const handleAnalyze = useCallback(async () => {
    if (!sourceImage) {
      setError("Please add an image to analyze colors from");
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const { result, error: analyzeError } = await palettesService.analyzePalette(sourceImage);

      if (analyzeError || !result) {
        setError(analyzeError?.message || "Failed to analyze colors");
        return;
      }

      // Auto-fill form with AI-generated values
      if (result.name && !name.trim()) {
        setName(result.name);
      }
      if (result.colors && result.colors.length > 0) {
        setColors(result.colors.map((c) => c.toUpperCase()));
      }
      setAnalysisComplete(true);
    } catch (err) {
      setError(getErrorMessage(err, "Analysis failed"));
    } finally {
      setIsAnalyzing(false);
    }
  }, [sourceImage, name]);

  /**
   * Save the palette
   */
  const handleSave = useCallback(async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(VALIDATION_NAME_REQUIRED);
      return;
    }

    if (colors.length < MIN_COLORS) {
      setError(`Add at least ${MIN_COLORS} color to the palette`);
      return;
    }

    // Validate all colors
    const invalidColors = colors.filter((c) => !isValidHexColor(c));
    if (invalidColors.length > 0) {
      setError(`Invalid color format: ${invalidColors.join(", ")}`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const data: PaletteInsert | PaletteUpdate = {
        name: trimmedName,
        colors: colors.map(normalizeHexColor),
      };

      await onSave(data);
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save palette"));
    } finally {
      setIsSaving(false);
    }
  }, [name, colors, onSave, onOpenChange]);

  const canAddColor = colors.length < MAX_COLORS;
  const canDeleteColor = colors.length > MIN_COLORS;
  const canAnalyze = !!sourceImage && !isAnalyzing && !isSaving;
  const canSave = name.trim().length > 0 && colors.length >= MIN_COLORS && !isSaving && !isLoading && !isAnalyzing;
  const isProcessing = isAnalyzing || isSaving || isLoading;

  // Paste listener for clipboard images
  useEffect(() => {
    if (!open) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      // Find the first valid image file in the clipboard
      for (const item of Array.from(items)) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file && file.size <= MAX_FILE_SIZE) {
            e.preventDefault();
            handleImageSelected(file);
            return;
          }
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [open, handleImageSelected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Droplets className="h-5 w-5" />
            {isEditMode ? "Edit Palette" : "Create New Palette"}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update your color palette settings."
              : "Upload an image to extract colors, or add colors manually."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* AI Analysis Section */}
          <div className="space-y-3">
            <Label>Extract Colors from Image</Label>
            <p className="text-xs text-muted-foreground">
              Upload an image and let AI extract a color palette from it. Drag, click, or paste (Ctrl+V).
            </p>
            <div className="flex flex-wrap items-start gap-4">
              <ImageUploadZone
                onFileSelected={handleImageSelected}
                disabled={isProcessing}
                currentFile={sourceImage}
                onClear={handleClearImage}
              />
              {sourceImage && (
                <div className="flex flex-col gap-2">
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
                        Analyze Colors
                      </>
                    )}
                  </Button>
                  {analysisComplete && (
                    <span className="text-sm text-green-600">
                      ✓ Colors extracted
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Name Input */}
          <div className="space-y-2">
            <Label htmlFor="palette-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="palette-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g., Ocean Sunset, Forest Greens"
              disabled={isProcessing}
            />
          </div>

          {/* Colors Editor */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>
                Colors ({colors.length}/{MAX_COLORS})
              </Label>
              {canAddColor && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleAddColor}
                  disabled={isProcessing}
                  className="gap-1"
                >
                  <Plus className="h-4 w-4" />
                  Add Color
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Click a color to edit the hex value, double-click to open the color picker.
            </p>
            
            {/* Color chips grid */}
            <div className="grid grid-cols-5 gap-2">
              {colors.map((color, index) => (
                <ColorChip
                  key={`color-${index}`}
                  color={color}
                  index={index}
                  onUpdate={handleUpdateColor}
                  onDelete={handleDeleteColor}
                  canDelete={canDeleteColor}
                  disabled={isProcessing}
                />
              ))}
              {canAddColor && (
                <AddColorButton
                  onClick={handleAddColor}
                  disabled={isProcessing}
                />
              )}
            </div>
          </div>

          {/* Preview Strip */}
          <div className="space-y-2">
            <Label>Preview</Label>
            <PalettePreview colors={colors} />
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
              "Create Palette"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PaletteEditor;
