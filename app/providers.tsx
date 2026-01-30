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

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
          },
        },
      })
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SubscriptionProvider>
            {children}
            <Toaster richColors position="top-center" />
          </SubscriptionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
