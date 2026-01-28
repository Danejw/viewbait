"use client";

import { StudioProvider, useStudio } from "@/components/studio/studio-provider";
import {
  StudioFrame,
  StudioLayout,
  StudioMainPanel,
  StudioSettingsPanel,
  StudioSidebar as StudioSidebarFrame,
} from "@/components/studio/studio-frame";
import { StudioSidebar } from "@/components/studio/studio-sidebar";
import { StudioMainContent } from "@/components/studio/studio-views";
import { StudioChatAssistant, StudioChatToggle } from "@/components/studio/studio-chat";
import { StudioSettingsSidebar } from "@/components/studio/studio-settings-sidebar";

/**
 * StudioPageContent
 * Inner component that uses the studio context for layout state
 */
function StudioPageContent() {
  const {
    state: { leftSidebarCollapsed, rightSidebarCollapsed },
  } = useStudio();

  return (
    <StudioFrame>
      <StudioLayout>
        {/* Left sidebar - navigation */}
        <StudioSidebarFrame collapsed={leftSidebarCollapsed}>
          <StudioSidebar />
        </StudioSidebarFrame>

        {/* Center - main content (gallery/results based on view) */}
        <StudioMainPanel>
          <StudioMainContent />
        </StudioMainPanel>

        {/* Right sidebar - settings/generator form */}
        <StudioSettingsPanel collapsed={rightSidebarCollapsed}>
          <StudioSettingsSidebar />
        </StudioSettingsPanel>
      </StudioLayout>
      <StudioChatAssistant />
      <StudioChatToggle />
    </StudioFrame>
  );
}

/**
 * Studio Page
 * Single page application (SPA) for thumbnail generation
 * All views and functionality happen within this page without navigation
 * - Views switch via state (generator, gallery, browse, etc.)
 * - Chat assistant can be opened/closed within the page
 * - Assistant can pull up information and surface components dynamically
 * - All state managed through StudioProvider
 */
export default function StudioPage() {
  return (
    <StudioProvider>
      <StudioPageContent />
    </StudioProvider>
  );
}
