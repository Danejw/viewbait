"use client";

/**
 * App Providers
 *
 * Wraps the application with all necessary context providers.
 * This component must be a client component since providers use client-side state.
 */

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/lib/hooks/useAuth";
import { SubscriptionProvider } from "@/lib/hooks/useSubscription";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/pwa-register";
import type { InitialAuthState } from "@/lib/server/data/auth";

interface ProvidersProps {
  children: ReactNode;
  /** Initial auth state from server (prevents flicker, includes role for admin nav). */
  initialAuthState?: InitialAuthState | null;
}

export function Providers({ children, initialAuthState }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            // Avoid refetching every query when user switches back to the tab.
            // Hooks that need focus refresh (e.g. subscription, notifications) set refetchOnWindowFocus: true.
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider
          initialUser={initialAuthState?.user}
          initialSession={initialAuthState?.session}
          initialProfile={initialAuthState?.profile}
          initialRole={initialAuthState?.role}
        >
          <SubscriptionProvider>
            {children}
            <Toaster richColors position="top-center" />
            <PwaRegister />
          </SubscriptionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
