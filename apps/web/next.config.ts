import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uploads go through server actions, whose default limit is 1 MB. Each action applies its own, lower limit.
  experimental: { serverActions: { bodySizeLimit: "55mb" } },
  outputFileTracingIncludes: { "/returns/[id]/pdf": ["./assets/**"] },
  /* config options here */
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
