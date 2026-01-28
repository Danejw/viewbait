"use client";

import React, { useState, useCallback, memo, useMemo } from "react";
import { useStudio } from "./studio-provider";
import { StudioGenerator } from "./studio-generator";
import { StudioResults } from "./studio-results";
import { ThumbnailGrid } from "./thumbnail-grid";
import { GalleryControls } from "./gallery-controls";
import { FaceThumbnail, FaceThumbnailSkeleton } from "./face-thumbnail";
import { FaceEditor } from "./face-editor";
import { StyleThumbnailCard, StyleThumbnailCardSkeleton } from "./style-thumbnail-card";
import { StyleEditor } from "./style-editor";
import { PaletteCardManage, PaletteCardManageSkeleton } from "./palette-card-manage";
import { PaletteEditor } from "./palette-editor";
import { ViewControls, ViewHeader, type FilterOption, type SortOption, DEFAULT_SORT_OPTIONS } from "./view-controls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Grid3x3, FolderOpen, Palette, Droplets, User, Youtube, RefreshCw, ChevronDown, Plus, Trash2, ImageIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrowseThumbnails } from "./browse-thumbnails";
import { BrowseStyles } from "./browse-styles";
import { BrowsePalettes } from "./browse-palettes";
import { usePrefetchPublicContent } from "@/lib/hooks/usePublicContent";
import { useThumbnails } from "@/lib/hooks/useThumbnails";
import { useFaces } from "@/lib/hooks/useFaces";
import { useStyles } from "@/lib/hooks/useStyles";
import { usePalettes } from "@/lib/hooks/usePalettes";
import type { ThumbnailSortOption, SortDirection } from "@/lib/hooks/useThumbnails";
import type { Thumbnail, DbFace, DbStyle, DbPalette, StyleInsert, StyleUpdate, PaletteInsert, PaletteUpdate } from "@/lib/types/database";
import { useAuth } from "@/lib/hooks/useAuth";
import { cn } from "@/lib/utils";

/**
 * StudioViewGallery
 * Gallery view - displays all generated thumbnails with sorting and filtering
 * 
 * Uses local state for sorting/filtering preferences separate from generator view.
 * Optimized with:
 * - Content-visibility for off-screen items (via ThumbnailGrid)
 * - React Query for caching and deduplication
 * - Cursor-based pagination
 * - Optimistic updates for favorites
 */
// Sort options for gallery thumbnails
const GALLERY_SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "title-asc", label: "Title A-Z" },
  { value: "title-desc", label: "Title Z-A" },
];

// Parse sort value to orderBy and orderDirection
function parseGallerySortValue(value: string): { orderBy: ThumbnailSortOption; orderDirection: SortDirection } {
  switch (value) {
    case "oldest":
      return { orderBy: "created_at", orderDirection: "asc" };
    case "title-asc":
      return { orderBy: "title", orderDirection: "asc" };
    case "title-desc":
      return { orderBy: "title", orderDirection: "desc" };
    case "newest":
    default:
      return { orderBy: "created_at", orderDirection: "desc" };
  }
}

export const StudioViewGallery = memo(function StudioViewGallery() {
  const { user, isAuthenticated } = useAuth();
  
  // Local state for sorting, filtering, and search
  const [sortValue, setSortValue] = useState("newest");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Derive orderBy and orderDirection from sortValue
  const { orderBy, orderDirection } = useMemo(() => parseGallerySortValue(sortValue), [sortValue]);

  // Use thumbnails hook with gallery-specific sorting
  const {
    thumbnails: allThumbnails,
    totalCount,
    isLoading,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
  } = useThumbnails({
    userId: user?.id,
    enabled: isAuthenticated,
    limit: 24,
    orderBy,
    orderDirection,
    favoritesOnly,
  });

  // Filter thumbnails by search query (client-side)
  const thumbnails = useMemo(() => {
    if (!searchQuery.trim()) return allThumbnails;
    const query = searchQuery.toLowerCase();
    return allThumbnails.filter((t) =>
      t.name?.toLowerCase().includes(query) ||
      t.title?.toLowerCase().includes(query) ||
      t.prompt?.toLowerCase().includes(query)
    );
  }, [allThumbnails, searchQuery]);

  // Handle sort change
  const handleSortChange = useCallback((value: string) => {
    setSortValue(value);
  }, []);

  // Handle favorites toggle
  const handleFavoritesToggle = useCallback((newFavoritesOnly: boolean) => {
    setFavoritesOnly(newFavoritesOnly);
  }, []);

  // Handle search change
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  // Show error state
  if (isError) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold">Gallery</h1>
          <p className="text-muted-foreground">All your generated thumbnails</p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">
              {error instanceof Error ? error.message : "Failed to load thumbnails"}
            </p>
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
      {/* Header */}
      <ViewHeader
        title="Gallery"
        description="All your generated thumbnails"
        count={searchQuery ? thumbnails.length : totalCount}
        countLabel="thumbnails"
      />

      {/* Controls */}
      <ViewControls
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        searchPlaceholder="Search thumbnails..."
        showSearch={true}
        showFilter={false}
        sortValue={sortValue}
        sortOptions={GALLERY_SORT_OPTIONS}
        onSortChange={handleSortChange}
        showSort={true}
        favoritesOnly={favoritesOnly}
        onFavoritesToggle={handleFavoritesToggle}
        showFavorites={true}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
        showRefresh={true}
        showAdd={false}
        className="mb-6"
      />

      {/* Empty state */}
      {!isLoading && thumbnails.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Grid3x3 className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {favoritesOnly
                ? "No favorite thumbnails yet. Mark some thumbnails as favorites to see them here!"
                : "No thumbnails yet. Generate some to see them here!"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Thumbnail grid - ThumbnailCard handles all actions via context */}
          <ThumbnailGrid
            thumbnails={thumbnails}
            isLoading={isLoading}
            minSlots={12}
            showEmptySlots={false}
          />

          {/* Load more */}
          {hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="gap-2"
              >
                {isFetchingNextPage ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Load More
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
});

/**
 * Browse tab type
 */
type BrowseTab = "thumbnails" | "styles" | "palettes";

/**
 * StudioViewBrowse
 * Browse view - browse public content with tabs for thumbnails, styles, and palettes
 * 
 * Features:
 * - Tabs at the top for switching between content types
 * - Search, sort, and filter within each tab
 * - Prefetching adjacent tabs on hover for fast switching
 * - Optimized with React Query caching
 */
export const StudioViewBrowse = memo(function StudioViewBrowse() {
  // Default to thumbnails tab
  const [activeTab, setActiveTab] = useState<BrowseTab>("thumbnails");
  
  // Prefetch helpers for fast tab switching
  const { prefetchThumbnails, prefetchStyles, prefetchPalettes } = usePrefetchPublicContent();

  // Handle tab change
  const handleTabChange = useCallback((value: string) => {
    setActiveTab(value as BrowseTab);
  }, []);

  // Prefetch adjacent tabs on hover (async-parallel pattern)
  const handleTabHover = useCallback((tab: BrowseTab) => {
    switch (tab) {
      case "thumbnails":
        prefetchThumbnails();
        break;
      case "styles":
        prefetchStyles();
        break;
      case "palettes":
        prefetchPalettes();
        break;
    }
  }, [prefetchThumbnails, prefetchStyles, prefetchPalettes]);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold">Browse</h1>
        <p className="text-muted-foreground">Discover public content from the community</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList variant="line" className="w-full justify-start border-b border-border">
          <TabsTrigger
            value="thumbnails"
            onMouseEnter={() => handleTabHover("thumbnails")}
            onFocus={() => handleTabHover("thumbnails")}
            className={cn(
              "gap-2 px-4 py-2 text-sm font-medium transition-all",
              "data-[state=active]:text-foreground data-[state=active]:font-semibold",
              "data-[state=active]:border-b-2 data-[state=active]:border-primary",
              "data-[state=active]:bg-primary/5 dark:data-[state=active]:bg-primary/10",
              "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground",
              "rounded-t-md rounded-b-none border-b-2 border-transparent",
              "-mb-[2px]"
            )}
          >
            <ImageIcon className="h-4 w-4" />
            Thumbnails
          </TabsTrigger>
          <TabsTrigger
            value="styles"
            onMouseEnter={() => handleTabHover("styles")}
            onFocus={() => handleTabHover("styles")}
            className={cn(
              "gap-2 px-4 py-2 text-sm font-medium transition-all",
              "data-[state=active]:text-foreground data-[state=active]:font-semibold",
              "data-[state=active]:border-b-2 data-[state=active]:border-primary",
              "data-[state=active]:bg-primary/5 dark:data-[state=active]:bg-primary/10",
              "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground",
              "rounded-t-md rounded-b-none border-b-2 border-transparent",
              "-mb-[2px]"
            )}
          >
            <Palette className="h-4 w-4" />
            Styles
          </TabsTrigger>
          <TabsTrigger
            value="palettes"
            onMouseEnter={() => handleTabHover("palettes")}
            onFocus={() => handleTabHover("palettes")}
            className={cn(
              "gap-2 px-4 py-2 text-sm font-medium transition-all",
              "data-[state=active]:text-foreground data-[state=active]:font-semibold",
              "data-[state=active]:border-b-2 data-[state=active]:border-primary",
              "data-[state=active]:bg-primary/5 dark:data-[state=active]:bg-primary/10",
              "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground",
              "rounded-t-md rounded-b-none border-b-2 border-transparent",
              "-mb-[2px]"
            )}
          >
            <Droplets className="h-4 w-4" />
            Palettes
          </TabsTrigger>
        </TabsList>

        {/* Tab content - conditionally rendered for performance */}
        <TabsContent value="thumbnails" className="m-0">
          <BrowseThumbnails />
        </TabsContent>

        <TabsContent value="styles" className="m-0">
          <BrowseStyles />
        </TabsContent>

        <TabsContent value="palettes" className="m-0">
          <BrowsePalettes />
        </TabsContent>
      </Tabs>
    </div>
  );
});

/**
 * StudioViewStyles
 * My Styles view - displays and manages saved visual styles
 * 
 * Features:
 * - Grid display of all saved styles
 * - Create, edit, and delete styles
 * - AI-powered style analysis
 * - Toggle public/private status
 * - Filter by: All, My Styles, Defaults
 * - Uses React Query for caching and deduplication
 */
type StyleFilter = "all" | "mine" | "defaults" | "public";

// Filter options for styles
const STYLE_FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "All Styles" },
  { value: "mine", label: "My Styles" },
  { value: "defaults", label: "Default Styles" },
  { value: "public", label: "Public Styles" },
];

// Sort options for styles
const STYLE_SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
];

export const StudioViewStyles = memo(function StudioViewStyles() {
  const { user } = useAuth();
  const { actions } = useStudio();
  const {
    styles,
    publicStyles,
    defaultStyles,
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

  // Modal states
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<DbStyle | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [styleToDelete, setStyleToDelete] = useState<DbStyle | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filter, sort, and search state
  const [filter, setFilter] = useState<StyleFilter>("all");
  const [sortValue, setSortValue] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Filter, search, sort styles
  const filteredStyles = useMemo(() => {
    let result = styles;

    // Apply filter
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

    // Apply favorites filter
    if (favoritesOnly) {
      result = result.filter((s) => favoriteIds.has(s.id));
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name?.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query)
      );
    }

    // Apply sort
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

  // Open editor for creating a new style
  const handleAddNew = useCallback(() => {
    setEditingStyle(null);
    setEditorOpen(true);
  }, []);

  // Open editor for editing an existing style
  const handleEdit = useCallback((style: DbStyle) => {
    setEditingStyle(style);
    setEditorOpen(true);
  }, []);

  // Open delete confirmation dialog
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

  // Confirm delete
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

  // Toggle public status
  const handleTogglePublic = useCallback(
    async (id: string) => {
      await togglePublic(id);
    },
    [togglePublic]
  );

  // Toggle favorite
  const handleToggleFavorite = useCallback(
    async (id: string) => {
      await toggleFavorite(id);
    },
    [toggleFavorite]
  );

  // Save style (create or update)
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
          // Update existing style
          const updateData: StyleUpdate = {
            ...data,
            preview_thumbnail_url: previewUrl || editingStyle.preview_thumbnail_url,
          };

          // Update basic fields
          await updateStyle(editingStyle.id, updateData);

          // Handle removed images
          const removedUrls = (editingStyle.reference_images || []).filter(
            (url) => !existingUrls.includes(url)
          );
          for (const url of removedUrls) {
            await removeReferenceImage(editingStyle.id, url);
          }

          // Handle new images - upload and add
          if (newImages.length > 0) {
            // Upload images to storage first
            const uploadedUrls: string[] = [];
            for (const file of newImages) {
              const ext = file.name.split(".").pop() || "jpg";
              const path = `${user.id}/${editingStyle.id}/ref-${Date.now()}-${uploadedUrls.length}.${ext}`;

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

            if (uploadedUrls.length > 0) {
              await addReferenceImages(editingStyle.id, uploadedUrls);
            }
          }

          // Update preview if changed
          if (previewUrl && previewUrl !== editingStyle.preview_thumbnail_url) {
            await updatePreview(editingStyle.id, previewUrl);
          }
        } else {
          // Create new style
          // First, upload all reference images
          const uploadedUrls: string[] = [];
          const tempId = crypto.randomUUID();

          for (const file of newImages) {
            const ext = file.name.split(".").pop() || "jpg";
            const path = `${user.id}/${tempId}/ref-${Date.now()}-${uploadedUrls.length}.${ext}`;

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

          // Create the style with uploaded image URLs
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
    [
      user,
      editingStyle,
      createStyle,
      updateStyle,
      addReferenceImages,
      removeReferenceImage,
      updatePreview,
    ]
  );

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // Handler functions for controls
  const handleFilterChange = useCallback((value: string) => {
    setFilter(value as StyleFilter);
  }, []);

  const handleSortChange = useCallback((value: string) => {
    setSortValue(value);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFavoritesToggle = useCallback((value: boolean) => {
    setFavoritesOnly(value);
  }, []);

  // Error state
  if (error) {
    return (
      <div>
        <ViewHeader
          title="My Styles"
          description="Manage your saved visual styles"
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">
              {error.message || "Failed to load styles"}
            </p>
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
      {/* Header */}
      <ViewHeader
        title="My Styles"
        description="Manage your saved visual styles for consistent thumbnail generation"
        count={filteredStyles.length}
        countLabel="styles"
      />

      {/* Controls */}
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
        className="mb-6"
      />

      {/* Content */}
      {isLoading ? (
        // Loading state
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <StyleThumbnailCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredStyles.length === 0 ? (
        // Empty state
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Palette className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">
              {searchQuery
                ? "No styles match your search"
                : favoritesOnly
                ? "No favorite styles"
                : filter === "all"
                ? "No styles saved yet"
                : filter === "mine"
                ? "You haven't created any styles"
                : filter === "defaults"
                ? "No default styles available"
                : "No public styles found"}
            </h3>
            <p className="mb-4 max-w-sm text-center text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search or clear filters."
                : favoritesOnly
                ? "Mark some styles as favorites to see them here."
                : filter === "all" || filter === "mine"
                ? "Create visual styles to maintain consistency across your thumbnails. Upload reference images and let AI analyze the style."
                : "Browse other filter options to find styles."}
            </p>
            {!searchQuery && !favoritesOnly && (filter === "all" || filter === "mine") && (
              <Button onClick={handleAddNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Style
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        // Styles grid
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredStyles.map((style) => (
            <StyleThumbnailCard
              key={style.id}
              style={style}
              currentUserId={user?.id}
              isFavorite={favoriteIds.has(style.id)}
              onView={actions.onViewStyle}
              onEdit={handleEdit}
              onDelete={handleDeleteClick}
              onToggleFavorite={handleToggleFavorite}
            />
          ))}
        </div>
      )}

      {/* Style Editor Modal */}
      <StyleEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        style={editingStyle}
        onSave={handleSave}
        isLoading={isSaving}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Style</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{styleToDelete?.name}&quot;?
              This will also delete all associated reference images and the
              preview thumbnail. This action cannot be undone.
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
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
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
});

/**
 * StudioViewPalettes
 * My Palettes view - displays and manages saved color palettes
 * 
 * Features:
 * - Grid display of all saved palettes
 * - Create, edit, and delete palettes
 * - AI-powered color extraction from images
 * - Manual color editing with hex input and color picker
 * - Uses React Query for caching and deduplication
 */
type PaletteFilter = "all" | "mine" | "defaults" | "public";

// Filter options for palettes
const PALETTE_FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "All Palettes" },
  { value: "mine", label: "My Palettes" },
  { value: "defaults", label: "Default Palettes" },
  { value: "public", label: "Public Palettes" },
];

// Sort options for palettes
const PALETTE_SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
];

export const StudioViewPalettes = memo(function StudioViewPalettes() {
  const { user } = useAuth();
  const { actions } = useStudio();
  const {
    palettes,
    publicPalettes,
    defaultPalettes,
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

  // Modal states
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPalette, setEditingPalette] = useState<DbPalette | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [paletteToDelete, setPaletteToDelete] = useState<DbPalette | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Filter, sort, and search state
  const [filter, setFilter] = useState<PaletteFilter>("all");
  const [sortValue, setSortValue] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  // Filter, search, sort palettes
  const filteredPalettes = useMemo(() => {
    let result = palettes;

    // Apply filter
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

    // Apply favorites filter
    if (favoritesOnly) {
      result = result.filter((p) => favoriteIds.has(p.id));
    }

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.name?.toLowerCase().includes(query) ||
        p.colors.some((c) => c.toLowerCase().includes(query))
      );
    }

    // Apply sort
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

  // Open editor for creating a new palette
  const handleAddNew = useCallback(() => {
    setEditingPalette(null);
    setEditorOpen(true);
  }, []);

  // Open editor for editing an existing palette
  const handleEdit = useCallback((palette: DbPalette) => {
    setEditingPalette(palette);
    setEditorOpen(true);
  }, []);

  // Open delete confirmation dialog
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

  // Confirm delete
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

  // Toggle public status
  const handleTogglePublic = useCallback(
    async (id: string) => {
      await togglePublic(id);
    },
    [togglePublic]
  );

  // Toggle favorite
  const handleToggleFavorite = useCallback(
    async (id: string) => {
      await toggleFavorite(id);
    },
    [toggleFavorite]
  );

  // Save palette (create or update)
  const handleSave = useCallback(
    async (data: PaletteInsert | PaletteUpdate) => {
      if (!user) return;
      setIsSaving(true);

      try {
        if (editingPalette) {
          // Update existing palette
          await updatePalette(editingPalette.id, data);
        } else {
          // Create new palette
          const insertData: PaletteInsert = {
            ...data,
            name: data.name || "Untitled Palette",
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

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // Handler functions for controls
  const handleFilterChange = useCallback((value: string) => {
    setFilter(value as PaletteFilter);
  }, []);

  const handleSortChange = useCallback((value: string) => {
    setSortValue(value);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFavoritesToggle = useCallback((value: boolean) => {
    setFavoritesOnly(value);
  }, []);

  // Loading state - show skeletons
  if (isLoading) {
    return (
      <div>
        <ViewHeader
          title="My Palettes"
          description="Manage your saved color palettes"
        />
        <div className="mb-6 h-14 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <PaletteCardManageSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div>
        <ViewHeader
          title="My Palettes"
          description="Manage your saved color palettes"
        />
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
      {/* Header */}
      <ViewHeader
        title="My Palettes"
        description="Manage your saved color palettes"
        count={filteredPalettes.length}
        countLabel="palettes"
      />

      {/* Controls */}
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
        className="mb-6"
      />

      {/* Palettes Grid */}
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Droplets className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">
              {searchQuery
                ? "No palettes match your search"
                : favoritesOnly
                ? "No favorite palettes"
                : filter === "all"
                ? "No palettes yet"
                : filter === "mine"
                ? "No custom palettes yet"
                : filter === "defaults"
                ? "No default palettes"
                : "No public palettes"}
            </h3>
            <p className="mb-4 max-w-sm text-center text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search or clear filters."
                : favoritesOnly
                ? "Mark some palettes as favorites to see them here."
                : filter === "all" || filter === "mine"
                ? "Create color palettes to maintain consistency across your thumbnails."
                : "Browse other filter options to find palettes."}
            </p>
            {!searchQuery && !favoritesOnly && (filter === "all" || filter === "mine") && (
              <Button onClick={handleAddNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Palette
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Palette Editor Modal */}
      <PaletteEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        palette={editingPalette}
        onSave={handleSave}
        isLoading={isSaving}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Palette</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{paletteToDelete?.name}&quot;? This action
              cannot be undone.
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
});

/**
 * StudioViewFaces
 * My Faces view - displays and manages saved face references
 * 
 * Features:
 * - Grid display of all saved faces
 * - Create, edit, and delete faces
 * - Each face can have up to 3 reference images
 * - Uses React Query for caching and deduplication
 */

// Sort options for faces
const FACE_SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "name-asc", label: "Name A-Z" },
  { value: "name-desc", label: "Name Z-A" },
];

export const StudioViewFaces = memo(function StudioViewFaces() {
  const { user } = useAuth();
  const { actions } = useStudio();
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

  // Modal states
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingFace, setEditingFace] = useState<DbFace | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [faceToDelete, setFaceToDelete] = useState<DbFace | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Search and sort state
  const [sortValue, setSortValue] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");

  // Filter and sort faces
  const faces = useMemo(() => {
    let result = allFaces;

    // Apply search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((f) =>
        f.name?.toLowerCase().includes(query)
      );
    }

    // Apply sort
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

  // Open editor for creating a new face
  const handleAddNew = useCallback(() => {
    setEditingFace(null);
    setEditorOpen(true);
  }, []);

  // Open editor for editing an existing face
  const handleEdit = useCallback((face: DbFace) => {
    setEditingFace(face);
    setEditorOpen(true);
  }, []);

  // Open delete confirmation dialog
  const handleDeleteClick = useCallback((id: string) => {
    const face = faces.find((f) => f.id === id);
    if (face) {
      setFaceToDelete(face);
      setDeleteDialogOpen(true);
    }
  }, [faces]);

  // Confirm delete
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

  // Handle add image to existing face
  const handleAddImage = useCallback((face: DbFace) => {
    // Open editor in edit mode to add images
    setEditingFace(face);
    setEditorOpen(true);
  }, []);

  // Save face (create or update)
  const handleSave = useCallback(
    async (name: string, newImages: File[], existingUrls: string[]) => {
      if (!user) return;
      setIsSaving(true);

      try {
        if (editingFace) {
          // Update existing face
          // First, update the name if changed
          if (name !== editingFace.name) {
            await updateName(editingFace.id, name);
          }

          // Handle removed images (images in original that aren't in existingUrls)
          const removedUrls = (editingFace.image_urls || []).filter(
            (url) => !existingUrls.includes(url)
          );
          for (const url of removedUrls) {
            await removeImage(editingFace.id, url);
          }

          // Handle new images
          for (const file of newImages) {
            await addImage(editingFace.id, file);
          }
        } else {
          // Create new face with images
          await createFace(name, newImages);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [user, editingFace, createFace, updateName, addImage, removeImage]
  );

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  // Handler functions for controls
  const handleSortChange = useCallback((value: string) => {
    setSortValue(value);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Error state
  if (error) {
    return (
      <div>
        <ViewHeader
          title="My Faces"
          description="Manage your saved face references"
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-destructive">
              {error.message || "Failed to load faces"}
            </p>
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
      {/* Header */}
      <ViewHeader
        title="My Faces"
        description="Manage your saved face references for consistent thumbnail generation"
        count={faces.length}
        countLabel="faces"
      />

      {/* Controls */}
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
        className="mb-6"
      />

      {/* Content */}
      {isLoading ? (
        // Loading state – skeletons matching thumbnail-card style
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <FaceThumbnailSkeleton key={i} />
          ))}
        </div>
      ) : faces.length === 0 ? (
        // Empty state
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-medium">
              {searchQuery ? "No faces match your search" : "No faces saved yet"}
            </h3>
            <p className="mb-4 max-w-sm text-center text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search."
                : "Add face references to maintain consistent character appearances in your generated thumbnails."}
            </p>
            {!searchQuery && (
              <Button onClick={handleAddNew} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Face
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        // Faces grid – FaceThumbnail with thumbnail-card styling and view modal
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

      {/* Face Editor Modal */}
      <FaceEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        face={editingFace}
        onSave={handleSave}
        isLoading={isSaving}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Face</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{faceToDelete?.name}&quot;? This will also delete all associated reference images. This action cannot be undone.
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
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
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
});

/**
 * StudioViewYouTube
 * YouTube integration view
 */
export function StudioViewYouTube() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold">YouTube</h1>
        <p className="text-muted-foreground">Connect and manage your YouTube channel</p>
      </div>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Youtube className="mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">YouTube integration coming soon</p>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * StudioMainContent
 * Center content router - renders the main content based on currentView state
 * For generator view, shows the Live Results Feed (StudioResults)
 * The generator form is now in the right sidebar (StudioSettingsSidebar)
 */
export function StudioMainContent() {
  const {
    state: { currentView },
  } = useStudio();

  switch (currentView) {
    case "generator":
      // Generator view shows the live results feed in the center
      return <StudioResults />;
    case "gallery":
      return <StudioViewGallery />;
    case "browse":
      return <StudioViewBrowse />;
    case "styles":
      return <StudioViewStyles />;
    case "palettes":
      return <StudioViewPalettes />;
    case "faces":
      return <StudioViewFaces />;
    case "youtube":
      return <StudioViewYouTube />;
    default:
      return <StudioResults />;
  }
}

/**
 * StudioView
 * @deprecated Use StudioMainContent for center content routing.
 * Main view router that renders the appropriate view based on currentView state
 */
export function StudioView() {
  const {
    state: { currentView },
  } = useStudio();

  switch (currentView) {
    case "generator":
      return <StudioGenerator />;
    case "gallery":
      return <StudioViewGallery />;
    case "browse":
      return <StudioViewBrowse />;
    case "styles":
      return <StudioViewStyles />;
    case "palettes":
      return <StudioViewPalettes />;
    case "faces":
      return <StudioViewFaces />;
    case "youtube":
      return <StudioViewYouTube />;
    default:
      return <StudioGenerator />;
  }
}
