import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Skip type checking during `next build` to avoid heap OOM on large codebases.
    // Run `npm run typecheck` (or typecheck:ci) separately to enforce type safety.
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      // Safety net if Supabase Site URL was ever set to .../studio
      {
        source: "/studio/oauth/consent",
        destination: "/oauth/consent",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
      {
        source: "/.well-known/openai-apps-challenge",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Content-Disposition", value: "inline" },
        ],
      },
    ];
  },
};

export default nextConfig;
