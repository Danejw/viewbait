"use client";

/**
 * ChannelImportTab
 *
 * Tab content for "Import by URL": user pastes a YouTube video or channel URL
 * (or channel ID), fetches that channel's public videos via the proxy, and
 * displays a thumbnail grid with load more. Reuses YouTubeVideoCard.
 * When onStyleCreated is provided, shows selection + Extract style bar (same as My channel).
 * Last loaded query is persisted in sessionStorage so returning to the tab restores the grid from cache.
 */

import React, { memo, useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { YouTubeVideoCard, YouTubeVideoCardSkeleton } from "@/components/studio/youtube-video-card";
import { YouTubeStyleExtractBar } from "@/components/studio/youtube-style-extract-bar";
import { ViewControls, type FilterOption, type SortOption } from "@/components/studio/view-controls";
import { useChannelVideos, type ChannelVideo } from "@/lib/hooks/useChannelVideos";
import { useYouTubeStyleExtract } from "@/lib/hooks/useYouTubeStyleExtract";
import type { DbStyle } from "@/lib/types/database";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { Youtube, ChevronDown, Search } from "lucide-react";

const CHANNEL_IMPORT_LAST_QUERY_KEY = "viewbait:channel-import:lastQuery";

export interface ChannelImportTabProps {
  /** When provided, show extract-style UI and open parent StyleEditor on success */
  onStyleCreated?: (style: DbStyle) => void;
}

const IMPORT_FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "All" },
  { value: "shorts", label: "Shorts" },
  { value: "standard", label: "Standard" },
];
const IMPORT_SORT_OPTIONS: SortOption[] = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "most-views", label: "Most Views" },
  { value: "most-likes", label: "Most Liked" },
];

export const ChannelImportTab = memo(function ChannelImportTab({
  onStyleCreated,
}: ChannelImportTabProps) {
  const [inputValue, setInputValue] = useState("");
  const [restoredQuery, setRestoredQuery] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterValue, setFilterValue] = useState("all");
  const [sortValue, setSortValue] = useState("newest");

  const {
    videos,
    hasMore,
    isLoading,
    isLoadingMore,
    error,
    currentQuery,
    fetchVideos,
    loadMore,
    reset,
    refetch,
  } = useChannelVideos({ initialQuery: restoredQuery });

  // Restore last query from sessionStorage on mount (hydration-safe)
  useEffect(() => {
    const saved = typeof window !== "undefined"
      ? sessionStorage.getItem(CHANNEL_IMPORT_LAST_QUERY_KEY)
      : null;
    if (saved != null && saved.trim() !== "") {
      setRestoredQuery(saved.trim());
      setInputValue(saved.trim());
    }
  }, []);

  // Persist only after successful load
  useEffect(() => {
    if (
      currentQuery != null &&
      currentQuery.trim() !== "" &&
      videos.length > 0 &&
      !error
    ) {
      sessionStorage.setItem(CHANNEL_IMPORT_LAST_QUERY_KEY, currentQuery);
    }
  }, [currentQuery, videos.length, error]);

  const filteredAndSortedVideos = useMemo(() => {
    let list = videos;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((v) => v.title?.toLowerCase().includes(q));
    }
    if (filterValue === "shorts") {
      list = list.filter((v) => v.durationSeconds != null && v.durationSeconds < 60);
    } else if (filterValue === "standard") {
      list = list.filter((v) => v.durationSeconds == null || v.durationSeconds >= 60);
    }
    const sorted = [...list];
    const viewCount = (v: ChannelVideo) => v.viewCount ?? 0;
    const likeCount = (v: ChannelVideo) => v.likeCount ?? 0;
    if (sortValue === "newest") {
      sorted.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    } else if (sortValue === "oldest") {
      sorted.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime());
    } else if (sortValue === "most-views") {
      sorted.sort((a, b) => viewCount(b) - viewCount(a));
    } else if (sortValue === "most-likes") {
      sorted.sort((a, b) => likeCount(b) - likeCount(a));
    }
    return sorted;
  }, [videos, searchQuery, filterValue, sortValue]);

  const youtubeStyleExtract = useYouTubeStyleExtract(filteredAndSortedVideos);
  const handleExtractAndOpenEditor = useCallback(async () => {
    const style = await youtubeStyleExtract.handleExtractStyle();
    if (style && onStyleCreated) {
      onStyleCreated(style);
    }
  }, [youtubeStyleExtract.handleExtractStyle, onStyleCreated]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) return;
      if (trimmed === currentQuery) {
        refetch();
      } else {
        fetchVideos(trimmed);
      }
    },
    [inputValue, currentQuery, fetchVideos, refetch]
  );

  const handleClear = useCallback(() => {
    setInputValue("");
    setRestoredQuery(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(CHANNEL_IMPORT_LAST_QUERY_KEY);
    }
    reset();
  }, [reset]);

  const handleTryAgain = useCallback(() => {
    const trimmed = inputValue.trim();
    if (trimmed === currentQuery) {
      refetch();
    } else {
      fetchVideos(trimmed);
    }
  }, [inputValue, currentQuery, fetchVideos, refetch]);

  const hasQuery = inputValue.trim().length > 0;
  const showGrid = videos.length > 0 && !isLoading;
  const showEmptyResult = !isLoading && hasQuery && videos.length === 0 && !error;
  const showFilteredEmpty = showGrid && filteredAndSortedVideos.length === 0;

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        <Label htmlFor="channel-url" className="text-muted-foreground">
          YouTube video or channel URL
        </Label>
        <p className="text-xs text-muted-foreground">
          Paste a video link (e.g. youtube.com/watch?v=... or youtu.be/...), a channel link
          (youtube.com/channel/UC...), or a channel ID (UC...).
        </p>
        <div className="flex flex-wrap gap-2">
          <Input
            id="channel-url"
            type="text"
            placeholder="https://www.youtube.com/watch?v=... or UC..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            className="flex-1 min-w-[200px]"
            aria-label="YouTube video or channel URL"
          />
          <Button type="submit" disabled={!hasQuery || isLoading} className="gap-2">
            {isLoading ? (
              <>
                <ViewBaitLogo className="h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              <>
                <Search className="h-4 w-4" />
                Load
              </>
            )}
          </Button>
          {(hasQuery || videos.length > 0) && (
            <Button type="button" variant="outline" onClick={handleClear} disabled={isLoading}>
              Clear
            </Button>
          )}
        </div>
      </form>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-sm text-destructive">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={handleTryAgain}
              disabled={isLoading}
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      {showEmptyResult && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Youtube className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">No videos found for this channel or URL.</p>
          </CardContent>
        </Card>
      )}

      {isLoading && videos.length === 0 && (
        <div className="grid w-full gap-3 p-1 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
          {Array.from({ length: 12 }).map((_, i) => (
            <YouTubeVideoCardSkeleton key={`skeleton-${i}`} />
          ))}
        </div>
      )}

      {onStyleCreated && showGrid && (
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
      )}

      {showGrid && (
        <>
          <ViewControls
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchPlaceholder="Search videos..."
            showSearch={true}
            showFilter={true}
            filterValue={filterValue}
            filterOptions={IMPORT_FILTER_OPTIONS}
            onFilterChange={setFilterValue}
            showSort={true}
            sortValue={sortValue}
            sortOptions={IMPORT_SORT_OPTIONS}
            onSortChange={setSortValue}
            showFavorites={false}
            onRefresh={refetch}
            isRefreshing={isLoading}
            showRefresh={true}
            showAdd={false}
            className="mb-4"
          />

          {showFilteredEmpty ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <p className="text-muted-foreground">No videos match your search or filter.</p>
              </CardContent>
            </Card>
          ) : (
          <div className="grid w-full gap-3 p-1 grid-cols-[repeat(auto-fill,minmax(200px,1fr))]">
            {filteredAndSortedVideos.map((video: ChannelVideo, index: number) => (
              <YouTubeVideoCard
                key={video.videoId}
                video={{
                  videoId: video.videoId,
                  title: video.title,
                  publishedAt: video.publishedAt,
                  thumbnailUrl: video.thumbnailUrl,
                  viewCount: video.viewCount,
                  likeCount: video.likeCount,
                }}
                priority={index < 6}
                selected={onStyleCreated ? youtubeStyleExtract.selectedVideoIds.has(video.videoId) : undefined}
                onToggleSelect={onStyleCreated ? youtubeStyleExtract.toggleSelectVideo : undefined}
              />
            ))}
          </div>
          )}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => loadMore()}
                disabled={isLoadingMore}
                className="gap-2"
              >
                {isLoadingMore ? (
                  <>
                    <ViewBaitLogo className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Load more
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

export default ChannelImportTab;
