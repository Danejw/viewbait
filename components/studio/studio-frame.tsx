"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useStudio } from "@/components/studio/studio-provider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * StudioFrame
 * Root container for the studio layout
 */
export function StudioFrame({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-screen flex-col bg-background", className)}>
      {children}
    </div>
  );
}

/**
 * StudioHeader
 * Top header bar with logo, title, credits, and user menu
 */
export function StudioHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("border-b border-border bg-card", className)}>
      <div className="flex h-16 items-center justify-between px-6">{children}</div>
    </header>
  );
}

/**
 * StudioLayout
 * Three-column layout container (desktop). For responsive layout use StudioLayoutResponsive.
 */
export function StudioLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-1 overflow-hidden", className)}>
      {children}
    </div>
  );
}

/**
 * StudioLayoutResponsive
 * Renders three-column layout on desktop; on mobile renders a single column with
 * Results | Settings tabs (center content vs right sidebar content).
 */
export function StudioLayoutResponsive({
  left,
  main,
  right,
}: {
  left: React.ReactNode;
  main: React.ReactNode;
  right: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  const {
    state: { mobilePanel, rightSidebarCollapsed },
    actions: { setMobilePanel },
  } = useStudio();

  if (isMobile) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <Tabs
          value={mobilePanel}
          onValueChange={(v) => setMobilePanel(v as "results" | "settings")}
          className="flex flex-1 flex-col overflow-hidden mx-2"
        >
          <TabsList className="shrink-0 w-full mt-2 flex gap-2" variant="default">
            <TabsTrigger value="results" variant="primary" size="lg">
              Preview
            </TabsTrigger>
            <TabsTrigger value="settings" variant="primary" size="lg">
              Create
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="results"
            className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden"
          >
            <div className="h-full overflow-y-auto p-4 hide-scrollbar bg-muted/30">
              {main}
            </div>
          </TabsContent>
          <TabsContent
            value="settings"
            className="flex-1 overflow-hidden m-0 data-[state=inactive]:hidden"
          >
            <div className="h-full overflow-y-auto hide-scrollbar bg-card">
              {right}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <StudioLayout>
      {left}
      <StudioMainPanel>{main}</StudioMainPanel>
      <StudioSettingsPanel>{right}</StudioSettingsPanel>
    </StudioLayout>
  );
}

/** Min and max width (px) for the left sidebar when resizing */
const SIDEBAR_MIN_WIDTH = 192;
const SIDEBAR_MAX_WIDTH = 480;

/**
 * StudioSidebar
 * Left navigation sidebar - collapsible, width adjustable by dragging the right edge.
 */
export function StudioSidebar({
  children,
  className,
  collapsed: collapsedProp,
}: {
  children: React.ReactNode;
  className?: string;
  /** Optional override; when omitted, uses leftSidebarCollapsed from context */
  collapsed?: boolean;
}) {
  const {
    state: { leftSidebarCollapsed, leftSidebarWidth },
    actions: { setLeftSidebarWidth },
  } = useStudio();
  const collapsed = collapsedProp ?? leftSidebarCollapsed;

  const handleResizeMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = leftSidebarWidth;
      const onMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX; // drag right => sidebar wider
        const next = Math.min(
          SIDEBAR_MAX_WIDTH,
          Math.max(SIDEBAR_MIN_WIDTH, startWidth + delta)
        );
        setLeftSidebarWidth(next);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [leftSidebarWidth, setLeftSidebarWidth]
  );

  if (collapsed) {
    return (
      <aside
        className={cn(
          "w-12 shrink-0 border-r border-border bg-sidebar overflow-y-auto hide-scrollbar transition-all duration-200",
          className
        )}
      >
        {children}
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "shrink-0 border-r border-border bg-sidebar overflow-y-auto hide-scrollbar transition-all duration-200 relative flex",
        className
      )}
      style={{ width: leftSidebarWidth }}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {/* Resize handle on the right edge */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        onMouseDown={handleResizeMouseDown}
        className="absolute right-0 top-0 z-10 w-1.5 h-full cursor-col-resize touch-none select-none hover:bg-primary/20 active:bg-primary/30 transition-colors rounded-r"
      />
    </aside>
  );
}

/**
 * StudioMainPanel
 * Center panel - main content area (gallery/results)
 */
export function StudioMainPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className={cn("flex-1 overflow-y-auto bg-muted/30 hide-scrollbar", className)}>
      <div className="p-6">{children}</div>
    </main>
  );
}

/** Min and max width (px) for the right settings panel when resizing */
const SETTINGS_PANEL_MIN_WIDTH = 280;
const SETTINGS_PANEL_MAX_WIDTH = 720;

/**
 * StudioSettingsPanel
 * Right panel for settings/generator form - collapsible, width adjustable by dragging the left edge.
 */
export function StudioSettingsPanel({
  children,
  className,
  collapsed: collapsedProp,
}: {
  children: React.ReactNode;
  className?: string;
  /** Optional override; when omitted, uses rightSidebarCollapsed from context */
  collapsed?: boolean;
}) {
  const {
    state: { rightSidebarCollapsed, rightSidebarWidth },
    actions: { setRightSidebarWidth },
  } = useStudio();
  const collapsed = collapsedProp ?? rightSidebarCollapsed;

  const handleResizeMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = rightSidebarWidth;
      const onMove = (moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX; // drag left => panel wider
        const next = Math.min(
          SETTINGS_PANEL_MAX_WIDTH,
          Math.max(SETTINGS_PANEL_MIN_WIDTH, startWidth + delta)
        );
        setRightSidebarWidth(next);
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [rightSidebarWidth, setRightSidebarWidth]
  );

  if (collapsed) {
    return (
      <aside
        className={cn(
          "w-12 shrink-0 border-l border-border bg-sidebar overflow-y-auto hide-scrollbar transition-all duration-200",
          className
        )}
      >
        {children}
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "shrink-0 border-l border-border bg-card overflow-y-auto hide-scrollbar transition-all duration-200 relative flex",
        className
      )}
      style={{ width: rightSidebarWidth }}
    >
      {/* Resize handle on the left edge */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize settings panel"
        onMouseDown={handleResizeMouseDown}
        className="absolute left-0 top-0 z-10 w-1.5 h-full cursor-col-resize touch-none select-none hover:bg-primary/20 active:bg-primary/30 transition-colors rounded-l"
      />
      <div className="flex-1 min-w-0">{children}</div>
    </aside>
  );
}

/**
 * StudioResultsPanel
 * @deprecated Use StudioSettingsPanel for the right sidebar. This is kept for backwards compatibility.
 * Right panel for displaying generated thumbnails
 */
export function StudioResultsPanel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <aside
      className={cn(
        "w-96 border-l border-border bg-card overflow-y-auto hide-scrollbar",
        className
      )}
    >
      <div className="p-6">{children}</div>
    </aside>
  );
}
