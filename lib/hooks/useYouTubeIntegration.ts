"use client";

/**
 * YouTube Integration Hook
 * 
 * Provides client-side state management for YouTube integration.
 * Handles connection status, channel data, and analytics fetching.
 */

import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/useAuth";
import { useYouTubeVideosList } from "@/lib/hooks/useYouTubeVideosList";
import { logClientError, logClientInfo } from "@/lib/utils/client-logger";
import { track } from "@/lib/analytics/track";

// ============================================================================
// Types
// ============================================================================

export interface YouTubeChannel {
  channelId: string;
  title: string;
  description?: string;
  customUrl: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number | null;
  videoCount: number;
  viewCount?: number;
  publishedAt?: string;
  country?: string | null;
  fetchedAt?: string;
}

export interface YouTubeAnalytics {
  views: number;
  watchTimeMinutes: number;
  averageViewDurationSeconds: number;
  subscribersGained: number;
  subscribersLost: number;
  netSubscribers: number;
  likes: number;
  dislikes: number;
  comments: number;
  shares: number;
  estimatedRevenue: number | null;
  fetchedAt?: string;
}

export interface YouTubeStatus {
  isConnected: boolean;
  hasEverConnected: boolean;
  googleUserId: string | null;
  scopesGranted: string[];
  connectedAt: string | null;
  lastUpdated?: string;
  revokedAt: string | null;
}

export interface YouTubeVideo {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount?: number;
  likeCount?: number;
  /** Duration in seconds. Used to classify Shorts (< 60s). */
  durationSeconds?: number;
}

export interface VideoAnalyticsTimeSeries {
  date: string; // YYYY-MM-DD
  views: number;
}

export interface VideoTrafficSource {
  sourceType: string; // e.g., "YT_SEARCH", "RELATED_VIDEO", etc.
  views: number;
}

export interface VideoImpressions {
  impressions: number | null;
  impressionsClickThroughRate: number | null; // percentage (0-100)
}

export interface VideoWithAnalytics {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  publishedAt: string;
  // Public counts
  viewCount: number;
  likeCount: number;
  commentCount: number;
  // Analytics (last 28 days)
  watchTimeMinutes: number;
  averageViewDurationSeconds: number;
  // Time series (daily views for last 28 days)
  timeSeries: VideoAnalyticsTimeSeries[];
  // Traffic sources
  trafficSources: VideoTrafficSource[];
  // Impressions (may be null)
  impressions: VideoImpressions;
}

export interface YouTubeIntegrationState {
  status: YouTubeStatus | null;
  channel: YouTubeChannel | null;
  analytics: YouTubeAnalytics | null;
  analyticsDateRange: { startDate: string; endDate: string } | null;
  videos: YouTubeVideo[];
  videosHasMore: boolean;
  videosNextPageToken: string | null;
  videosWithAnalytics: VideoWithAnalytics[];
  videosWithAnalyticsLoading: boolean;
  videosWithAnalyticsError: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
}

/**
 * Deduplicate videos by videoId (keep first occurrence).
 * Prevents duplicate keys and duplicate list items from double-fetch or API quirks.
 */
function dedupeVideosById(videos: YouTubeVideo[]): YouTubeVideo[] {
  const seen = new Set<string>();
  return videos.filter((v) => {
    if (!v.videoId || seen.has(v.videoId)) return false;
    seen.add(v.videoId);
    return true;
  });
}

export interface YouTubeIntegrationActions {
  /** Refresh status from server */
  refreshStatus: () => Promise<void>;
  /** Fetch channel data (fresh from YouTube if POST) */
  fetchChannel: (forceRefresh?: boolean) => Promise<void>;
  /** Fetch analytics data (fresh from YouTube if POST) */
  fetchAnalytics: (days?: number, forceRefresh?: boolean) => Promise<void>;
  /** Fetch latest videos from YouTube (resets list) */
  fetchVideos: () => Promise<void>;
  /** Load more videos (appends to existing list) */
  loadMoreVideos: () => Promise<void>;
  /** Fetch videos with detailed analytics (latest 10) */
  fetchVideosWithAnalytics: () => Promise<void>;
  /** Disconnect YouTube integration */
  disconnect: (revokeAtGoogle?: boolean) => Promise<void>;
  /** Reconnect by initiating OAuth flow */
  reconnect: () => Promise<void>;
  /** Clear any errors */
  clearError: () => void;
}

export type UseYouTubeIntegrationReturn = YouTubeIntegrationState & YouTubeIntegrationActions;

export interface UseYouTubeIntegrationOptions {
  /** When false, the videos list query does not run. Default true. Set false when not on YouTube/Assistant view to avoid 404s. */
  enableVideosList?: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing YouTube integration state and actions
 */
export function useYouTubeIntegration(
  options: UseYouTubeIntegrationOptions = {}
): UseYouTubeIntegrationReturn {
  const { enableVideosList = true } = options;
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const youtubeVideosList = useYouTubeVideosList({ enabled: enableVideosList });

  const [state, setState] = useState<YouTubeIntegrationState>({
    status: null,
    channel: null,
    analytics: null,
    analyticsDateRange: null,
    videos: [],
    videosHasMore: false,
    videosNextPageToken: null,
    videosWithAnalytics: [],
    videosWithAnalyticsLoading: false,
    videosWithAnalyticsError: null,
    isLoading: true,
    isRefreshing: false,
    error: null,
  });

  /**
   * Refresh integration status from server.
   * Retries once after a short delay on 404 (helps when returning from OAuth redirect).
   */
  const refreshStatus = useCallback(async () => {
    if (!isAuthenticated) {
      setState(prev => ({
        ...prev,
        status: null,
        channel: null,
        isLoading: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, isRefreshing: true, error: null }));

    const tryFetch = async (): Promise<Response> => {
      const response = await fetch("/api/youtube/status");
      return response;
    };

    const parseResponse = async (
      response: Response
    ): Promise<{ data: { success?: boolean; status?: unknown; channel?: unknown; error?: string }; throwErr: Error | null }> => {
      const text = await response.text();
      let data: { success?: boolean; status?: unknown; channel?: unknown; error?: string } = {};
      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          data = { error: "Invalid response from server" };
        }
      } else if (!response.ok) {
        const isHtml = text.trimStart().startsWith("<!");
        data = {
          error:
            response.status === 404
              ? "YouTube status endpoint not found. Run the app from the viewbait folder (e.g. cd viewbait && npm run dev)."
              : isHtml
                ? "Server returned an unexpected response. Try refreshing the page."
                : text.slice(0, 200) || "Failed to fetch status",
        };
      }
      const throwErr =
        !response.ok ? new Error(data.error || "Failed to fetch status") : null;
      return { data, throwErr };
    };

    try {
      let response = await tryFetch();
      if (response.status === 404) {
        await new Promise((r) => setTimeout(r, 1500));
        response = await tryFetch();
      }
      const { data, throwErr } = await parseResponse(response);
      if (throwErr) throw throwErr;

      setState(prev => ({
        ...prev,
        status: data.status ?? prev.status,
        channel: data.channel ?? prev.channel,
        isLoading: false,
        isRefreshing: false,
      }));
    } catch (error) {
      logClientError(error, {
        operation: "refresh-youtube-status",
        component: "useYouTubeIntegration",
      });
      setState(prev => ({
        ...prev,
        isLoading: false,
        isRefreshing: false,
        error: error instanceof Error ? error.message : "Failed to fetch status",
      }));
    }
  }, [isAuthenticated]);

  /**
   * Fetch channel data
   */
  const fetchChannel = useCallback(async (forceRefresh: boolean = false) => {
    if (!isAuthenticated) return;

    setState(prev => ({ ...prev, isRefreshing: true, error: null }));

    try {
      const method = forceRefresh ? "POST" : "GET";
      const response = await fetch("/api/youtube/channel", { method });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch channel");
      }

      if (data.channel) {
        setState(prev => ({
          ...prev,
          channel: data.channel,
          isRefreshing: false,
        }));

        logClientInfo("YouTube channel data fetched", {
          operation: forceRefresh ? "fetch-fresh-channel" : "fetch-cached-channel",
          component: "useYouTubeIntegration",
        });
      } else {
        setState(prev => ({ ...prev, isRefreshing: false }));
      }
    } catch (error) {
      logClientError(error, {
        operation: "fetch-youtube-channel",
        component: "useYouTubeIntegration",
      });
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: error instanceof Error ? error.message : "Failed to fetch channel",
      }));
    }
  }, [isAuthenticated]);

  /**
   * Fetch analytics data
   */
  const fetchAnalytics = useCallback(async (
    days: number = 28,
    forceRefresh: boolean = false
  ) => {
    if (!isAuthenticated) return;

    setState(prev => ({ ...prev, isRefreshing: true, error: null }));

    try {
      let response: Response;

      if (forceRefresh) {
        response = await fetch("/api/youtube/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ days }),
        });
      } else {
        response = await fetch(`/api/youtube/analytics?days=${days}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch analytics");
      }

      if (data.analytics) {
        setState(prev => ({
          ...prev,
          analytics: data.analytics,
          analyticsDateRange: data.dateRange,
          isRefreshing: false,
        }));

        logClientInfo("YouTube analytics data fetched", {
          operation: forceRefresh ? "fetch-fresh-analytics" : "fetch-cached-analytics",
          component: "useYouTubeIntegration",
          days,
        });
      } else {
        setState(prev => ({ ...prev, isRefreshing: false }));
      }
    } catch (error) {
      logClientError(error, {
        operation: "fetch-youtube-analytics",
        component: "useYouTubeIntegration",
      });
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: error instanceof Error ? error.message : "Failed to fetch analytics",
      }));
    }
  }, [isAuthenticated]);

  /** Fetch/reset videos list (delegates to shared React Query cache). */
  const fetchVideos = useCallback(async () => {
    if (!isAuthenticated) return;
    await youtubeVideosList.refetch();
  }, [isAuthenticated, youtubeVideosList.refetch]);

  /** Load more videos (delegates to shared React Query cache). */
  const loadMoreVideos = useCallback(async () => {
    if (!isAuthenticated) return;
    await youtubeVideosList.loadMore();
  }, [isAuthenticated, youtubeVideosList.loadMore]);

  /**
   * Fetch videos with detailed analytics (latest 10)
   */
  const fetchVideosWithAnalytics = useCallback(async () => {
    if (!isAuthenticated) return;

    setState(prev => ({ 
      ...prev, 
      videosWithAnalyticsLoading: true, 
      videosWithAnalyticsError: null 
    }));

    try {
      const response = await fetch("/api/youtube/videos/analytics");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch videos with analytics");
      }

      setState(prev => ({
        ...prev,
        videosWithAnalytics: data.videos || [],
        videosWithAnalyticsLoading: false,
        videosWithAnalyticsError: null,
      }));

      logClientInfo("YouTube videos with analytics fetched", {
        operation: "fetch-videos-with-analytics",
        component: "useYouTubeIntegration",
        count: data.videos?.length || 0,
      });
    } catch (error) {
      logClientError(error, {
        operation: "fetch-videos-with-analytics",
        component: "useYouTubeIntegration",
      });
      setState(prev => ({
        ...prev,
        videosWithAnalyticsLoading: false,
        videosWithAnalyticsError: error instanceof Error ? error.message : "Failed to fetch videos with analytics",
      }));
    }
  }, [isAuthenticated]);

  /**
   * Disconnect YouTube integration
   */
  const disconnect = useCallback(async (revokeAtGoogle: boolean = false) => {
    if (!isAuthenticated) return;

    setState(prev => ({ ...prev, isRefreshing: true, error: null }));

    try {
      const response = await fetch("/api/youtube/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revokeAtGoogle }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to disconnect");
      }

      queryClient.removeQueries({ queryKey: ["youtube", "videos"] });
      setState(prev => ({
        ...prev,
        status: prev.status ? { ...prev.status, isConnected: false, revokedAt: new Date().toISOString() } : null,
        channel: null,
        analytics: null,
        analyticsDateRange: null,
        videosWithAnalytics: [],
        isRefreshing: false,
      }));

      logClientInfo("YouTube integration disconnected", {
        operation: "disconnect-youtube",
        component: "useYouTubeIntegration",
        revokedAtGoogle: data.revokedAtGoogle,
      });
    } catch (error) {
      logClientError(error, {
        operation: "disconnect-youtube",
        component: "useYouTubeIntegration",
      });
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: error instanceof Error ? error.message : "Failed to disconnect",
      }));
    }
  }, [isAuthenticated, queryClient]);

  /**
   * Reconnect using app-owned YouTube OAuth so we request the exact YouTube scopes
   * (including youtube.force-ssl and youtube.upload). User is redirected to
   * /api/youtube/connect/authorize → Google → /api/youtube/connect/callback → /studio?view=youtube.
   */
  const reconnect = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
    track('youtube_connect_started');
    const next = encodeURIComponent("/studio?view=youtube");
    window.location.href = `/api/youtube/connect/authorize?next=${next}`;
  }, []);

  /**
   * Clear any errors
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  /**
   * Initial load - fetch status when authenticated
   */
  useEffect(() => {
    if (isAuthenticated) {
      refreshStatus();
    } else {
      setState(prev => ({
        ...prev,
        status: null,
        channel: null,
        analytics: null,
        analyticsDateRange: null,
        videos: [],
        isLoading: false,
      }));
    }
  }, [isAuthenticated, refreshStatus]);

  return {
    ...state,
    videos: youtubeVideosList.videos,
    videosHasMore: youtubeVideosList.hasMore,
    videosNextPageToken: youtubeVideosList.nextPageToken,
    isRefreshing: state.isRefreshing || youtubeVideosList.isRefreshing,
    refreshStatus,
    fetchChannel,
    fetchAnalytics,
    fetchVideos,
    loadMoreVideos,
    fetchVideosWithAnalytics,
    disconnect,
    reconnect,
    clearError,
  };
}

/**
 * Helper hook to check if YouTube is connected
 * Simpler version for components that just need connection status
 */
export function useYouTubeConnected(): {
  isConnected: boolean;
  isLoading: boolean;
} {
  const { status, isLoading } = useYouTubeIntegration();

  return {
    isConnected: status?.isConnected ?? false,
    isLoading,
  };
}
