"use client";

/**
 * Fetches the current user's role from the roles table (GET /api/user/role).
 * Used by the Studio sidebar to show the Admin nav link only for admins.
 * Enabled only when authenticated to avoid unnecessary requests.
 */

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/useAuth";
import type { ResolvedRole } from "@/lib/types/database";

const QUERY_KEY = ["user-role"] as const;

async function fetchUserRole(): Promise<ResolvedRole> {
  const res = await fetch("/api/user/role");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? "Failed to fetch user role");
  }
  const data = await res.json();
  if (data.role !== "admin" && data.role !== "member") {
    return "member";
  }
  return data.role as ResolvedRole;
}

export function useUserRole(): {
  role: ResolvedRole | null;
  isLoading: boolean;
  isAdmin: boolean;
} {
  const { isAuthenticated } = useAuth();
  const { data: role, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchUserRole,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes – role changes rarely
  });

  return {
    role: isAuthenticated ? (role ?? null) : null,
    isLoading: isAuthenticated && isLoading,
    isAdmin: role === "admin",
  };
}
