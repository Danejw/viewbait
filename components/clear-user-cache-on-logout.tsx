"use client";

/**
 * Clears all user cache when the user logs out (user transitions from truthy to null).
 * Must be mounted inside both QueryClientProvider and AuthProvider.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/useAuth";
import { clearUserCache } from "@/lib/utils/clear-user-cache";

export function ClearUserCacheOnLogout() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const prevUserRef = useRef(user);

  useEffect(() => {
    const hadUser = !!prevUserRef.current;
    const hasUser = !!user;
    if (hadUser && !hasUser) {
      clearUserCache(queryClient);
    }
    prevUserRef.current = user;
  }, [user, queryClient]);

  return null;
}
