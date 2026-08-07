import type { RequestActor } from "./identity";
import { sha256 } from "../../packages/security/src";
import { redactSecretsDeep } from "../../packages/security/src";
import { createHash } from "node:crypto";

/**
 * Anonymous visitors share one deliberately selected demo workspace. They need the
 * curated proof (titles, excerpts, provider names, timestamps, ranking reasons and
 * status), not the identifiers used to address QueueProof or HydraDB storage.
 *
 * This projection runs at the response boundary, including for JSON read back from
 * old receipts. Ingestion-time cleanup alone is insufficient because a legacy row can
 * pre-date the current normaliser. Private actors receive the original value by
 * reference: this module must never reduce a signed-in owner's operational DTO.
 */

export const isPublicAccessActor = (actor: Pick<RequestActor, "id">): boolean =>
  actor.id === "user:public-access";

type PublicDtoOptions = {
  /** Stable, non-storage handle used by public ask/replay links. */
  referenceAliases?: ReadonlyArray<{ raw: string; public: string }>;
  /** Makes every remaining response reference deterministic for this one workspace. */
  workspaceId?: string;
};

type SanitiseContext = {
  aliases: Map<string, string>;
  nextAlias: number;
  workspaceId?: string;
};

const OMIT = Symbol("queueproof-public-dto-omit");

const normaliseKey = (key: string): string => key.replace(/[^a-z0-9]/gi, "").toLowerCase();

const omittedKey = (key: string): boolean => {
  const normalised = normaliseKey(key);
  return (
    normalised === "workspaceid" ||
    normalised === "database" ||
    normalised === "databases" ||
    normalised === "databaseid" ||
    normalised === "databaseids" ||
    normalised === "collection" ||
    normalised === "collections" ||
    normalised === "collectionid" ||
    normalised === "collectionids" ||
    normalised === "accountscope" ||
    normalised === "storageid" ||
    normalised === "storageids" ||
    normalised === "storagekey" ||
    normalised === "storagekeys" ||
    normalised === "fingerprint" ||
    normalised === "metadata" ||
    normalised === "metadatajson" ||
    normalised === "metadatafilters" ||
    normalised === "additionalmetadata" ||
    normalised === "lineagemetadatafilters" ||
    normalised === "externalid" ||
    normalised === "externalids" ||
    normalised === "requestid" ||
    normalised === "providerresponseid" ||
    normalised === "sha256" ||
    normalised === "sha1" ||
    normalised === "md5" ||
    normalised === "checksum" ||
    normalised === "digest" ||
    normalised === "etag" ||
    normalised === "deduplicatedtasks" ||
    normalised === "error" ||
    normalised === "errors" ||
    normalised === "lasterror" ||
    normalised === "rawerror" ||
    normalised === "executionerror" ||
    normalised === "failurereason" ||
    (normalised.startsWith("hydra") && (
      normalised.endsWith("id") ||
      normalised.endsWith("ids") ||
      normalised.endsWith("database") ||
      normalised.endsWith("collection") ||
      normalised.endsWith("fingerprint") ||
      normalised.endsWith("key")
    )) ||
    normalised.includes("hash")
  );
};

const urlKey = (key: string): boolean => {
  const normalised = normaliseKey(key);
  return normalised.endsWith("url") || normalised === "href" || normalised === "permalink";
};

const identifierKey = (key: string): boolean => {
  const normalised = normaliseKey(key);
  return normalised === "id" || normalised.endsWith("id") || normalised.endsWith("ids") ||
    normalised === "source" || normalised === "target";
};

/** Keep only browser-navigable links in an anonymous proof response. */
export function publicWebUrl(value: unknown): string | null {
  void value;
  // Provider permalinks can be private, signed, or carry query credentials even when
  // their scheme is HTTPS. The anonymous demo preserves the receipt text and provider,
  // but never emits a navigable source URL.
  return null;
}

export function publicStorageReference(workspaceId: string, kind: string, value: string): string {
  const safeKind = kind.replace(/[^a-z0-9]/gi, "").toLowerCase().replace(/ids?$/, "") || "ref";
  const digest = createHash("sha256")
    .update(`queueproof-public-reference:${workspaceId}:${safeKind}:${value}`)
    .digest("hex");
  return `public-${safeKind}-${digest.slice(0, 32)}`;
}

function aliasIdentifier(value: string, context: SanitiseContext, key: string): string {
  const existing = context.aliases.get(value);
  if (existing) return existing;
  const alias = context.workspaceId
    ? publicStorageReference(context.workspaceId, normaliseKey(key), value)
    : `public-ref-${context.nextAlias++}`;
  context.aliases.set(value, alias);
  return alias;
}

function sanitiseIdentifier(value: unknown, context: SanitiseContext, key: string): unknown {
  if (typeof value === "string") return aliasIdentifier(value, context, key);
  if (Array.isArray(value)) {
    return value.flatMap((entry) => typeof entry === "string" ? [aliasIdentifier(entry, context, key)] : []);
  }
  return value;
}

function sanitise(value: unknown, context: SanitiseContext, key = ""): unknown | typeof OMIT {
  if (omittedKey(key)) return OMIT;
  if (urlKey(key)) return publicWebUrl(value);
  if (normaliseKey(key) === "target" && typeof value === "string" && /^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    return null;
  }
  if (identifierKey(key)) return sanitiseIdentifier(value, context, key);
  if (Array.isArray(value)) {
    return value.flatMap((entry) => {
      const projected = sanitise(entry, context);
      return projected === OMIT ? [] : [projected];
    });
  }
  if (!value || typeof value !== "object") return value;

  const projected: Record<string, unknown> = {};
  for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
    const safeValue = sanitise(entryValue, context, entryKey);
    if (safeValue !== OMIT && safeValue !== undefined) projected[entryKey] = safeValue;
  }
  return projected;
}

export function publicDtoForActor<T>(
  actor: Pick<RequestActor, "id">,
  value: T,
  options: PublicDtoOptions = {},
): T {
  if (!isPublicAccessActor(actor)) return value;
  const context: SanitiseContext = { aliases: new Map(), nextAlias: 1, workspaceId: options.workspaceId };
  for (const alias of options.referenceAliases ?? []) {
    if (alias.raw) context.aliases.set(alias.raw, alias.public);
  }
  return sanitise(redactSecretsDeep(value), context) as T;
}

/**
 * A public query reference is stable enough for a browser-local replay link, but is
 * not the query_runs primary key. The route resolves it only inside the already
 * selected public workspace.
 */
export async function publicQueryReference(workspaceId: string, queryId: string): Promise<string> {
  const digest = await sha256(`queueproof-public-query:${workspaceId}:${queryId}`);
  return `public-query-${digest.slice(0, 32)}`;
}
