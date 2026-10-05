import type { NextConfig } from "next";

// RainbowKit → Base Account → @coinbase/cdp-sdk lazily imports the optional x402 payment packages.
// Ormine never runs that code, so they resolve to an empty module instead of breaking the build.
const X402_OPTIONAL = ["@x402/core/client", "@x402/evm/exact/client", "@x402/evm/upto/client", "@x402/svm/exact/client"];

const nextConfig: NextConfig = {
  // The shared workspace package ships TypeScript sources.
  transpilePackages: ["@ormine/shared"],
  turbopack: {
    resolveAlias: {
      ...Object.fromEntries(X402_OPTIONAL.map((m) => [m, "./lib/empty-module.ts"])),
      "@x402/evm": "./lib/x402-evm-stub.ts",
    },
  },
};

export default nextConfig;
