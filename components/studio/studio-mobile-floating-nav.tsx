"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { PanelLeft, LogOut, Gift } from "lucide-react";
import { FloatingButton, FloatingButtonItem } from "@/components/ui/floating-button";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ThemeToggleSimple } from "@/components/theme-toggle";
import { useStudio } from "./studio-provider";
import { navItems } from "./studio-sidebar";
import { useAuth } from "@/lib/hooks/useAuth";
import { useSubscription } from "@/lib/hooks/useSubscription";
import SubscriptionModal from "@/components/subscription-modal";
import ReferralModal from "@/components/referral-modal";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "studio-floating-nav-bottom";
/** Default distance from viewport bottom so the stack sits lower and the top button isn’t cut off. */
const DEFAULT_BOTTOM_PX = 12;
const MIN_BOTTOM_PX = 16;

function getMaxBottomPx() {
  if (typeof window === "undefined") return 400;
  return window.innerHeight - 100;
}

/**
 * StudioMobileFloatingNav
 * Mobile-only floating button at bottom-left that opens navigation upward.
 * Draggable vertically along the left edge; position is persisted in localStorage.
 */
export function StudioMobileFloatingNav() {
  const {
    state: { currentView },
    actions: { setView },
  } = useStudio();
  const { signOut } = useAuth();
  const router = useRouter();
  const { creditsRemaining, isLoading: creditsLoading, productId, tier } = useSubscription();
  const [subscriptionModalOpen, setSubscriptionModalOpen] = useState(false);
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { resolvedTheme } = useTheme();

  const [bottomPx, setBottomPx] = useState(DEFAULT_BOTTOM_PX);
  const dragStartBottomRef = useRef(DEFAULT_BOTTOM_PX);
  const maxBottomRef = useRef(400);

  useEffect(() => {
    const maxBottom = getMaxBottomPx();
    maxBottomRef.current = maxBottom;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored != null) {
        const n = Number(stored);
        if (Number.isFinite(n)) {
          setBottomPx(Math.max(MIN_BOTTOM_PX, Math.min(maxBottom, n)));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const updateMax = () => {
      maxBottomRef.current = getMaxBottomPx();
    };
    window.addEventListener("resize", updateMax);
    return () => window.removeEventListener("resize", updateMax);
  }, []);

  const handleDragStart = useCallback(() => {
    dragStartBottomRef.current = bottomPx;
  }, [bottomPx]);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { y: number } }) => {
      if (Math.abs(info.offset.y) < 8) return;
      const maxBottom = maxBottomRef.current;
      const newBottom = Math.min(
        maxBottom,
        Math.max(MIN_BOTTOM_PX, dragStartBottomRef.current - info.offset.y)
      );
      setBottomPx(newBottom);
      try {
        localStorage.setItem(STORAGE_KEY, String(newBottom));
      } catch {
        /* ignore */
      }
    },
    []
  );

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (!error) router.replace("/auth");
  };

  // Order: from bottom (near trigger) to top: Log out, Theme, Credits, then nav items reversed (Generator at top)
  const navItemsReversed = [...navItems].reverse();

  const isDark = resolvedTheme === "dark";
  const gradientOverlayStyle = isDark
    ? { background: "linear-gradient(to right, rgba(0,0,0,0.85) 0%, transparent 100%)" }
    : { background: "linear-gradient(to right, rgba(255,255,255,0.9) 0%, transparent 100%)" };

  return (
    <>
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="fixed left-0 top-0 bottom-0 z-40 w-[min(900px,100vw)] pointer-events-none"
            style={gradientOverlayStyle}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden
          />
        )}
      </AnimatePresence>
      <motion.div
        className="fixed left-0 z-50 p-4 pl-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))] cursor-grab active:cursor-grabbing"
        style={{ bottom: bottomPx }}
        drag="y"
        dragConstraints={{
          top: -(maxBottomRef.current - bottomPx),
          bottom: Math.max(0, bottomPx - MIN_BOTTOM_PX),
        }}
        dragElastic={0}
        dragMomentum={false}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        aria-label="Mobile navigation"
        whileDrag={{ cursor: "grabbing" }}
      >
        <FloatingButton
          className="flex flex-col items-center"
          onOpenChange={setMenuOpen}
          triggerContent={
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="rounded-full shadow-md bg-background dark:bg-card border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary"
                  aria-label="Open menu"
                >
                  <PanelLeft className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Open menu</TooltipContent>
            </Tooltip>
          }
        >
          {/* Bottom of stack (closest to trigger): Log out */}
          <FloatingButtonItem label="Log out">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-lg"
                  onClick={handleSignOut}
                  className="rounded-full shadow-md bg-background dark:bg-card border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary"
                  aria-label="Log out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Log out</TooltipContent>
            </Tooltip>
          </FloatingButtonItem>
          {/* Theme */}
          <FloatingButtonItem label="Toggle theme">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <ThemeToggleSimple
                    size="icon-lg"
                    className="rounded-full bg-background dark:bg-card border border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-md"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">Toggle theme</TooltipContent>
            </Tooltip>
          </FloatingButtonItem>
          {/* Referral */}
          <FloatingButtonItem label="Referral code">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon-lg"
                  onClick={() => setReferralModalOpen(true)}
                  className="rounded-full shadow-md bg-background dark:bg-card border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary"
                  aria-label="Referral code"
                >
                  <Gift className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Referral code</TooltipContent>
            </Tooltip>
          </FloatingButtonItem>
          {/* Credits - opens subscription modal */}
          <FloatingButtonItem label="Credits and subscription">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-lg"
                  onClick={() => setSubscriptionModalOpen(true)}
                  className="rounded-full shadow-md bg-background dark:bg-card border-border text-foreground text-xs font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary min-w-10 h-10"
                  aria-label="Credits and subscription"
                >
                  {creditsLoading ? "…" : creditsRemaining}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Credits and subscription</TooltipContent>
            </Tooltip>
          </FloatingButtonItem>
          {/* Nav items: white by default; red (primary) when selected or on hover */}
          {navItemsReversed.map((item) => {
            const Icon = item.icon;
            const isSelected = currentView === item.view;
            const tooltipLabel = item.locked ? `${item.label} (coming soon)` : item.label;
            return (
              <FloatingButtonItem key={item.view} label={tooltipLabel}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-lg"
                      onClick={() => !item.locked && setView(item.view)}
                      disabled={item.locked}
                      className={cn(
                        "h-12 w-12 rounded-full shadow-md bg-background dark:bg-card border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary",
                        isSelected && "bg-primary text-primary-foreground border-primary ring-2 ring-primary ring-offset-2 ring-offset-background dark:ring-offset-card",
                        item.locked && "cursor-not-allowed"
                      )}
                      aria-label={item.label}
                      aria-current={isSelected ? "true" : undefined}
                    >
                      <Icon className="h-5 w-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">{tooltipLabel}</TooltipContent>
                </Tooltip>
              </FloatingButtonItem>
            );
          })}
        </FloatingButton>
      </motion.div>
      <SubscriptionModal
        isOpen={subscriptionModalOpen}
        onClose={() => setSubscriptionModalOpen(false)}
        currentTier={tier}
        currentProductId={productId}
      />
      <ReferralModal
        isOpen={referralModalOpen}
        onClose={() => setReferralModalOpen(false)}
      />
    </>
  );
}
