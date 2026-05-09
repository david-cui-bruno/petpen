import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Photo uploads from phones are commonly 1-5MB; default 1MB rejects them
      // at the framework layer before our 5MB check can run.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
