"use client";

import React from "react";
import { Settings, PanelRightClose, PanelRightOpen } from "lucide-react";
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
 * Header with title and collapse toggle for the settings panel
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
    <div className="flex items-center justify-between border-b border-border p-4">
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Settings</h2>
      </div>
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={toggleRightSidebar}>
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Collapse settings</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

/**
 * StudioSettingsSidebarCollapsed
 * Collapsed state UI - vertical strip with expand button
 */
export function StudioSettingsSidebarCollapsed() {
  const {
    actions: { toggleRightSidebar },
  } = useStudio();

  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-full flex-col items-center py-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={toggleRightSidebar}>
              <PanelRightOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Expand settings</TooltipContent>
        </Tooltip>
        <div className="mt-4 flex flex-1 items-center">
          <span
            className="text-xs font-medium text-muted-foreground"
            style={{
              writingMode: "vertical-rl",
              textOrientation: "mixed",
              transform: "rotate(180deg)",
            }}
          >
            Settings
          </span>
        </div>
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
