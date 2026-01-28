"use client";

import React from "react";
import { Settings, MessageSquare, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useStudio } from "./studio-provider";
import { StudioGenerator } from "./studio-generator";

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
      <div className="p-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleRightSidebar}
              className="flex w-full items-center gap-2 rounded-md text-left hover:bg-sidebar-accent/50 transition-colors"
              aria-label="Collapse settings"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center">
                <Settings className="h-4 w-4 block text-muted-foreground" />
              </div>
              <h2 className="text-sm font-semibold">Settings</h2>
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Collapse settings</TooltipContent>
        </Tooltip>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                onClick={toggleRightSidebar}
                className="w-full"
                aria-label="Expand settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Expand settings</TooltipContent>
          </Tooltip>
        </div>
        {/* Divider below header (same as left sidebar) */}
        <div className="border-t border-sidebar-border" />
        {/* Icons below: same size as left sidebar nav items (h-8 / size-8) */}
        <nav className="flex flex-col gap-1 p-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                onClick={handleManual}
                className={cn("w-full", mode === "manual" && "bg-sidebar-accent text-sidebar-accent-foreground")}
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
                size="icon-lg"
                onClick={handleChat}
                className={cn("w-full", mode === "chat" && "bg-sidebar-accent text-sidebar-accent-foreground")}
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
 * Expanded content - renders the generator form
 */
export function StudioSettingsSidebarContent() {
  return (
    <div className="p-4">
      <StudioGenerator />
    </div>
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
