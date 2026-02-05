"use client";

/**
 * StudioViewYouTube
 * YouTube integration view: Connect with Google OAuth when not connected;
 * when connected, shows channel summary and grid of videos (thumbnails + titles).
 * Same layout/UX as Gallery: ViewHeader, ViewControls (refresh, search), grid, load more.
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { Youtube, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ViewControls, ViewHeader, type FilterOption, type SortOption } from "@/components/studio/view-controls";
import { useYouTubeIntegration } from "@/lib/hooks/useYouTubeIntegration";
import { useStyles } from "@/lib/hooks/useStyles";
import { useAuth } from "@/lib/hooks/useAuth";
import { useYouTubeStyleExtract } from "@/lib/hooks/useYouTubeStyleExtract";
import type { DbStyle, StyleInsert, StyleUpdate } from "@/lib/types/database";
import { StyleEditor } from "@/components/studio/style-editor";
import { YouTubeVideoCard, YouTubeVideoCardSkeleton } from "@/components/studio/youtube-video-card";
import { ChannelImportTab } from "@/components/studio/channel-import-tab";
import { YouTubeStyleExtractBar } from "@/components/studio/youtube-style-extract-bar";
import { RecentThumbnailsStrip } from "@/components/studio/recent-thumbnails-strip";
import { CharacterSnapshotsStrip } from "@/components/studio/character-snapshots-strip";
import { PlaceSnapshotsStrip } from "@/components/studio/place-snapshots-strip";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { toast } from "sonner";

export default function StudioViewYouTube() {
  const {
    status,
    channel,
    videos,
    videosHasMore,
    isLoading,
    isRefreshing,
    error,
    refreshStatus,
    fetchChannel,
    fetchVideos,
    loadMoreVideos,
    reconnect,
    clearError,
  } = useYouTubeIntegration();

  const {
    updateStyle,
    addReferenceImages,
    removeReferenceImage,
    updatePreview,
  } = useStyles();

  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterValue, setFilterValue] = useState("all");
  const [sortValue, setSortValue] = useState("newest");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<DbStyle | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isConnected = status?.isConnected === true;

  const YOUTUBE_FILTER_OPTIONS: FilterOption[] = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "shorts", label: "Shorts" },
      { value: "standard", label: "Standard" },
    ],
    []
  );
  const YOUTUBE_SORT_OPTIONS: SortOption[] = useMemo(
    () => [
      { value: "newest", label: "Newest First" },
      { value: "oldest", label: "Oldest First" },
      { value: "most-views", label: "Most Views" },
      { value: "most-likes", label: "Most Liked" },
    ],
    []
  );

  useEffect(() => {
    if (!isConnected) return;
    fetchChannel();
    fetchVideos();
  }, [isConnected, fetchChannel, fetchVideos]);

  const handleRefresh = useCallback(async () => {
    await refreshStatus();
    await fetchChannel();
    await fetchVideos();
  }, [refreshStatus, fetchChannel, fetchVideos]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleFilterChange = useCallback((value: string) => {
    setFilterValue(value);
  }, []);

  const handleSortChange = useCallback((value: string) => {
    setSortValue(value);
  }, []);

  const filteredVideos = useMemo(() => {
    if (!searchQuery.trim()) return videos;
    const q = searchQuery.toLowerCase();
    return videos.filter((v) => v.title?.toLowerCase().includes(q));
  }, [videos, searchQuery]);

  const youtubeStyleExtract = useYouTubeStyleExtract(filteredVideos);
  const handleExtractAndOpenEditor = useCallback(async () => {
    const style = await youtubeStyleExtract.handleExtractStyle();
    if (style) {
      setEditingStyle(style);
      setEditorOpen(true);
    }
  }, [youtubeStyleExtract.handleExtractStyle]);

  const handleSaveStyle = useCallback(
    async (
      data: StyleInsert | StyleUpdate,
      newImages: File[],
      existingUrls: string[],
      previewUrl: string | null
    ) => {
      if (!user || !editingStyle) return;
      setIsSaving(true);
      try {
        const updateData: StyleUpdate = {
          ...data,
          preview_thumbnail_url: previewUrl || editingStyle.preview_thumbnail_url,
        };
        await updateStyle(editingStyle.id, updateData);
        const removedUrls = (editingStyle.reference_images || []).filter(
          (url) => !existingUrls.includes(url)
        );
        for (const url of removedUrls) {
          await removeReferenceImage(editingStyle.id, url);
        }
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
        if (previewUrl && previewUrl !== editingStyle.preview_thumbnail_url) {
          await updatePreview(editingStyle.id, previewUrl);
        }
        toast.success("Style updated");
      } finally {
        setIsSaving(false);
      }
    },
    [
      user,
      editingStyle,
      updateStyle,
      removeReferenceImage,
      addReferenceImages,
      updatePreview,
    ]
  );

  const showVideos = isConnected && !isLoading;
  const showSkeleton = isConnected && (isLoading || isRefreshing) && videos.length === 0;

  return (
    <div>
      <ViewHeader
        title="YouTube"
        description="Your channel and videos"
        count={isConnected ? filteredVideos.length : undefined}
        countLabel="videos"
      />

      <RecentThumbnailsStrip />
      <CharacterSnapshotsStrip />
      <PlaceSnapshotsStrip />

      <Tabs defaultValue="my-channel" className="mt-4">
        <TabsList className="mb-4">
          <TabsTrigger value="my-channel">My channel</TabsTrigger>
          <TabsTrigger value="import">Import by URL</TabsTrigger>
        </TabsList>

        <TabsContent value="my-channel" className="mt-0">
          {!isConnected ? (
            <Card className="mb-6">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Youtube className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-2 text-center text-muted-foreground">
                  Connect with Google to access your YouTube channel. We only request permission to read
                  your channel and videos—no sensitive actions without your consent.
                </p>
                <Button
                  onClick={() => reconnect()}
                  className="gap-2"
                >
                  <Youtube className="h-4 w-4" />
                  Connect with Google
                </Button>
                {error && (
                  <p className="mt-4 text-sm text-destructive">
                    {error}
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {channel && (
                <div className="mb-4 flex items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2">
                  {channel.thumbnailUrl && (
                    <img
                      src={channel.thumbnailUrl}
                      alt={channel.title}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{channel.title}</p>
                    {channel.videoCount != null && (
                      <p className="text-xs text-muted-foreground">
                        {channel.videoCount} video{channel.videoCount !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="mb-4">
                <YouTubeStyleExtractBar
                  selectedCount={youtubeStyleExtract.selectedVideoIds.size}
                  canExtract={youtubeStyleExtract.canExtract}
                  isExtracting={youtubeStyleExtract.isExtracting}
                  extractError={youtubeStyleExtract.extractError}
                  onExtract={handleExtractAndOpenEditor}
                  onClearError={youtubeStyleExtract.clearExtractError}
                />
              </div>

              <ViewControls
                searchQuery={searchQuery}
                onSearchChange={handleSearchChange}
                searchPlaceholder="Search videos..."
                showSearch={true}
                showFilter={true}
                filterValue={filterValue}
                filterOptions={YOUTUBE_FILTER_OPTIONS}
                onFilterChange={handleFilterChange}
                showSort={true}
                sortValue={sortValue}
                sortOptions={YOUTUBE_SORT_OPTIONS}
                onSortChange={handleSortChange}
                showFavorites={false}
                onRefresh={handleRefresh}
                isRefreshing={isRefreshing}
                showRefresh={true}
                showAdd={false}
                className="mb-6"
              />

              {error && (
                <div className="mb-4 flex items-center justify-between rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
                  <p className="text-sm text-destructive">{error}</p>
                  <Button variant="ghost" size="sm" onClick={clearError}>
                    Dismiss
                  </Button>
                </div>
              )}

              {showSkeleton && (
                <div className="grid w-full gap-3 p-1 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <YouTubeVideoCardSkeleton key={`skeleton-${i}`} />
                  ))}
                </div>
              )}

              {showVideos && filteredVideos.length === 0 && !showSkeleton && (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Youtube className="mb-4 h-12 w-12 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {searchQuery.trim()
                        ? "No videos match your search."
                        : "No videos on your channel yet."}
                    </p>
                  </CardContent>
                </Card>
              )}

              {showVideos && filteredVideos.length > 0 && (
                <>
                  <div className="grid w-full gap-3 p-1 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
                    {filteredVideos.map((video, index) => (
                      <YouTubeVideoCard
                        key={video.videoId}
                        video={video}
                        priority={index < 6}
                        selected={youtubeStyleExtract.selectedVideoIds.has(video.videoId)}
                        onToggleSelect={youtubeStyleExtract.toggleSelectVideo}
                        channel={channel ? { title: channel.title, description: channel.description } : null}
                        otherChannelThumbnailUrls={filteredVideos
                          .filter((v) => v.videoId !== video.videoId)
                          .slice(0, 10)
                          .map((v) => v.thumbnailUrl)}
                      />
                    ))}
                  </div>
                  {videosHasMore && (
                    <div className="mt-6 flex justify-center">
                      <Button
                        variant="outline"
                        onClick={() => loadMoreVideos()}
                        disabled={isRefreshing}
                        className="gap-2"
                      >
                        {isRefreshing ? (
                          <>
                            <ViewBaitLogo className="h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" />
                            Load more
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="import" className="mt-0">
          <ChannelImportTab
            onStyleCreated={(style) => {
              setEditingStyle(style);
              setEditorOpen(true);
            }}
          />
        </TabsContent>
      </Tabs>

      <StyleEditor
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditingStyle(null);
        }}
        style={editingStyle}
        onSave={handleSaveStyle}
        isLoading={isSaving}
      />
    </div>
  );
}
