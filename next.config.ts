import type { NextConfig } from "next";

// Local-first, single-user app: every page reads the local data store on each
// request, so we use the classic (non-Cache-Components) rendering model and mark
// the root layout as force-dynamic.
const nextConfig: NextConfig = {
  serverExternalPackages: ["mammoth"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
