"use client";

import { createBrowserClient } from "@supabase/ssr";

export type QueueProofBrowserConfig = {
  url: string;
  publishableKey: string;
};

let cached: {
  signature: string;
  client: ReturnType<typeof createBrowserClient>;
} | null = null;

/** Browser auth uses only Supabase's publishable key; no service-role secret is shipped. */
export function createQueueProofBrowserClient(config?: QueueProofBrowserConfig) {
  const url = (
    config?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.trim();
  const key = (
    config?.publishableKey ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) return null;
  const signature = `${url}\0${key}`;
  if (cached?.signature === signature) return cached.client;
  const client = createBrowserClient(url, key, { auth: { flowType: "pkce" } });
  cached = { signature, client };
  return client;
}
