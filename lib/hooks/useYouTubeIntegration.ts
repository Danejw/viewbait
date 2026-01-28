"use client";

/**
 * YouTube Integration Hook
 * 
 * Provides client-side state management for YouTube integration.
 * Handles connection status, channel data, and analytics fetching.
 */

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { logClientError, logClientInfo } from "@/lib/utils/client-logger";

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

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing YouTube integration state and actions
 */
export function useYouTubeIntegration(): UseYouTubeIntegrationReturn {
  const { isAuthenticated, signInWithGoogle } = useAuth();
  
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
   * Refresh integration status from server
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

    try {
      const response = await fetch("/api/youtube/status");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch status");
      }

      setState(prev => ({
        ...prev,
        status: data.status,
        channel: data.channel || prev.channel,
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

  /**
   * Fetch latest videos from YouTube (resets the list)
   */
  const fetchVideos = useCallback(async () => {
    if (!isAuthenticated) return;

    setState(prev => ({ ...prev, isRefreshing: true, error: null }));

    try {
      const response = await fetch("/api/youtube/videos");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch videos");
      }

      if (data.videos) {
        setState(prev => ({
          ...prev,
          videos: data.videos,
          videosHasMore: data.hasMore || false,
          videosNextPageToken: data.nextPageToken || null,
          isRefreshing: false,
        }));

        logClientInfo("YouTube videos fetched", {
          operation: "fetch-youtube-videos",
          component: "useYouTubeIntegration",
          count: data.videos.length,
          hasMore: data.hasMore,
        });
      } else {
        setState(prev => ({ 
          ...prev, 
          videos: [],
          videosHasMore: false,
          videosNextPageToken: null,
          isRefreshing: false 
        }));
      }
    } catch (error) {
      logClientError(error, {
        operation: "fetch-youtube-videos",
        component: "useYouTubeIntegration",
      });
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: error instanceof Error ? error.message : "Failed to fetch videos",
      }));
    }
  }, [isAuthenticated]);

  /**
   * Load more videos (appends to existing list)
   */
  const loadMoreVideos = useCallback(async () => {
    if (!isAuthenticated) return;

    const currentToken = state.videosNextPageToken;
    if (!currentToken || !state.videosHasMore) {
      return; // No more videos to load
    }

    setState(prev => ({ ...prev, isRefreshing: true, error: null }));

    try {
      const response = await fetch(`/api/youtube/videos?pageToken=${encodeURIComponent(currentToken)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load more videos");
      }

      if (data.videos && data.videos.length > 0) {
        setState(prev => ({
          ...prev,
          videos: [...prev.videos, ...data.videos],
          videosHasMore: data.hasMore || false,
          videosNextPageToken: data.nextPageToken || null,
          isRefreshing: false,
        }));

        logClientInfo("More YouTube videos loaded", {
          operation: "load-more-youtube-videos",
          component: "useYouTubeIntegration",
          count: data.videos.length,
          totalCount: state.videos.length + data.videos.length,
          hasMore: data.hasMore,
        });
      } else {
        setState(prev => ({ 
          ...prev, 
          videosHasMore: false,
          videosNextPageToken: null,
          isRefreshing: false 
        }));
      }
    } catch (error) {
      logClientError(error, {
        operation: "load-more-youtube-videos",
        component: "useYouTubeIntegration",
      });
      setState(prev => ({
        ...prev,
        isRefreshing: false,
        error: error instanceof Error ? error.message : "Failed to load more videos",
      }));
    }
  }, [isAuthenticated, state.videosNextPageToken, state.videosHasMore, state.videos.length]);

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

      // Update status to disconnected
      setState(prev => ({
        ...prev,
        status: prev.status ? {
          ...prev.status,
          isConnected: false,
          revokedAt: new Date().toISOString(),
        } : null,
        channel: null,
        analytics: null,
        analyticsDateRange: null,
        videos: [],
        videosHasMore: false,
        videosNextPageToken: null,
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
  }, [isAuthenticated]);

  /**
   * Reconnect by initiating OAuth flow
   * This will redirect to Google OAuth with YouTube scopes
   */
  const reconnect = useCallback(async () => {
    setState(prev => ({ ...prev, error: null }));

    try {
      const { error } = await signInWithGoogle();
      if (error) {
        throw error;
      }
      // OAuth will redirect, so we don't need to handle success here
    } catch (error) {
      logClientError(error, {
        operation: "reconnect-youtube",
        component: "useYouTubeIntegration",
      });
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to reconnect",
      }));
    }
  }, [signInWithGoogle]);

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
