"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker once on mount.
 * Enables "Add to Home Screen" on browsers that require a SW (e.g. Chrome on Android).
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {});
  }, []);
  return null;
}
