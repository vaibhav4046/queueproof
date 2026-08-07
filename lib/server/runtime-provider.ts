import { env } from "cloudflare:workers";

export const runtimeBindings = env as Record<string, unknown>;

