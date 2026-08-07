import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Skips webpack bundling for `ably` in server code (API routes) — it's
  // require()'d directly from node_modules at runtime instead, which avoids
  // feeding its source through the SWC parser bug patched below.
  serverExternalPackages: ["ably"],
  webpack(config) {
    config.module.rules.unshift({
      test: /ably[/\\]build[/\\]modular[/\\]index\.mjs$/,
      enforce: "pre",
      use: [path.resolve(__dirname, "scripts/webpack/fix-ably-super.cjs")],
    });
    return config;
  },
};

export default nextConfig;
