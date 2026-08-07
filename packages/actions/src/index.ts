import { sha256 } from "../../security/src";

/**
 * Approval-gated provider writes.
 *
 * HydraDB is the read/context layer; it is not assumed to perform provider writes. This
 * module talks to Linear's own API, and only ever after a human approval has been
 * recorded.
 *
 * Two properties matter more than the request itself:
 *  - the API key must never appear in an error, log or thrown value;
 *  - replaying the same proposal must not create a second issue.
 */

export const LINEAR_ENDPOINT = "https://api.linear.app/graphql";

export type Commitment = {
  id: string;
  summary: string;
  owner: string | null;
  deadline: string | null;
  customer: string | null;
  evidenceIds: string[];
  sourceProvider: string;
};

export type IssuePayload = {
  title: string;
  description: string;
  teamId: string;
  projectId?: string;
};

export type RiskClass = "low" | "medium" | "high" | "critical";

/** Redact anything that looks like a credential before an error escapes this module. */
export function redactKey(message: string, apiKey?: string): string {
  let output = message;
  if (apiKey && apiKey.length >= 8) output = output.split(apiKey).join("[REDACTED]");
  return output
    .replace(/\blin_(?:api|oauth)_[A-Za-z0-9_-]+/g, "[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED]");
}

export class ProviderError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * Build the exact payload that would be sent. Evidence ids are embedded in the body so
 * the created issue carries its own provenance back to the sources that justified it.
 */
export function buildIssuePayload(commitment: Commitment, teamId: string, projectId?: string): IssuePayload {
  const title = commitment.summary.replace(/\s+/g, " ").trim().slice(0, 200) || "Untracked commitment";
  const lines = [
    commitment.summary.trim(),
    "",
    `Detected from: ${commitment.sourceProvider}`,
    commitment.owner ? `Owner: ${commitment.owner}` : "Owner: not stated in source",
    commitment.deadline ? `Deadline: ${commitment.deadline}` : "Deadline: not stated in source",
    commitment.customer ? `Customer: ${commitment.customer}` : null,
    "",
    "Evidence:",
    ...commitment.evidenceIds.map((id) => `- ${id}`),
    "",
    "Created from a QueueProof action proposal after human approval.",
  ].filter((line) => line !== null);

  return { title, description: lines.join("\n"), teamId, ...(projectId ? { projectId } : {}) };
}

export function riskClass(payload: IssuePayload, commitment: Commitment): RiskClass {
  if (commitment.evidenceIds.length === 0) return "critical";
  if (commitment.customer) return "high";
  if (!commitment.owner || !commitment.deadline) return "medium";
  return payload.projectId ? "low" : "medium";
}

/**
 * Deterministic idempotency key. The same workspace, commitment and payload always
 * produce the same key, which is what lets a replayed proposal collapse onto the
 * existing row rather than creating a duplicate issue.
 */
export async function idempotencyKeyFor(
  workspaceId: string,
  commitmentId: string,
  payload: IssuePayload,
): Promise<string> {
  const digest = await sha256(
    JSON.stringify([workspaceId, commitmentId, payload.teamId, payload.title, payload.description]),
  );
  return `qpk_${digest.slice(0, 40)}`;
}

type FetchLike = typeof fetch;

async function graphql<T>(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(LINEAR_ENDPOINT, {
      method: "POST",
      headers: { Authorization: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new ProviderError(redactKey(`Linear responded ${response.status}: ${text.slice(0, 300)}`, apiKey), response.status);
    }

    let parsed: { data?: T; errors?: Array<{ message?: string }> };
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      throw new ProviderError("Linear returned a response that was not valid JSON.");
    }
    if (parsed.errors?.length) {
      throw new ProviderError(redactKey(`Linear reported: ${parsed.errors.map((e) => e.message ?? "error").join("; ")}`, apiKey));
    }
    if (!parsed.data) throw new ProviderError("Linear returned no data.");
    return parsed.data;
  } catch (error) {
    if (error instanceof ProviderError) throw error;
    const message = error instanceof Error ? error.message : "Linear request failed.";
    throw new ProviderError(redactKey(message, apiKey));
  } finally {
    clearTimeout(timer);
  }
}

export type CreatedIssue = { id: string; identifier: string; url: string };

/**
 * Create an issue. The response shape is validated rather than trusted: a provider that
 * returns success:false or omits the issue must not be reported as a completed write.
 */
export async function createIssue(
  options: { apiKey: string; payload: IssuePayload; fetchImpl?: FetchLike; timeoutMs?: number },
): Promise<CreatedIssue> {
  const { apiKey, payload, fetchImpl = fetch, timeoutMs = 15_000 } = options;
  const data = await graphql<{ issueCreate?: { success?: boolean; issue?: Partial<CreatedIssue> } }>(
    apiKey,
    `mutation CreateIssue($input: IssueCreateInput!) {
       issueCreate(input: $input) { success issue { id identifier url } }
     }`,
    {
      input: {
        teamId: payload.teamId,
        title: payload.title,
        description: payload.description,
        ...(payload.projectId ? { projectId: payload.projectId } : {}),
      },
    },
    fetchImpl,
    timeoutMs,
  );

  const issue = data.issueCreate?.issue;
  if (!data.issueCreate?.success || !issue?.id || !issue.identifier || !issue.url) {
    throw new ProviderError("Linear did not confirm issue creation.");
  }
  return { id: issue.id, identifier: issue.identifier, url: issue.url };
}

/** Search existing issues so an already-tracked commitment is not duplicated. */
export async function searchIssues(
  options: { apiKey: string; term: string; fetchImpl?: FetchLike; timeoutMs?: number },
): Promise<Array<{ id: string; identifier: string; title: string }>> {
  const { apiKey, term, fetchImpl = fetch, timeoutMs = 15_000 } = options;
  const data = await graphql<{ issueSearch?: { nodes?: Array<{ id?: string; identifier?: string; title?: string }> } }>(
    apiKey,
    `query SearchIssues($term: String!) {
       issueSearch(query: $term, first: 10) { nodes { id identifier title } }
     }`,
    { term },
    fetchImpl,
    timeoutMs,
  );
  return (data.issueSearch?.nodes ?? [])
    .filter((node): node is { id: string; identifier: string; title: string } =>
      Boolean(node.id && node.identifier && node.title))
    .map((node) => ({ id: node.id, identifier: node.identifier, title: node.title }));
}

