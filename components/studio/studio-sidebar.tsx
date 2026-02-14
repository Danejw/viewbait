"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Zap,
  Grid3x3,
  FolderOpen,
  FolderKanban,
  Palette,
  Droplets,
  User,
  Youtube,
  Lock,
  Gift,
  LogOut,
  Download,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Newspaper,
  MessageSquare,
  LayoutDashboard,
  MapPin,
} from "lucide-react";
import Link from "next/link";
import { ThemeToggleSimple } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ViewBaitLogo } from "@/components/ui/viewbait-logo";
import { useStudio, useStudioState, type StudioView } from "@/components/studio/studio-provider";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useNotifications } from "@/lib/hooks/useNotifications";
import { clearUserCache } from "@/lib/utils/clear-user-cache";
import { useSubscription } from "@/lib/hooks/useSubscription";
import SubscriptionModal from "@/components/subscription-modal";
import ReferralModal from "@/components/referral-modal";
import AccountSettingsModal from "@/components/account-settings-modal";
import { NotificationBell } from "@/components/notifications";

export interface NavItem {
  label: string;
  view: StudioView;
  icon: React.ComponentType<{ className?: string }>;
  locked?: boolean;
  /** When true, tab is unlocked when tier === 'pro'; when locked, click opens subscription modal */
  unlockWithPro?: boolean;
  /** When set, navigate to this URL instead of setView. Pro-gated when unlockWithPro. */
  href?: string;
  /** Nested items shown under this one (e.g. Assistant under YouTube). */
  children?: NavItem[];
  /** Optional badge shown to the right of the label (e.g. "beta"). */
  badge?: "beta";
}

export const navItems: NavItem[] = [
  { label: "Create", view: "generator", icon: Zap },
  { label: "Browse", view: "browse", icon: FolderOpen },
  { label: "Gallery", view: "gallery", icon: Grid3x3 },
  { label: "Projects", view: "projects", icon: FolderKanban },
  { label: "Styles", view: "styles", icon: Palette },
  { label: "Palettes", view: "palettes", icon: Droplets },
  { label: "Faces", view: "faces", icon: User },
  { label: "Notifications", view: "updates", icon: Newspaper },
  {
    label: "YouTube",
    view: "youtube",
    icon: Youtube,
    locked: true,
    unlockWithPro: true,
    children: [
      {
        label: "Assistant",
        view: "assistant",
        icon: MessageSquare,
        locked: true,
        unlockWithPro: true,
        badge: "beta",
      },
    ],
  },
];

function navItemKey(item: NavItem): string {
  return item.href ?? item.view;
}

/**
 * StudioSidebarNav
 * Navigation items in the sidebar - switches views within SPA
 * Supports collapsed mode with icon-only + tooltips.
 * YouTube tab is unlocked for Pro; when locked, click opens subscription modal.
 */
export function StudioSidebarNav() {
  const {
    state: { currentView, leftSidebarCollapsed },
    actions: { setView },
  } = useStudio();
  const { tier, productId } = useSubscription();
  const { isAdmin } = useUserRole();
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);

  const renderItem = (item: NavItem, isChild = false) => {
    const Icon = item.icon;
    const isActive = item.href ? false : currentView === item.view;
    const isLocked =
      item.locked && !(item.unlockWithPro && tier === "pro");
    const openModalOnClick = isLocked && item.unlockWithPro;
    const canNavigate = item.href && !isLocked;

    const buttonContent = canNavigate ? (
      <Button
        variant="side"
        size={leftSidebarCollapsed ? "icon-sm" : "sm"}
        asChild
        className={cn(
          "w-full",
          leftSidebarCollapsed ? "shrink-0 justify-center hover:bg-transparent" : "justify-start text-left gap-3",
          "text-sidebar-foreground"
        )}
      >
        <Link href={item.href!}>
          <Icon className="h-4 w-4 shrink-0" />
          {!leftSidebarCollapsed && <span>{item.label}</span>}
        </Link>
      </Button>
    ) : (
      <Button
        type="button"
        variant={isActive ? "ghost" : "side"}
        size={leftSidebarCollapsed ? "icon-sm" : "sm"}
        onClick={() => {
          if (openModalOnClick) {
            setSubscriptionModalOpen(true);
          } else if (!isLocked && !item.href) {
            setView(item.view);
          }
        }}
        disabled={isLocked && !openModalOnClick}
        className={cn(
          "w-full",
          leftSidebarCollapsed ? "shrink-0 justify-center hover:bg-transparent" : "justify-start text-left gap-3",
          isActive
            ? "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary hover:text-sidebar-primary-foreground"
            : "text-sidebar-foreground",
          leftSidebarCollapsed && "hover:!bg-transparent",
          isLocked && !openModalOnClick && "opacity-50 cursor-not-allowed"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!leftSidebarCollapsed && (
          <>
            <span>{item.label}</span>
            {item.badge === "beta" && (
              <span className="rounded px-1 py-0.25 text-[8px] font-medium uppercase tracking-wide bg-white text-primary border border-primary/40">
                Beta
              </span>
            )}
            {isLocked && <Lock className="ml-auto h-3 w-3" />}
          </>
        )}
      </Button>
    );

    const wrapped = leftSidebarCollapsed ? (
      <Tooltip>
        <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
        <TooltipContent side="right" className="flex items-center" variant={isActive ? "primary" : "default"}>
          {item.label}
          {isLocked && <Lock className="h-3 w-3" />}
        </TooltipContent>
      </Tooltip>
    ) : (
      buttonContent
    );

    return (
      <div
        key={navItemKey(item)}
        className={cn(isChild && !leftSidebarCollapsed && "pl-6")}
      >
        {wrapped}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <nav className={cn("flex flex-col gap-1", leftSidebarCollapsed ? "p-2" : "p-4")}>
        {navItems.map((item) => (
          <React.Fragment key={navItemKey(item)}>
            {renderItem(item)}
            {item.children?.map((child) => renderItem(child, true))}
            {(item.view === "browse" || item.view === "updates") && (
              <div className="border-t border-sidebar-border my-2" aria-hidden />
            )}
          </React.Fragment>
        ))}
        {isAdmin && (() => {
          const adminNavItem: NavItem = {
            label: "Admin",
            view: "admin",
            icon: LayoutDashboard,
            children: [
              { label: "Roadmap", view: "roadmap", icon: MapPin },
            ],
          };
          return (
            <>
              <div className="border-t border-sidebar-border my-2" aria-hidden />
              {renderItem(adminNavItem)}
              {adminNavItem.children?.map((child) => renderItem(child, true))}
            </>
          );
        })()}
      </nav>
      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        currentTier={tier}
        currentProductId={productId}
      />
    </TooltipProvider>
  );
}

/**
 * StudioSidebarCredits
 * Credits display section - adapts to collapsed state
 * Click to open subscription modal for upgrades.
 * Wrapped in React.memo so it only re-renders when useStudioState() or useSubscription() values change, not when the provider re-renders from data/thumbnails updates.
 */
export const StudioSidebarCredits = React.memo(function StudioSidebarCredits() {
  const { leftSidebarCollapsed } = useStudioState();
  const { tier, tierConfig, creditsRemaining, creditsTotal, isLoading, productId } = useSubscription();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (leftSidebarCollapsed) {
    return (
      <>
        <TooltipProvider delayDuration={0}>
          <div className="border-t border-sidebar-border p-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="side"
                  size="icon-sm"
                  onClick={() => setIsModalOpen(true)}
                  className="w-full flex items-center justify-center"
                >
                  {isLoading ? (
                    <Skeleton className="h-8 w-8 rounded-md" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center text-xs font-medium">
                      {creditsRemaining}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isLoading
                  ? "Loading..."
                  : `${tierConfig.name} Plan`}
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
        <SubscriptionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          currentTier={tier}
          currentProductId={productId}
        />
      </>
    );
  }

  return (
    <>
      <TooltipProvider delayDuration={0}>
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-start justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsModalOpen(true)}
              className="text-left cursor-pointer hover:opacity-80 flex-1 min-w-0 p-0 h-auto"
            >
              {isLoading ? (
                <div className="flex flex-col gap-1">
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ) : (
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-sidebar-foreground block">
                    {tierConfig.name}
                  </span>
                  <span className="text-xs text-sidebar-foreground/70 block">
                    <span className="text-primary font-medium">{creditsRemaining}</span>
                    {" "}/ {creditsTotal} credits
                  </span>
                </div>
              )}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsModalOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Manage Subscription</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </TooltipProvider>
      <SubscriptionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentTier={tier}
        currentProductId={productId}
      />
    </>
  );
});

/**
 * StudioSidebarUser
 * User section at bottom of sidebar - adapts to collapsed state
 */
export function StudioSidebarUser() {
  const {
    state: { leftSidebarCollapsed },
    actions: { openUpdate },
  } = useStudio();
  const { user, profile, signOut, isLoading: authLoading } = useAuth();
  const { unreadCount } = useNotifications({ autoFetch: true });
  const router = useRouter();
  const queryClient = useQueryClient();
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);

  // Derive display values
  const displayName =
    profile?.full_name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";
  const displayEmail = profile?.email || user?.email || "";
  const truncatedEmail =
    displayEmail.length > 15 ? displayEmail.slice(0, 12) + "..." : displayEmail;
  const avatarUrl = profile?.avatar_url;
  // Generate initials from name (first letter of each word, max 2)
  const nameParts = displayName.split(" ").filter(Boolean);
  const initials =
    nameParts.length > 1
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase().slice(0, 2)
      : displayName.slice(0, 2).toUpperCase();

  // Sign out handler: sign out, clear user cache, then redirect to root
  const handleSignOut = async () => {
    await signOut();
    clearUserCache(queryClient);
    router.replace("/");
  };

  if (leftSidebarCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <div className="mt-auto border-t border-sidebar-border p-2">
          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <NotificationBell
                    size="icon-sm"
                    onOpenInCenter={(id) => openUpdate(id)}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" variant={unreadCount > 0 ? "primary" : "default"}>
                Notifications
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <ThemeToggleSimple size="icon-sm" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">Theme</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={() => setReferralModalOpen(true)}>
                  <Gift className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Referral code</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" onClick={handleSignOut}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Log out</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <ReferralModal isOpen={referralModalOpen} onClose={() => setReferralModalOpen(false)} />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="mt-auto border-t border-sidebar-border p-4">
        <div className="mb-4 flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <NotificationBell
                  size="icon-sm"
                  onOpenInCenter={(id) => openUpdate(id)}
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right" variant={unreadCount > 0 ? "primary" : "default"}>
                Notifications
              </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <ThemeToggleSimple size="icon-sm" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="right">Theme</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={() => setReferralModalOpen(true)}>
                <Gift className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Referral code</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Log out</TooltipContent>
          </Tooltip>
        </div>
      <Button
        type="button"
        variant="side"
        onClick={() => setAccountModalOpen(true)}
        className="p-4 h-auto w-full justify-start gap-3 rounded-md px-0 py-0 text-left focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        aria-label="Open account settings"
      >
        <Avatar size="sm">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          {authLoading ? (
            <>
              <Skeleton className="h-4 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-sidebar-foreground truncate group-hover/button:text-primary">
                {displayName}
              </p>
              <p className="text-xs text-sidebar-foreground/70 truncate group-hover/button:text-primary">
                {truncatedEmail}
              </p>
            </>
          )}
        </div>
      </Button>
      {/* <Button variant="outline" size="sm" className="w-full">
        <Download className="mr-2 h-4 w-4" />
        Export All Data
      </Button> */}
        <ReferralModal isOpen={referralModalOpen} onClose={() => setReferralModalOpen(false)} />
        <AccountSettingsModal
          isOpen={accountModalOpen}
          onClose={() => setAccountModalOpen(false)}
        />
    </div>
    </TooltipProvider>
  );
}

/**
 * StudioSidebarToggle
 * Toggle button to collapse/expand the left sidebar
 */
export function StudioSidebarToggle() {
  const {
    state: { leftSidebarCollapsed },
    actions: { toggleLeftSidebar },
  } = useStudio();

  return (
    <TooltipProvider delayDuration={0}>
        <div className={cn("border-t border-sidebar-border", leftSidebarCollapsed ? "p-2" : "p-4")}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size={leftSidebarCollapsed ? "icon-sm" : "sm"}
              onClick={toggleLeftSidebar}
              className={cn(
                leftSidebarCollapsed ? "w-full justify-center" : "w-full justify-start"
              )}
            >
              {leftSidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4 mr-2" />
                  <span>Collapse</span>
                </>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {leftSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

/**
 * StudioSidebar
 * Complete sidebar composition - content only (frame wrapper is in page).
 * When onCloseRequested is provided (e.g. mobile overlay), logo button calls it instead of toggle.
 */
export function StudioSidebar({ onCloseRequested }: { onCloseRequested?: () => void } = {}) {
  const {
    state: { leftSidebarCollapsed },
    actions: { toggleLeftSidebar },
  } = useStudio();

  const handleLogoClick = onCloseRequested ?? toggleLeftSidebar;

  return (
    <div className="flex h-full flex-col">
      {/* Logo / collapse toggle */}
      <div className={cn(leftSidebarCollapsed ? "p-2" : "p-2")}>
              <Button
                type="button"
                variant="ghost"
                size={leftSidebarCollapsed ? "icon-sm" : "sm"}
                onClick={handleLogoClick}
                className={cn(
                  "w-full hover:bg-sidebar-accent/50 text-sidebar-foreground",
                  leftSidebarCollapsed ? "justify-center" : "justify-start gap-2 text-left"
                )}
                aria-label={onCloseRequested ? "Close menu" : leftSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <div className="flex h-8 w-8 items-center justify-center shrink-0">
                  <ViewBaitLogo className="h-4 w-4" />
                </div>
                {!leftSidebarCollapsed && (
                  <span className="text-lg font-semibold text-sidebar-foreground">View<span className="text-primary">Bait</span></span>
                )}
              </Button>
      </div>
      <StudioSidebarCredits />
      <div className="border-t border-sidebar-border" aria-hidden />
      <StudioSidebarNav />
      <StudioSidebarUser />
      {/* <StudioSidebarToggle /> */}
    </div>
  );
}
