"use client";

/**
 * Syncs auth user to analytics and tracks page views.
 * Renders nothing. Place inside AuthProvider so user is available.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { setTrackUserId, track } from "@/lib/analytics/track";

export function AnalyticsTracker() {
  const pathname = usePathname();
  const { user } = useAuth();

  useEffect(() => {
    setTrackUserId(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    if (pathname) track("page_view", { path: pathname });
  }, [pathname]);

  return null;
}
