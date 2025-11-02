import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Removed 'output: export' to support dynamic routes like /depots/[id]
  // For local development and dynamic data, we don't need static export
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
