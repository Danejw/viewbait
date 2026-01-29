"use client";

import {
  StudioProvider,
  StudioFrame,
  StudioLayoutResponsive,
  StudioSidebarFrame,
  StudioSidebar,
  StudioMainContent,
  StudioSettingsSidebar,
  StudioMobileFloatingNav,
} from "@/components/studio";
import { StudioDndContext } from "@/components/studio/studio-dnd-context";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * StudioPageContent
 * Inner component that uses the studio context for layout state.
 * Desktop: three-column layout (left sidebar, main, right settings).
 * Mobile: single column with Results | Settings tabs; left nav becomes floating button.
 */
function StudioPageContent() {
  const isMobile = useIsMobile();

  return (
    <StudioFrame>
      <StudioLayoutResponsive
        left={
          isMobile ? null : (
            <StudioSidebarFrame>
              <StudioSidebar />
            </StudioSidebarFrame>
          )
        }
        main={<StudioMainContent />}
        right={<StudioSettingsSidebar />}
      />
      {isMobile && <StudioMobileFloatingNav />}
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
 * - Drag-and-drop enabled via StudioDndContext for styles/palettes/faces
 */
export default function StudioPage() {
  return (
    <StudioProvider>
      <StudioDndContext>
        <StudioPageContent />
      </StudioDndContext>
    </StudioProvider>
  );
}
