"use client";

import { Settings, MessageSquare, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useStudio } from "@/components/studio/studio-provider";
import { ProjectSelector } from "@/components/studio/project-selector";
import { StudioGenerator } from "@/components/studio/studio-generator";

/**
 * StudioSettingsSidebarHeader
 * Header with Settings icon as collapse toggle (same pattern as left sidebar logo).
 * No bottom border here; divider is on the section below for consistency with left sidebar.
 */
export function StudioSettingsSidebarHeader() {
  const {
    state: { rightSidebarCollapsed },
    actions: { toggleRightSidebar },
  } = useStudio();

  if (rightSidebarCollapsed) {
    return null;
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="p-2">
            <Button
              type="button"
              variant="side"
              size="sm"
              onClick={toggleRightSidebar}
              className="w-full justify-start gap-2 text-left"
              aria-label="Collapse settings"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                <Settings className="h-4 w-4 block text-muted-foreground" />
              </div>
              <h2 className="text-sm font-semibold">Settings</h2>
            </Button>
      </div>
    </TooltipProvider>
  );
}

/**
 * StudioSettingsSidebarCollapsed
 * Collapsed state UI - header (expand button) + divider + Manual/Chat icons (same sizing as left sidebar).
 */
export function StudioSettingsSidebarCollapsed() {
  const {
    state: { mode },
    actions: { toggleRightSidebar, setMode, openChatAssistant },
  } = useStudio();

  const handleManual = () => {
    toggleRightSidebar();
    setMode("manual");
  };

  const handleChat = () => {
    toggleRightSidebar();
    setMode("chat");
    openChatAssistant();
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col">
        {/* Header: expand button only (matches left sidebar header pattern) */}
        <div className="p-2">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={toggleRightSidebar}
                className="w-full justify-center"
                aria-label="Expand settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
        </div>
        {/* Divider below header (same as left sidebar) */}
        <div className="border-t border-sidebar-border" />
        {/* Icons below: same size as left sidebar nav items (icon-sm, centered) */}
        <nav className="flex flex-col gap-1 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleManual}
                className={cn("w-full justify-center", mode === "manual" && "bg-sidebar-accent text-sidebar-accent-foreground")}
                aria-label="Manual mode"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Manual</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleChat}
                className={cn("w-full justify-center", mode === "chat" && "bg-sidebar-accent text-white")}
                aria-label="Chat mode"
              >
                <MessageSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Chat</TooltipContent>
          </Tooltip>
        </nav>
      </div>
    </TooltipProvider>
  );
}

/**
 * StudioSettingsSidebarContent
 * Expanded content - project selector above Manual/Chat tabs, then generator form.
 * Both Manual and Chat generation use the selected project (activeProjectId).
 * In chat mode, wrapper uses h-full flex flex-col so the chat panel fills height
 * and the input stays fixed at the bottom with messages scrolling above.
 */
export function StudioSettingsSidebarContent() {
  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col min-h-0 p-2">
        <div className="shrink-0 mb-3">
          <ProjectSelector
            variant="form"
            label="Project"
            showHelperText={true}
            className="mb-0"
          />
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <StudioGenerator />
        </div>
      </div>
    </TooltipProvider>
  );
}

/**
 * StudioSettingsSidebar
 * Complete right sidebar composition for settings/generator
 */
export function StudioSettingsSidebar() {
  const {
    state: { rightSidebarCollapsed },
  } = useStudio();

  if (rightSidebarCollapsed) {
    return <StudioSettingsSidebarCollapsed />;
  }

  return (
    <div className="flex h-full flex-col">
      <StudioSettingsSidebarHeader />
      {/* Divider below header (same as left sidebar: border-t on section below header) */}
      <div className="flex-1 overflow-y-auto hide-scrollbar border-t border-sidebar-border">
        <StudioSettingsSidebarContent />
      </div>
    </div>
  );
}
