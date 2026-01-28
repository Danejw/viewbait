"use client";

/**
 * React Query Provider
 * 
 * Provides QueryClient for React Query hooks throughout the app.
 * Configured with data-type-specific cache strategies for optimal performance.
 * 
 * Cache Strategy:
 * - Static data (default styles/palettes): 30 minutes staleTime
 * - User data (faces, custom styles): 10 minutes staleTime
 * - Dynamic data (thumbnails, notifications): 5 minutes staleTime
 * - Real-time data (subscription status): 2 minutes staleTime
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Default: data is fresh for 5 minutes, cached for 10 minutes
            // Individual hooks can override with data-type-specific values
            staleTime: 5 * 60 * 1000, // 5 minutes
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
            refetchOnWindowFocus: false, // Don't refetch on window focus by default
            retry: (failureCount, error) => {
              // Exponential backoff: retry 1-2 times with increasing delay
              if (failureCount < 2) {
                return true;
              }
              return false;
            },
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Enable query deduplication
            refetchOnMount: true, // Refetch if data is stale
            refetchOnReconnect: true, // Refetch on reconnect if data is stale
          },
          mutations: {
            // Retry mutations once on network errors
            retry: 1,
            retryDelay: 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
