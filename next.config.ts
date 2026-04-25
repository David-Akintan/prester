import type { NextConfig } from "next";

// Build metadata: Last updated April 25, 2026
const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required for @initia/react-wallet-widget transpilation
  transpilePackages: ["@initia/react-wallet-widget"],
};

export default nextConfig;
