"use client";

/**
 * Registration Handlers Hook
 * 
 * Manages all registration form state and handlers for styles, palettes, and faces.
 * Extracted from GeneratorTab to improve component decomposition and testability.
 */

import { useState, useRef, useCallback, useEffect, type ChangeEvent } from "react";
import type { User } from "@supabase/supabase-js";
import type { DbStyle, DbPalette, DbFace, StyleInsert, PaletteInsert } from "@/lib/types/database";
import type { UseModalManagerReturn } from "./useModalManager";
import * as stylesService from "@/lib/services/styles";
import * as palettesService from "@/lib/services/palettes";
import { logClientError } from "@/lib/utils/client-logger";

export interface UseRegistrationHandlersProps {
  user: User | null;
  modals: UseModalManagerReturn;
  createStyle: (data: StyleInsert) => Promise<DbStyle | null>;
  createPalette: (data: PaletteInsert) => Promise<DbPalette | null>;
  createFace: (name: string, files: File[]) => Promise<DbFace | null>;
}

export interface UseRegistrationHandlersReturn {
  // Style registration
  styleReferenceImage: string | null;
  setStyleReferenceImage: (image: string | null) => void;
  styleReferenceImageFile: File | null;
  setStyleReferenceImageFile: (file: File | null) => void;
  styleName: string;
  setStyleName: (name: string) => void;
  styleDescription: string;
  setStyleDescription: (desc: string) => void;
  stylePrompt: string;
  setStylePrompt: (prompt: string) => void;
  stylePreviewImage: string | null;
  setStylePreviewImage: (image: string | null) => void;
  styleIsPublic: boolean;
  setStyleIsPublic: (isPublic: boolean) => void;
  styleIsAnalyzing: boolean;
  styleIsGeneratingPreview: boolean;
  styleFileInputRef: React.RefObject<HTMLInputElement | null>;
  handleStyleImageUpload: (file: File) => void;
  handleStyleAnalyzeImage: () => Promise<void>;
  handleStyleGeneratePreview: () => Promise<void>;
  handleStyleSaveToLibrary: () => Promise<void>;
  resetStyleForm: () => void;
  
  // Palette registration
  paletteReferenceImage: string | null;
  setPaletteReferenceImage: (image: string | null) => void;
  paletteReferenceImageFile: File | null;
  setPaletteReferenceImageFile: (file: File | null) => void;
  paletteName: string;
  setPaletteName: (name: string) => void;
  paletteDescription: string;
  setPaletteDescription: (desc: string) => void;
  paletteColors: string[];
  setPaletteColors: (colors: string[]) => void;
  paletteIsPublic: boolean;
  setPaletteIsPublic: (isPublic: boolean) => void;
  paletteIsAnalyzing: boolean;
  paletteFileInputRef: React.RefObject<HTMLInputElement | null>;
  handlePaletteImageUpload: (file: File) => void;
  handlePaletteAnalyzeImage: () => Promise<void>;
  handlePalettePickColors: () => void;
  handlePaletteSaveToLibrary: () => Promise<void>;
  resetPaletteForm: () => void;
  
  // Face registration
  faceCharacterName: string;
  setFaceCharacterName: (name: string) => void;
  faceReferenceImages: (string | null)[];
  setFaceReferenceImages: (images: (string | null)[]) => void;
  facePendingFiles: (File | null)[];
  setFacePendingFiles: (files: (File | null)[]) => void;
  faceFileInputRefs: React.RefObject<HTMLInputElement | null>[];
  handleFaceImageUpload: (index: number, event: ChangeEvent<HTMLInputElement>) => void;
  handleFaceRemoveImage: (index: number) => void;
  handleFaceSaveToLibrary: () => Promise<void>;
  handleFaceDragOver: (e: React.DragEvent<Element>, index: number) => void;
  handleFaceDragLeave: (e: React.DragEvent<Element>) => void;
  handleFaceDrop: (e: React.DragEvent<Element>, index: number) => void;
  resetFaceForm: () => void;
}

export function useRegistrationHandlers({
  user,
  modals,
  createStyle,
  createPalette,
  createFace,
}: UseRegistrationHandlersProps): UseRegistrationHandlersReturn {
  // Style registration state
  const [styleReferenceImage, setStyleReferenceImage] = useState<string | null>(null);
  const [styleReferenceImageFile, setStyleReferenceImageFile] = useState<File | null>(null);
  const [styleName, setStyleName] = useState("");
  const [styleDescription, setStyleDescription] = useState("");
  const [stylePrompt, setStylePrompt] = useState("");
  const [stylePreviewImage, setStylePreviewImage] = useState<string | null>(null);
  const [styleIsPublic, setStyleIsPublic] = useState(false);
  const [styleIsAnalyzing, setStyleIsAnalyzing] = useState(false);
  const [styleIsGeneratingPreview, setStyleIsGeneratingPreview] = useState(false);
  const styleFileInputRef = useRef<HTMLInputElement>(null);

  // Palette registration state
  const [paletteReferenceImage, setPaletteReferenceImage] = useState<string | null>(null);
  const [paletteReferenceImageFile, setPaletteReferenceImageFile] = useState<File | null>(null);
  const [paletteName, setPaletteName] = useState("");
  const [paletteDescription, setPaletteDescription] = useState("");
  const [paletteColors, setPaletteColors] = useState<string[]>([]);
  const [paletteIsPublic, setPaletteIsPublic] = useState(false);
  const [paletteIsAnalyzing, setPaletteIsAnalyzing] = useState(false);
  const paletteFileInputRef = useRef<HTMLInputElement>(null);

  // Face registration state
  const [faceCharacterName, setFaceCharacterName] = useState("");
  const [faceReferenceImages, setFaceReferenceImages] = useState<(string | null)[]>([null, null, null]);
  const [facePendingFiles, setFacePendingFiles] = useState<(File | null)[]>([null, null, null]);
  const faceFileInputRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  
  // Refs to track current state values for use in callbacks
  const faceReferenceImagesRef = useRef<(string | null)[]>([null, null, null]);
  const facePendingFilesRef = useRef<(File | null)[]>([null, null, null]);
  
  // Keep refs in sync with state
  useEffect(() => {
    faceReferenceImagesRef.current = faceReferenceImages;
  }, [faceReferenceImages]);
  
  useEffect(() => {
    facePendingFilesRef.current = facePendingFiles;
  }, [facePendingFiles]);

  // Helper function to process style image file
  const processStyleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image size must be less than 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setStyleReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // Style registration handlers
  const handleStyleImageUpload = useCallback((file: File) => {
    processStyleImageFile(file);
    setStyleReferenceImageFile(file);
  }, [processStyleImageFile]);

  const handleStyleAnalyzeImage = useCallback(async () => {
    if (!styleReferenceImageFile) {
      alert("Please upload an image first");
      return;
    }
    setStyleIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append('images', styleReferenceImageFile);
      const response = await fetch('/api/analyze-style', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze image');
      }
      const data = await response.json();
      if (data.name) setStyleName(data.name);
      if (data.description) setStyleDescription(data.description);
      if (data.prompt) setStylePrompt(data.prompt);
    } catch (error) {
      logClientError(error, { component: 'useRegistrationHandlers', operation: 'analyzeStyleImage' });
      alert(error instanceof Error ? error.message : "Failed to analyze image. Please try again.");
    } finally {
      setStyleIsAnalyzing(false);
    }
  }, [styleReferenceImageFile]);

  const handleStyleGeneratePreview = useCallback(async () => {
    if (!stylePrompt.trim()) {
      alert("Please enter a style prompt first");
      return;
    }
    setStyleIsGeneratingPreview(true);
    try {
      const { imageUrl, error: previewError } = await stylesService.generateStylePreview({
        prompt: stylePrompt.trim(),
        referenceImageUrl: styleReferenceImage || undefined,
      });
      if (previewError) {
        alert(previewError.message || "Failed to generate preview. Please try again.");
        return;
      }
      if (imageUrl) setStylePreviewImage(imageUrl);
    } catch (error) {
      logClientError(error, { component: 'useRegistrationHandlers', operation: 'generateStylePreview' });
      alert("Failed to generate preview. Please try again.");
    } finally {
      setStyleIsGeneratingPreview(false);
    }
  }, [stylePrompt, styleReferenceImage]);

  const handleStyleSaveToLibrary = useCallback(async () => {
    if (!user) {
      alert("Please sign in to save styles");
      return;
    }
    if (!styleName.trim()) {
      alert("Please enter a style name");
      return;
    }
    if (!stylePrompt.trim()) {
      alert("Please enter a generation prompt");
      return;
    }
    if (!stylePreviewImage) {
      alert("Please generate a preview first");
      return;
    }
    if (!styleReferenceImage) {
      alert("Please upload a reference image");
      return;
    }
    try {
      const newStyle = await createStyle({
        user_id: user.id,
        name: styleName.trim(),
        description: styleDescription.trim() || null,
        prompt: stylePrompt.trim(),
        colors: [],
        reference_images: [styleReferenceImage],
        preview_thumbnail_url: stylePreviewImage,
        is_public: styleIsPublic,
      });
      if (newStyle) {
        resetStyleForm();
        modals.closeAddStyleModal();
      }
    } catch (error) {
      logClientError(error, { component: 'useRegistrationHandlers', operation: 'saveStyle' });
      alert("Failed to save style. Please try again.");
    }
  }, [user, styleName, stylePrompt, stylePreviewImage, styleReferenceImage, styleDescription, styleIsPublic, createStyle, modals]);

  const resetStyleForm = useCallback(() => {
    setStyleReferenceImage(null);
    setStyleReferenceImageFile(null);
    setStyleName("");
    setStyleDescription("");
    setStylePrompt("");
    setStylePreviewImage(null);
    setStyleIsPublic(false);
    if (styleFileInputRef.current) {
      styleFileInputRef.current.value = "";
    }
  }, []);

  // Helper function to process palette image file
  const processPaletteImageFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image size must be less than 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setPaletteReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // Palette registration handlers
  const handlePaletteImageUpload = useCallback((file: File) => {
    processPaletteImageFile(file);
    setPaletteReferenceImageFile(file);
  }, [processPaletteImageFile]);

  const handlePaletteAnalyzeImage = useCallback(async () => {
    if (!paletteReferenceImageFile) {
      alert("Please upload an image first");
      return;
    }
    setPaletteIsAnalyzing(true);
    try {
      const { result, error: analyzeError } = await palettesService.analyzePalette(paletteReferenceImageFile);
      if (analyzeError) {
        alert(analyzeError.message || "Failed to analyze image. Please try again.");
        return;
      }
      if (result) {
        setPaletteColors(result.colors || []);
        if (result.name) setPaletteName(result.name);
        if (result.description) setPaletteDescription(result.description);
      }
    } catch (error) {
      logClientError(error, { component: 'useRegistrationHandlers', operation: 'analyzePaletteImage' });
      alert("Failed to analyze image. Please try again.");
    } finally {
      setPaletteIsAnalyzing(false);
    }
  }, [paletteReferenceImageFile]);

  const handlePalettePickColors = useCallback(() => {
    // Color picker is handled by RegisterNewPaletteCard component
  }, []);

  const handlePaletteSaveToLibrary = useCallback(async () => {
    if (!user) {
      alert("Please sign in to save palettes");
      return;
    }
    if (!paletteName.trim()) {
      alert("Please enter a palette name");
      return;
    }
    if (paletteColors.length === 0) {
      alert("Please pick colors or analyze an image");
      return;
    }
    try {
      const newPalette = await createPalette({
        user_id: user.id,
        name: paletteName.trim(),
        colors: paletteColors,
        is_public: paletteIsPublic,
      });
      if (newPalette) {
        resetPaletteForm();
        modals.closeAddPaletteModal();
      }
    } catch (error) {
      logClientError(error, { component: 'useRegistrationHandlers', operation: 'savePalette' });
      alert("Failed to save palette. Please try again.");
    }
  }, [user, paletteName, paletteColors, paletteIsPublic, createPalette, modals]);

  const resetPaletteForm = useCallback(() => {
    setPaletteReferenceImage(null);
    setPaletteReferenceImageFile(null);
    setPaletteName("");
    setPaletteDescription("");
    setPaletteColors([]);
    setPaletteIsPublic(false);
    if (paletteFileInputRef.current) {
      paletteFileInputRef.current.value = "";
    }
  }, []);

  // Helper function to process face image file
  const processFaceImageFile = useCallback((file: File, index: number) => {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image size must be less than 10MB");
      return;
    }
    setFacePendingFiles((prev) => {
      const newPendingFiles = [...prev];
      newPendingFiles[index] = file;
      return newPendingFiles;
    });
    const reader = new FileReader();
    reader.onloadend = () => {
      setFaceReferenceImages((prev) => {
        const newImages = [...prev];
        newImages[index] = reader.result as string;
        return newImages;
      });
    };
    reader.readAsDataURL(file);
  }, []);

  // Face registration handlers
  const handleFaceImageUpload = useCallback((index: number, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    processFaceImageFile(file, index);
  }, [processFaceImageFile]);

  const handleFaceRemoveImage = useCallback((index: number) => {
    setFaceReferenceImages((prev) => {
      const newImages = [...prev];
      newImages[index] = null;
      return newImages;
    });
    setFacePendingFiles((prev) => {
      const newPendingFiles = [...prev];
      newPendingFiles[index] = null;
      return newPendingFiles;
    });
    if (faceFileInputRefs[index].current) {
      faceFileInputRefs[index].current!.value = "";
    }
  }, [faceFileInputRefs]);

  const handleFaceDragOver = useCallback((e: React.DragEvent<Element>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.classList.add("border-primary", "bg-primary/10");
    }
  }, []);

  const handleFaceDragLeave = useCallback((e: React.DragEvent<Element>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.classList.remove("border-primary", "bg-primary/10");
    }
  }, []);

  const handleFaceDrop = useCallback((e: React.DragEvent<Element>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.classList.remove("border-primary", "bg-primary/10");
    }
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      processFaceImageFile(file, index);
    }
  }, [processFaceImageFile]);

  const resetFaceForm = useCallback(() => {
    setFaceCharacterName("");
    setFaceReferenceImages([null, null, null]);
    setFacePendingFiles([null, null, null]);
    faceFileInputRefs.forEach((ref) => {
      if (ref.current) {
        ref.current.value = "";
      }
    });
  }, [faceFileInputRefs]);

  const handleFaceSaveToLibrary = useCallback(async () => {
    if (!user) {
      alert("Please sign in to save faces");
      return;
    }
    if (!faceCharacterName.trim()) {
      alert("Please enter a character name");
      return;
    }
    
    const hasImages = faceReferenceImagesRef.current.some((img) => img !== null);
    if (!hasImages) {
      alert("Please upload at least one reference image");
      return;
    }
    
    try {
      const filesToUpload = facePendingFilesRef.current.filter((f): f is File => f !== null);
      const newFace = await createFace(faceCharacterName.trim(), filesToUpload);
      if (newFace) {
        resetFaceForm();
        modals.closeAddFaceModal();
      }
    } catch (error) {
      logClientError(error, { component: 'useRegistrationHandlers', operation: 'saveFace' });
      alert("Failed to save face. Please try again.");
    }
  }, [user, faceCharacterName, createFace, modals, resetFaceForm]);

  return {
    // Style registration
    styleReferenceImage,
    setStyleReferenceImage,
    styleReferenceImageFile,
    setStyleReferenceImageFile,
    styleName,
    setStyleName,
    styleDescription,
    setStyleDescription,
    stylePrompt,
    setStylePrompt,
    stylePreviewImage,
    setStylePreviewImage,
    styleIsPublic,
    setStyleIsPublic,
    styleIsAnalyzing,
    styleIsGeneratingPreview,
    styleFileInputRef,
    handleStyleImageUpload,
    handleStyleAnalyzeImage,
    handleStyleGeneratePreview,
    handleStyleSaveToLibrary,
    resetStyleForm,
    
    // Palette registration
    paletteReferenceImage,
    setPaletteReferenceImage,
    paletteReferenceImageFile,
    setPaletteReferenceImageFile,
    paletteName,
    setPaletteName,
    paletteDescription,
    setPaletteDescription,
    paletteColors,
    setPaletteColors,
    paletteIsPublic,
    setPaletteIsPublic,
    paletteIsAnalyzing,
    paletteFileInputRef,
    handlePaletteImageUpload,
    handlePaletteAnalyzeImage,
    handlePalettePickColors,
    handlePaletteSaveToLibrary,
    resetPaletteForm,
    
    // Face registration
    faceCharacterName,
    setFaceCharacterName,
    faceReferenceImages,
    setFaceReferenceImages,
    facePendingFiles,
    setFacePendingFiles,
    faceFileInputRefs,
    handleFaceImageUpload,
    handleFaceRemoveImage,
    handleFaceSaveToLibrary,
    handleFaceDragOver,
    handleFaceDragLeave,
    handleFaceDrop,
    resetFaceForm,
  };
}
