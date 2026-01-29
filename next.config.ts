import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Skip type checking during `next build` to avoid heap OOM on large codebases.
    // Run `npm run typecheck` (or typecheck:ci) separately to enforce type safety.
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
