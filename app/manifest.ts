import type { MetadataRoute } from "next";

/**
 * Web App Manifest for PWA "Add to Home Screen".
 * Uses ViewBait logo icons and CRT-style dark background (#0a0a0a).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ViewBait - Create Viral Thumbnails with AI",
    short_name: "ViewBait",
    description:
      "AI-powered thumbnail generation that helps creators design eye-catching, conversion-optimized thumbnails in seconds.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#b91c3c",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
