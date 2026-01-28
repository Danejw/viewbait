"use client";

import React from "react";
import { cn } from "@/lib/utils";

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
 * Three-column layout container
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
 * StudioSidebar
 * Left navigation sidebar - collapsible
 */
export function StudioSidebar({
  children,
  className,
  collapsed = false,
}: {
  children: React.ReactNode;
  className?: string;
  collapsed?: boolean;
}) {
  return (
    <aside
      className={cn(
        "border-r border-border bg-sidebar overflow-y-auto hide-scrollbar transition-all duration-200",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {children}
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

/**
 * StudioSettingsPanel
 * Right panel for settings/generator form - collapsible
 */
export function StudioSettingsPanel({
  children,
  className,
  collapsed = false,
}: {
  children: React.ReactNode;
  className?: string;
  collapsed?: boolean;
}) {
  return (
    <aside
      className={cn(
        "border-l border-border bg-card overflow-y-auto hide-scrollbar transition-all duration-200",
        collapsed ? "w-14" : "w-96",
        className
      )}
    >
      {children}
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
