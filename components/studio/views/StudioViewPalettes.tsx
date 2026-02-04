"use client";

/**
 * StudioViewPalettes
 * My Palettes view - displays and manages saved color palettes.
 */

import React, { useState, useCallback, memo, useMemo } from "react";
import { useStudio } from "@/components/studio/studio-provider";
import { ViewControls, ViewHeader, type FilterOption, type SortOption } from "@/components/studio/view-controls";
import { PaletteCardManage, PaletteCardManageSkeleton } from "@/components/studio/palette-card-manage";
import { PaletteEditor } from "@/components/studio/palette-editor";
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
import { Droplets, RefreshCw } from "lucide-react";
import SubscriptionModal from "@/components/subscription-modal";
import { useAuth } from "@/lib/hooks/useAuth";
import { usePalettes } from "@/lib/hooks/usePalettes";
import { useSubscription } from "@/lib/hooks/useSubscription";
import type { DbPalette, PaletteInsert, PaletteUpdate } from "@/lib/types/database";

type PaletteFilter = "all" | "mine" | "defaults" | "public";

const PALETTE_FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "All Palettes" },
  { value: "mine", label: "My Palettes" },
  { value: "defaults", label: "Default Palettes" },
  { value: "public", label: "Public Palettes" },
];

const PALETTE_SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
];

function StudioViewPalettes() {
  const { user } = useAuth();
  const { actions } = useStudio();
  const { canCreateCustomAssets, tier, productId } = useSubscription();
  const {
    palettes,
    isLoading,
    error,
    favoriteIds,
    createPalette,
    updatePalette,
    deletePalette,
    togglePublic,
    toggleFavorite,
    refresh,
  } = usePalettes();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPalette, setEditingPalette] = useState<DbPalette | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paletteToDelete, setPaletteToDelete] = useState<DbPalette | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [filter, setFilter] = useState<PaletteFilter>("all");
  const [sortValue, setSortValue] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  const filteredPalettes = useMemo(() => {
    let result = palettes;
    switch (filter) {
      case "mine":
        result = result.filter((p) => p.user_id === user?.id && !p.is_default);
        break;
      case "defaults":
        result = result.filter((p) => p.is_default);
        break;
      case "public":
        result = result.filter((p) => p.is_public && !p.is_default);
        break;
    }
    if (favoritesOnly) result = result.filter((p) => favoriteIds.has(p.id));
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(query) ||
          p.colors.some((c) => c.toLowerCase().includes(query))
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
  }, [palettes, filter, user?.id, searchQuery, sortValue, favoritesOnly, favoriteIds]);

  const handleAddNew = useCallback(() => {
    setEditingPalette(null);
    setEditorOpen(true);
  }, []);

  const handleEdit = useCallback((palette: DbPalette) => {
    setEditingPalette(palette);
    setEditorOpen(true);
  }, []);

  const handleDeleteClick = useCallback(
    (id: string) => {
      const palette = palettes.find((p) => p.id === id);
      if (palette) {
        setPaletteToDelete(palette);
        setDeleteDialogOpen(true);
      }
    },
    [palettes]
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!paletteToDelete || !user) return;
    setIsDeleting(true);
    try {
      await deletePalette(paletteToDelete.id);
      setDeleteDialogOpen(false);
      setPaletteToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  }, [paletteToDelete, user, deletePalette]);

  const handleTogglePublic = useCallback(async (id: string) => togglePublic(id), [togglePublic]);
  const handleToggleFavorite = useCallback(async (id: string) => toggleFavorite(id), [toggleFavorite]);

  const handleSave = useCallback(
    async (data: PaletteInsert | PaletteUpdate) => {
      if (!user) return;
      setIsSaving(true);
      try {
        if (editingPalette) {
          await updatePalette(editingPalette.id, data);
        } else {
          const insertData: PaletteInsert = {
            ...data,
            name: data.name || "Untitled Palette",
            colors: data.colors ?? [],
          };
          await createPalette(insertData);
        }
        await refresh();
      } finally {
        setIsSaving(false);
      }
    },
    [editingPalette, user, createPalette, updatePalette, refresh]
  );

  const handleRefresh = useCallback(() => refresh(), [refresh]);
  const handleFilterChange = useCallback((value: string) => setFilter(value as PaletteFilter), []);
  const handleSortChange = useCallback((value: string) => setSortValue(value), []);
  const handleSearchChange = useCallback((query: string) => setSearchQuery(query), []);
  const handleFavoritesToggle = useCallback((value: boolean) => setFavoritesOnly(value), []);

  if (isLoading) {
    return (
      <div>
        <ViewHeader title="My Palettes" description="Manage your saved color palettes" />
        <div className="mb-6 h-14 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <PaletteCardManageSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <ViewHeader title="My Palettes" description="Manage your saved color palettes" />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">Failed to load palettes</p>
            <Button variant="outline" className="mt-4" onClick={handleRefresh}>
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
        title="My Palettes"
        description="Manage your saved color palettes"
        count={filteredPalettes.length}
        countLabel="palettes"
      />
      <ViewControls
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search palettes..."
        showSearch={true}
        filterValue={filter}
        filterOptions={PALETTE_FILTER_OPTIONS}
        onFilterChange={handleFilterChange}
        showFilter={true}
        sortValue={sortValue}
        sortOptions={PALETTE_SORT_OPTIONS}
        onSortChange={handleSortChange}
        showSort={true}
        favoritesOnly={favoritesOnly}
        onFavoritesToggle={handleFavoritesToggle}
        showFavorites={true}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
        showRefresh={true}
        onAdd={handleAddNew}
        addLabel="Add Palette"
        showAdd={true}
        addDisabled={!canCreateCustomAssets()}
        addLockIcon={true}
        onUpgradeClick={() => setSubscriptionModalOpen(true)}
        className="mb-6"
      />
      {filteredPalettes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPalettes.map((palette) => (
            <PaletteCardManage
              key={palette.id}
              palette={palette}
              isFavorite={favoriteIds.has(palette.id)}
              showActions={true}
              currentUserId={user?.id}
              onView={actions.onViewPalette}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onTogglePublic={handleTogglePublic}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <EmptyStateCard
          icon={<Droplets />}
          title={
            searchQuery
              ? "No palettes match your search"
              : favoritesOnly
                ? "No favorite palettes"
                : filter === "all"
                  ? "No palettes yet"
                  : filter === "mine"
                    ? "No custom palettes yet"
                    : filter === "defaults"
                      ? "No default palettes"
                      : "No public palettes"
          }
          description={
            searchQuery
              ? "Try adjusting your search or clear filters."
              : favoritesOnly
                ? "Mark some palettes as favorites to see them here."
                : filter === "all" || filter === "mine"
                  ? "Create color palettes to maintain consistency across your thumbnails."
                  : "Browse other filter options to find palettes."
          }
          primaryAction={
            !searchQuery && !favoritesOnly && (filter === "all" || filter === "mine")
              ? {
                  label: "Create Your First Palette",
                  onClick: handleAddNew,
                  disabled: !canCreateCustomAssets(),
                  showLock: !canCreateCustomAssets(),
                }
              : undefined
          }
          onUpgradeClick={!canCreateCustomAssets() ? () => setSubscriptionModalOpen(true) : undefined}
        />
      )}
      <PaletteEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        palette={editingPalette}
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
            <AlertDialogTitle>Delete Palette</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{paletteToDelete?.name}&quot;? This action cannot
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
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default memo(StudioViewPalettes);
