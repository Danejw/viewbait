"use client";

import React, { lazy, Suspense, useState } from "react";
import { useStudio } from "@/components/studio/studio-provider";
import { StudioGenerator } from "@/components/studio/studio-generator";
import { StudioResults } from "@/components/studio/studio-results";
import { StudioViewSkeleton } from "@/components/studio/views/StudioViewSkeleton";
import { StudioViewErrorBoundary } from "@/components/studio/views/StudioViewErrorBoundary";

const StudioViewGallery = lazy(() => import("@/components/studio/views/StudioViewGallery"));
const StudioViewBrowse = lazy(() => import("@/components/studio/views/StudioViewBrowse"));
const StudioViewStyles = lazy(() => import("@/components/studio/views/StudioViewStyles"));
const StudioViewPalettes = lazy(() => import("@/components/studio/views/StudioViewPalettes"));
const StudioViewFaces = lazy(() => import("@/components/studio/views/StudioViewFaces"));
const StudioViewProjects = lazy(() => import("@/components/studio/views/StudioViewProjects"));
const StudioViewYouTube = lazy(() => import("@/components/studio/views/StudioViewYouTube"));
const StudioViewAssistant = lazy(() => import("@/components/studio/views/StudioViewAssistant"));
const StudioViewUpdates = lazy(() => import("@/components/studio/studio-view-updates"));

/**
 * StudioMainContent
 * Center content router - renders the main content based on currentView state.
 * For generator view, shows the Live Results Feed (StudioResults).
 * The generator form is in the right sidebar (StudioSettingsSidebar).
 * All non-generator views are lazy-loaded with Suspense and an error boundary.
 */
export function StudioMainContent() {
  const {
    state: { currentView },
  } = useStudio();
  const [retryKey, setRetryKey] = useState(0);

  if (currentView === "generator") {
    return <StudioResults />;
  }

  return (
    <StudioViewErrorBoundary onRetry={() => setRetryKey((k) => k + 1)}>
      <Suspense fallback={<StudioViewSkeleton />}>
        <div key={`${currentView}-${retryKey}`}>
          {currentView === "gallery" && <StudioViewGallery />}
          {currentView === "browse" && <StudioViewBrowse />}
          {currentView === "projects" && <StudioViewProjects />}
          {currentView === "styles" && <StudioViewStyles />}
          {currentView === "palettes" && <StudioViewPalettes />}
          {currentView === "faces" && <StudioViewFaces />}
          {currentView === "youtube" && <StudioViewYouTube />}
          {currentView === "assistant" && <StudioViewAssistant />}
          {currentView === "updates" && <StudioViewUpdates />}
        </div>
      </Suspense>
    </StudioViewErrorBoundary>
  );
}

/**
 * StudioView
 * @deprecated Use StudioMainContent for center content routing. StudioView shows full generator in center; StudioMainContent shows results in center and generator in right sidebar.
 */
export function StudioView() {
  const {
    state: { currentView },
  } = useStudio();
  const [retryKey, setRetryKey] = useState(0);

  if (currentView === "generator") {
    return <StudioGenerator />;
  }

  return (
    <StudioViewErrorBoundary onRetry={() => setRetryKey((k) => k + 1)}>
      <Suspense fallback={<StudioViewSkeleton />}>
        <div key={`${currentView}-${retryKey}`}>
          {currentView === "gallery" && <StudioViewGallery />}
          {currentView === "browse" && <StudioViewBrowse />}
          {currentView === "projects" && <StudioViewProjects />}
          {currentView === "styles" && <StudioViewStyles />}
          {currentView === "palettes" && <StudioViewPalettes />}
          {currentView === "faces" && <StudioViewFaces />}
          {currentView === "youtube" && <StudioViewYouTube />}
          {currentView === "assistant" && <StudioViewAssistant />}
          {currentView === "updates" && <StudioViewUpdates />}
        </div>
      </Suspense>
    </StudioViewErrorBoundary>
  );
}

export { StudioViewGallery, StudioViewBrowse, StudioViewStyles, StudioViewPalettes, StudioViewFaces, StudioViewYouTube };
