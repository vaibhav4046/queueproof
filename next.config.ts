import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  webpack(config) {
    config.resolve.alias[path.resolve(projectRoot, "lib/server/runtime-provider.ts")] =
      path.resolve(projectRoot, "lib/server/runtime-vercel.ts");
    return config;
  },
};

export default nextConfig;
