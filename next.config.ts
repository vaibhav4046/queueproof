import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const buildTimestamp = process.env.QUEUEPROOF_DEPLOYMENT_TIMESTAMP || new Date().toISOString();

export const productionSecurityHeaders = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "frame-src 'none'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://api.hydradb.com https://*.hydradb.com https://*.supabase.co",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
] as const;

export function securityHeaderRules(nodeEnv = process.env.NODE_ENV) {
  if (nodeEnv !== "production") return [];
  return [{ source: "/(.*)", headers: [...productionSecurityHeaders] }];
}

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  // Git-triggered Vercel deployments do not expose a creation timestamp to the
  // runtime. Stamp the immutable artifact at build time so the release receipt
  // remains complete without a mutable project-level environment variable.
  env: {
    QUEUEPROOF_BUILD_TIMESTAMP: buildTimestamp,
  },
  async headers() {
    return securityHeaderRules();
  },
  webpack(config) {
    config.resolve.alias[path.resolve(projectRoot, "lib/server/runtime-provider.ts")] =
      path.resolve(projectRoot, "lib/server/runtime-vercel.ts");
    return config;
  },
};

export default nextConfig;
