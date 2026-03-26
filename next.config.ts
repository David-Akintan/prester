import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Required for @initia/react-wallet-widget transpilation
  transpilePackages: ["@initia/react-wallet-widget"],
};

export default nextConfig;
