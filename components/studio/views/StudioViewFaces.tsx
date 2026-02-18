"use client";

/**
 * StudioViewFaces
 * My Faces view - displays and manages saved face references.
 */

import React, { useState, useCallback, memo, useMemo } from "react";
import { useStudio } from "@/components/studio/studio-provider";
import { ViewControls, ViewHeader, type SortOption } from "@/components/studio/view-controls";
import { FaceThumbnail, FaceThumbnailSkeleton } from "@/components/studio/face-thumbnail";
import { FaceEditor } from "@/components/studio/face-editor";
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
import { User, RefreshCw, Trash2 } from "lucide-react";
import SubscriptionModal from "@/components/subscription-modal";
import { useAuth } from "@/lib/hooks/useAuth";
import { useFaces } from "@/lib/hooks/useFaces";
import { useSubscription } from "@/lib/hooks/useSubscription";
import type { DbFace } from "@/lib/types/database";

const FACE_SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
];

function StudioViewFaces() {
  const { user } = useAuth();
  const { actions } = useStudio();
  const { canCreateCustomAssets, tier, productId } = useSubscription();
  const {
    faces: allFaces,
    isLoading,
    error,
    createFace,
    updateFace,
    deleteFace,
    addImage,
    removeImage,
    updateName,
    refresh,
  } = useFaces();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFace, setEditingFace] = useState<DbFace | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [faceToDelete, setFaceToDelete] = useState<DbFace | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [sortValue, setSortValue] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    emitTourEvent("tour.event.route.ready", {
      routeKey: "studio.faces",
      anchorsPresent: ["tour.studio.faces.grid.container.main"],
    });
  }, []);

  const faces = useMemo(() => {
    let result = allFaces;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((f) => f.name?.toLowerCase().includes(query));
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
  }, [allFaces, searchQuery, sortValue]);

  const handleAddNew = useCallback(() => {
    setEditingFace(null);
    setEditorOpen(true);
  }, []);

  const handleEdit = useCallback((face: DbFace) => {
    setEditingFace(face);
    setEditorOpen(true);
  }, []);

  const handleDeleteClick = useCallback((id: string) => {
    const face = faces.find((f) => f.id === id);
    if (face) {
      setFaceToDelete(face);
      setDeleteDialogOpen(true);
    }
  }, [faces]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!faceToDelete) return;
    setIsDeleting(true);
    try {
      await deleteFace(faceToDelete.id);
      setDeleteDialogOpen(false);
      setFaceToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }, [faceToDelete, deleteFace]);

  const handleSave = useCallback(
    async (name: string, newImages: File[], existingUrls: string[]) => {
      if (!user) return;
      setIsSaving(true);
      try {
        if (editingFace) {
          if (name !== editingFace.name) await updateName(editingFace.id, name);
          const removedUrls = (editingFace.image_urls || []).filter(
            (url) => !existingUrls.includes(url)
          );
          for (const url of removedUrls) await removeImage(editingFace.id, url);
          for (const file of newImages) await addImage(editingFace.id, file);
        } else {
          await createFace(name, newImages);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [user, editingFace, createFace, updateName, addImage, removeImage]
  );

  const handleRefresh = useCallback(() => refresh(), [refresh]);
  const handleSortChange = useCallback((value: string) => setSortValue(value), []);
  const handleSearchChange = useCallback((query: string) => setSearchQuery(query), []);

  if (error) {
    return (
      <div data-tour="tour.studio.faces.grid.container.main">
        <ViewHeader title="My Faces" description="Manage your saved face references" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">{error.message || "Failed to load faces"}</p>
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
    <div data-tour="tour.studio.faces.grid.container.main">
      <ViewHeader
        title="My Faces"
        description="Manage your saved face references for consistent thumbnail generation"
        count={faces.length}
        countLabel="faces"
      />
      <ViewControls
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search faces..."
        showSearch={true}
        showFilter={false}
        sortValue={sortValue}
        sortOptions={FACE_SORT_OPTIONS}
        onSortChange={handleSortChange}
        showSort={true}
        showFavorites={false}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
        showRefresh={true}
        onAdd={handleAddNew}
        addLabel="Add Face"
        showAdd={true}
        addDisabled={!canCreateCustomAssets()}
        addLockIcon={true}
        onUpgradeClick={() => setSubscriptionModalOpen(true)}
        className="mb-6"
      />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 p-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <FaceThumbnailSkeleton key={i} />
          ))}
        </div>
      ) : faces.length === 0 ? (
        <EmptyStateCard
          icon={<User />}
          title={searchQuery ? "No faces match your search" : "No faces saved yet"}
          description={
            searchQuery
              ? "Try adjusting your search."
              : "Add face references to maintain consistent character appearances in your generated thumbnails."
          }
          primaryAction={
            !searchQuery
              ? {
                  label: "Add Your First Face",
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
          {faces.map((face) => (
            <FaceThumbnail
              key={face.id}
              face={face}
              currentUserId={user?.id}
              variant="card"
              onView={actions.onViewFace}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}
      <FaceEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        face={editingFace}
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
            <AlertDialogTitle>Delete Face</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{faceToDelete?.name}&quot;? This will also delete
              all associated reference images. This action cannot be undone.
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

export default memo(StudioViewFaces);
