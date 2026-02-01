"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useStudio } from "./studio-provider";
import { StudioSidebar } from "./studio-sidebar";

/** Sidebar overlay width: matches desktop default, capped for small screens */
const MOBILE_SIDEBAR_WIDTH = "min(280px, 85vw)";

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const sidebarVariants = {
  hidden: { x: "-100%" },
  visible: { x: 0 },
  exit: { x: "-100%" },
};

const transition = { type: "tween" as const, duration: 0.25, ease: [0.32, 0.72, 0, 1] as const };

/**
 * StudioMobileFloatingNav
 * Mobile-only: fixed toggle button at bottom-left opens a full-height sidebar overlay.
 * Reuses StudioSidebar for layout and look consistency with desktop.
 * When closed, only the toggle button is present and does not block underlying content.
 */
export function StudioMobileFloatingNav() {
  const {
    state: { currentView },
  } = useStudio();
  const [isOpen, setIsOpen] = useState(false);
  const prevViewRef = useRef(currentView);

  // Close overlay when user navigates (clicks a nav item)
  useEffect(() => {
    if (isOpen && currentView !== prevViewRef.current) {
      prevViewRef.current = currentView;
      setIsOpen(false);
    } else {
      prevViewRef.current = currentView;
    }
  }, [isOpen, currentView]);

  const close = () => setIsOpen(false);

  return (
    <>
      {/* Toggle button: bottom-left, minimal footprint so it doesn't block content */}
      <div
        className="fixed left-0 bottom-15 z-50 w-fit h-fit p-4 pl-[max(1rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))]"
        aria-label="Mobile navigation"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon-lg"
              onClick={() => setIsOpen((open) => !open)}
              className="rounded-full shadow-md bg-background dark:bg-card border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary"
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
            >
              <PanelLeft className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{isOpen ? "Close menu" : "Open menu"}</TooltipContent>
        </Tooltip>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop: dimmed overlay; click to close */}
            <motion.div
              role="button"
              tabIndex={0}
              aria-label="Close menu"
              className="fixed inset-0 z-40 bg-black/50"
              variants={backdropVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={transition}
              onClick={close}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && close()}
            />
            {/* Sidebar panel: same content as desktop left sidebar */}
            <motion.aside
              className="fixed left-0 top-0 bottom-0 z-50 border-r border-border bg-sidebar overflow-y-auto hide-scrollbar shadow-xl"
              style={{ width: MOBILE_SIDEBAR_WIDTH }}
              variants={sidebarVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={transition}
              aria-label="Navigation menu"
            >
              <StudioSidebar onCloseRequested={close} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
