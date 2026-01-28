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
 * Header with Settings icon as collapse toggle (same pattern as left sidebar logo)
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
      <div className="border-b border-border p-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={toggleRightSidebar}
              className="flex w-full items-center gap-2 rounded-md py-1 text-left hover:bg-sidebar-accent/50 transition-colors"
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
 * Collapsed state UI - vertical strip with Settings (expand), Manual, and Chat icons
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
      <div className="flex h-full flex-col items-center gap-1 py-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleRightSidebar}
              aria-label="Expand settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Expand settings</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleManual}
              className={cn(mode === "manual" && "bg-muted text-foreground")}
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
              className={cn(mode === "chat" && "bg-muted text-foreground")}
              aria-label="Chat mode"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Chat</TooltipContent>
        </Tooltip>
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
      <div className="flex-1 overflow-y-auto hide-scrollbar">
        <StudioSettingsSidebarContent />
      </div>
    </div>
  );
}
