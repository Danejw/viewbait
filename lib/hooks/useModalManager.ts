"use client";

import { useState, useCallback } from "react";

export interface UseModalManagerReturn {
  // Modal states
  isSubscriptionModalOpen: boolean;
  isExpressionModalOpen: boolean;
  isPoseModalOpen: boolean;
  isAddStyleModalOpen: boolean;
  isAddPaletteModalOpen: boolean;
  isAddFaceModalOpen: boolean;
  isEditModalOpen: boolean;
  isDeleteModalOpen: boolean;
  viewerModalOpen: boolean;

  // Modal actions
  openSubscriptionModal: () => void;
  closeSubscriptionModal: () => void;
  openExpressionModal: () => void;
  closeExpressionModal: () => void;
  openPoseModal: () => void;
  closePoseModal: () => void;
  openAddStyleModal: () => void;
  closeAddStyleModal: () => void;
  openAddPaletteModal: () => void;
  closeAddPaletteModal: () => void;
  openAddFaceModal: () => void;
  closeAddFaceModal: () => void;
  openEditModal: () => void;
  closeEditModal: () => void;
  openDeleteModal: () => void;
  closeDeleteModal: () => void;
  openViewerModal: () => void;
  closeViewerModal: () => void;
  
  // Convenience methods
  closeAllModals: () => void;
}

/**
 * Custom hook to manage all modal states in GeneratorTab
 * Centralizes modal state management and provides consistent API
 */
export function useModalManager(): UseModalManagerReturn {
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isExpressionModalOpen, setIsExpressionModalOpen] = useState(false);
  const [isPoseModalOpen, setIsPoseModalOpen] = useState(false);
  const [isAddStyleModalOpen, setIsAddStyleModalOpen] = useState(false);
  const [isAddPaletteModalOpen, setIsAddPaletteModalOpen] = useState(false);
  const [isAddFaceModalOpen, setIsAddFaceModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [viewerModalOpen, setViewerModalOpen] = useState(false);

  const openSubscriptionModal = useCallback(() => setIsSubscriptionModalOpen(true), []);
  const closeSubscriptionModal = useCallback(() => setIsSubscriptionModalOpen(false), []);
  
  const openExpressionModal = useCallback(() => setIsExpressionModalOpen(true), []);
  const closeExpressionModal = useCallback(() => setIsExpressionModalOpen(false), []);
  
  const openPoseModal = useCallback(() => setIsPoseModalOpen(true), []);
  const closePoseModal = useCallback(() => setIsPoseModalOpen(false), []);
  
  const openAddStyleModal = useCallback(() => setIsAddStyleModalOpen(true), []);
  const closeAddStyleModal = useCallback(() => setIsAddStyleModalOpen(false), []);
  
  const openAddPaletteModal = useCallback(() => setIsAddPaletteModalOpen(true), []);
  const closeAddPaletteModal = useCallback(() => setIsAddPaletteModalOpen(false), []);
  
  const openAddFaceModal = useCallback(() => setIsAddFaceModalOpen(true), []);
  const closeAddFaceModal = useCallback(() => setIsAddFaceModalOpen(false), []);
  
  const openEditModal = useCallback(() => setIsEditModalOpen(true), []);
  const closeEditModal = useCallback(() => setIsEditModalOpen(false), []);
  
  const openDeleteModal = useCallback(() => setIsDeleteModalOpen(true), []);
  const closeDeleteModal = useCallback(() => setIsDeleteModalOpen(false), []);
  
  const openViewerModal = useCallback(() => setViewerModalOpen(true), []);
  const closeViewerModal = useCallback(() => setViewerModalOpen(false), []);

  const closeAllModals = useCallback(() => {
    setIsSubscriptionModalOpen(false);
    setIsExpressionModalOpen(false);
    setIsPoseModalOpen(false);
    setIsAddStyleModalOpen(false);
    setIsAddPaletteModalOpen(false);
    setIsAddFaceModalOpen(false);
    setIsEditModalOpen(false);
    setIsDeleteModalOpen(false);
    setViewerModalOpen(false);
  }, []);

  return {
    isSubscriptionModalOpen,
    isExpressionModalOpen,
    isPoseModalOpen,
    isAddStyleModalOpen,
    isAddPaletteModalOpen,
    isAddFaceModalOpen,
    isEditModalOpen,
    isDeleteModalOpen,
    viewerModalOpen,
    openSubscriptionModal,
    closeSubscriptionModal,
    openExpressionModal,
    closeExpressionModal,
    openPoseModal,
    closePoseModal,
    openAddStyleModal,
    closeAddStyleModal,
    openAddPaletteModal,
    closeAddPaletteModal,
    openAddFaceModal,
    closeAddFaceModal,
    openEditModal,
    closeEditModal,
    openDeleteModal,
    closeDeleteModal,
    openViewerModal,
    closeViewerModal,
    closeAllModals,
  };
}
