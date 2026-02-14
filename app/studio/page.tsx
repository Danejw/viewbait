"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { ChatDropHandlerProvider } from "@/components/studio/chat-drop-handler-context";
import { StudioDndContext } from "@/components/studio/studio-dnd-context";
import { ProcessCheckoutOnReturn } from "@/components/studio/process-checkout-return";
import { useIsMobile } from "@/hooks/use-mobile";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useStudio } from "@/components/studio/studio-provider";
import { useUserRole } from "@/lib/hooks/useUserRole";

/**
 * Syncs ?view=admin and ?view=roadmap from URL to studio view when user is admin (for /admin redirect and bookmarks).
 * Role is fetched from the roles table via useUserRole.
 */
function StudioViewFromQuery() {
  const searchParams = useSearchParams();
  const { isAdmin } = useUserRole();
  const { actions: { setView } } = useStudio();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current) return;
    const view = searchParams.get("view");
    if (isAdmin) {
      if (view === "admin") {
        applied.current = true;
        setView("admin");
      } else if (view === "roadmap") {
        applied.current = true;
        setView("roadmap");
      }
    }
  }, [searchParams, isAdmin, setView]);

  return null;
}

/**
 * Surfaces YouTube OAuth callback errors from ?error= and optional ?redirect_uri_hint=.
 * Shows a toast and clears the params from the URL so the user sees what went wrong.
 */
function StudioYouTubeOAuthErrorFromQuery() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const error = searchParams.get("error");
    if (!error || handled.current === error) return;
    handled.current = error;
    const decoded = error.replace(/\+/g, " ");
    toast.error(`YouTube reconnect failed: ${decoded}`);
    const next = new URLSearchParams(searchParams.toString());
    next.delete("error");
    next.delete("redirect_uri_hint");
    const qs = next.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [searchParams, router]);

  return null;
}

/**
 * Syncs ?project=<id> from URL to active project when that project is in the user's list (IDOR-safe).
 * After applying, clears the query param so refresh doesn't re-apply.
 */
function StudioProjectFromQuery() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: { projects, projectsLoading }, actions: { setActiveProjectId } } = useStudio();
  const applied = useRef(false);

  useEffect(() => {
    if (applied.current || projectsLoading) return;
    const projectId = searchParams.get("project");
    if (!projectId) return;
    const inList = projects.some((p) => p.id === projectId);
    if (inList) {
      applied.current = true;
      setActiveProjectId(projectId);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("project");
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
    }
  }, [searchParams, projects, projectsLoading, setActiveProjectId, router]);

  return null;
}

/**
 * StudioPageContent
 * Inner component that uses the studio context for layout state.
 * Desktop: three-column layout (left sidebar, main, right settings).
 * Mobile: single column with Results | Settings tabs; left nav becomes floating button.
 */
function StudioPageContent() {
  const isMobile = useIsMobile();

  return (
    <TooltipProvider delayDuration={0}>
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
    </TooltipProvider>
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
      <ChatDropHandlerProvider>
        <StudioDndContext>
          <Suspense fallback={null}>
            <ProcessCheckoutOnReturn />
            <StudioYouTubeOAuthErrorFromQuery />
            <StudioViewFromQuery />
            <StudioProjectFromQuery />
          </Suspense>
          <StudioPageContent />
        </StudioDndContext>
      </ChatDropHandlerProvider>
    </StudioProvider>
  );
}
