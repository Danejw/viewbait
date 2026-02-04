"use client";

/**
 * StudioViewStyles
 * My Styles view - displays and manages saved visual styles.
 */

import React, { useState, useCallback, memo, useMemo } from "react";
import { useStudio } from "@/components/studio/studio-provider";
import { ViewControls, ViewHeader, type FilterOption, type SortOption } from "@/components/studio/view-controls";
import { StyleThumbnailCard, StyleThumbnailCardSkeleton } from "@/components/studio/style-thumbnail-card";
import { StyleEditor } from "@/components/studio/style-editor";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyStateCard } from "@/components/ui/empty-state-card";
import { Palette, RefreshCw, Trash2 } from "lucide-react";
import SubscriptionModal from "@/components/subscription-modal";
import { useAuth } from "@/lib/hooks/useAuth";
import { useStyles } from "@/lib/hooks/useStyles";
import { useSubscription } from "@/lib/hooks/useSubscription";
import type { DbStyle, StyleInsert, StyleUpdate } from "@/lib/types/database";

type StyleFilter = "all" | "mine" | "defaults" | "public";

const STYLE_FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "All Styles" },
  { value: "mine", label: "My Styles" },
  { value: "defaults", label: "Default Styles" },
  { value: "public", label: "Public Styles" },
];

const STYLE_SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
];

function StudioViewStyles() {
  const { user } = useAuth();
  const { actions } = useStudio();
  const { canCreateCustomAssets, tier, productId } = useSubscription();
  const {
    styles,
    isLoading,
    error,
    favoriteIds,
    createStyle,
    updateStyle,
    deleteStyle,
    togglePublic,
    toggleFavorite,
    addReferenceImages,
    removeReferenceImage,
    updatePreview,
    refresh,
  } = useStyles();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<DbStyle | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [styleToDelete, setStyleToDelete] = useState<DbStyle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [filter, setFilter] = useState<StyleFilter>("all");
  const [sortValue, setSortValue] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const filteredStyles = useMemo(() => {
    let result = styles;
    switch (filter) {
      case "mine":
        result = result.filter((s) => s.user_id === user?.id && !s.is_default);
        break;
      case "defaults":
        result = result.filter((s) => s.is_default);
        break;
      case "public":
        result = result.filter((s) => s.is_public && !s.is_default);
        break;
    }
    if (favoritesOnly) result = result.filter((s) => favoriteIds.has(s.id));
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name?.toLowerCase().includes(query) || s.description?.toLowerCase().includes(query)
      );
    }
    result = [...result].sort((a, b) => {
      switch (sortValue) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "name-asc":
          return (a.name || "").localeCompare(b.name || "");
        case "name-desc":
          return (b.name || "").localeCompare(a.name || "");
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return result;
  }, [styles, filter, user?.id, searchQuery, sortValue, favoritesOnly, favoriteIds]);

  const handleAddNew = useCallback(() => {
    setEditingStyle(null);
    setEditorOpen(true);
  }, []);

  const handleEdit = useCallback((style: DbStyle) => {
    setEditingStyle(style);
    setEditorOpen(true);
  }, []);

  const handleDeleteClick = useCallback(
    (id: string) => {
      const style = styles.find((s) => s.id === id);
      if (style) {
        setStyleToDelete(style);
        setDeleteDialogOpen(true);
      }
    },
    [styles]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!styleToDelete || !user) return;
    setIsDeleting(true);
    try {
      await deleteStyle(styleToDelete.id);
      setDeleteDialogOpen(false);
      setStyleToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }, [styleToDelete, user, deleteStyle]);

  const handleTogglePublic = useCallback(async (id: string) => togglePublic(id), [togglePublic]);
  const handleToggleFavorite = useCallback(async (id: string) => toggleFavorite(id), [toggleFavorite]);

  const handleSave = useCallback(
    async (
      data: StyleInsert | StyleUpdate,
      newImages: File[],
      existingUrls: string[],
      previewUrl: string | null
    ) => {
      if (!user) return;
      setIsSaving(true);
      try {
        if (editingStyle) {
          const updateData: StyleUpdate = {
            ...data,
            preview_thumbnail_url: previewUrl || editingStyle.preview_thumbnail_url,
          };
          await updateStyle(editingStyle.id, updateData);
          const removedUrls = (editingStyle.reference_images || []).filter(
            (url) => !existingUrls.includes(url)
          );
          for (const url of removedUrls) await removeReferenceImage(editingStyle.id, url);
          if (newImages.length > 0) {
            const uploadedUrls: string[] = [];
            for (const file of newImages) {
              const ext = file.name.split(".").pop() || "jpg";
              const path = `${user.id}/${editingStyle.id}/ref-${Date.now()}-${uploadedUrls.length}.${ext}`;
              const formData = new FormData();
              formData.set("file", file);
              formData.set("bucket", "style-references");
              formData.set("path", path);
              const res = await fetch("/api/storage/upload", { method: "POST", body: formData });
              if (res.ok) {
                const uploadData = await res.json();
                if (uploadData?.url) uploadedUrls.push(uploadData.url);
              }
            }
            if (uploadedUrls.length > 0) await addReferenceImages(editingStyle.id, uploadedUrls);
          }
          if (previewUrl && previewUrl !== editingStyle.preview_thumbnail_url)
            await updatePreview(editingStyle.id, previewUrl);
        } else {
          const uploadedUrls: string[] = [];
          const tempId = crypto.randomUUID();
          for (const file of newImages) {
            const ext = file.name.split(".").pop() || "jpg";
            const path = `${user.id}/${tempId}/ref-${Date.now()}-${uploadedUrls.length}.${ext}`;
            const formData = new FormData();
            formData.set("file", file);
            formData.set("bucket", "style-references");
            formData.set("path", path);
            const res = await fetch("/api/storage/upload", { method: "POST", body: formData });
            if (res.ok) {
              const uploadData = await res.json();
              if (uploadData?.url) uploadedUrls.push(uploadData.url);
            }
          }
          const insertData: StyleInsert = {
            ...data,
            name: data.name || "Untitled Style",
            reference_images: uploadedUrls,
            preview_thumbnail_url: previewUrl,
          };
          await createStyle(insertData);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [user, editingStyle, createStyle, updateStyle, addReferenceImages, removeReferenceImage, updatePreview]
  );

  const handleRefresh = useCallback(() => refresh(), [refresh]);
  const handleFilterChange = useCallback((value: string) => setFilter(value as StyleFilter), []);
  const handleSortChange = useCallback((value: string) => setSortValue(value), []);
  const handleSearchChange = useCallback((query: string) => setSearchQuery(query), []);
  const handleFavoritesToggle = useCallback((value: boolean) => setFavoritesOnly(value), []);

  if (error) {
    return (
      <div>
        <ViewHeader title="My Styles" description="Manage your saved visual styles" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">{error.message || "Failed to load styles"}</p>
            <Button variant="outline" onClick={handleRefresh} className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <ViewHeader
        title="My Styles"
        description="Manage your saved visual styles for consistent thumbnail generation"
        count={filteredStyles.length}
        countLabel="styles"
      />
      <ViewControls
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search styles..."
        showSearch={true}
        filterValue={filter}
        filterOptions={STYLE_FILTER_OPTIONS}
        onFilterChange={handleFilterChange}
        showFilter={true}
        sortValue={sortValue}
        sortOptions={STYLE_SORT_OPTIONS}
        onSortChange={handleSortChange}
        showSort={true}
        favoritesOnly={favoritesOnly}
        onFavoritesToggle={handleFavoritesToggle}
        showFavorites={true}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
        showRefresh={true}
        onAdd={handleAddNew}
        addLabel="Add Style"
        showAdd={true}
        addDisabled={!canCreateCustomAssets()}
        addLockIcon={true}
        onUpgradeClick={() => setSubscriptionModalOpen(true)}
        className="mb-6"
      />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <StyleThumbnailCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredStyles.length === 0 ? (
        <EmptyStateCard
          icon={<Palette />}
          title={
            searchQuery
              ? "No styles match your search"
              : favoritesOnly
                ? "No favorite styles"
                : filter === "all"
                  ? "No styles saved yet"
                  : filter === "mine"
                    ? "You haven't created any styles"
                    : filter === "defaults"
                      ? "No default styles available"
                      : "No public styles found"
          }
          description={
            searchQuery
              ? "Try adjusting your search or clear filters."
              : favoritesOnly
                ? "Mark some styles as favorites to see them here."
                : filter === "all" || filter === "mine"
                  ? "Create visual styles to maintain consistency across your thumbnails. Upload reference images and let AI analyze the style."
                  : "Browse other filter options to find styles."
          }
          primaryAction={
            !searchQuery && !favoritesOnly && (filter === "all" || filter === "mine")
              ? {
                  label: "Create Your First Style",
                  onClick: handleAddNew,
                  disabled: !canCreateCustomAssets(),
                  showLock: !canCreateCustomAssets(),
                }
              : undefined
          }
          onUpgradeClick={!canCreateCustomAssets() ? () => setSubscriptionModalOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStyles.map((style) => {
            const isDb = "user_id" in style && (style as DbStyle).user_id != null;
            const dbStyle = isDb ? (style as DbStyle) : null;
            const canTogglePublic = dbStyle && !dbStyle.is_default;
            return (
              <StyleThumbnailCard
                key={style.id}
                style={style}
                currentUserId={user?.id}
                isFavorite={favoriteIds.has(style.id)}
                onView={actions.onViewStyle}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onToggleFavorite={handleToggleFavorite}
                onTogglePublic={canTogglePublic ? handleTogglePublic : undefined}
                isPublic={dbStyle ? dbStyle.is_public : false}
              />
            );
          })}
        </div>
      )}
      <StyleEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        style={editingStyle}
        onSave={handleSave}
        isLoading={isSaving}
      />
      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        currentTier={tier}
        currentProductId={productId}
      />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Style</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{styleToDelete?.name}&quot;? This will also
              delete all associated reference images and the preview thumbnail. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <ViewBaitLogo className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default memo(StudioViewStyles);
