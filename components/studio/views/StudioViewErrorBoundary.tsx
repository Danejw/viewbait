"use client";

/**
 * StudioViewErrorBoundary
 * Catches errors from lazy-loaded Studio views (e.g. chunk load failure).
 * Renders a short message and Retry button; calls onRetry so the router
 * can increment retryKey and force the lazy view to remount and re-run the dynamic import.
 */

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { track } from "@/lib/analytics/track";

export interface StudioViewErrorBoundaryProps {
  children: ReactNode;
  /** Called when user clicks Retry; router should increment retryKey so the Suspense child remounts */
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class StudioViewErrorBoundary extends Component<StudioViewErrorBoundaryProps, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[StudioViewErrorBoundary]", error, errorInfo);
    track("error", {
      context: "error_boundary",
      message: (error?.message ?? String(error)).slice(0, 200),
    });
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[320px] flex-col items-center justify-center p-6">
          <Card className="w-full max-w-md">
            <CardContent className="flex flex-col items-center gap-4 py-8">
              <AlertCircle className="h-12 w-12 text-destructive" aria-hidden />
              <p className="text-center text-sm text-muted-foreground">
                Failed to load view. Check your connection and try again.
              </p>
              <Button variant="outline" onClick={this.handleRetry}>
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}
