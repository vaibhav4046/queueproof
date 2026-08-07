import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowRight, Check, LockKeyhole, ShieldCheck } from "lucide-react";
import { OAuthError, parseAuthorizationRequest } from "../../../lib/server/oauth-provider";
import { requireRequestActor } from "../../../lib/server/identity";
import { QueueProofLogo, QueueProofSymbol } from "../../components/QueueProofLogo";
import styles from "./authorize.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Authorize AI client",
  description: "Review a request to connect an AI client to your QueueProof workspace.",
  robots: { index: false, follow: false },
};

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function originLabel(raw: string): string {
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.host : url.protocol.replace(":", "");
  } catch {
    return "registered AI client";
  }
}

const SCOPE_COPY: Record<string, string> = {
  "queueproof:read": "Search sources verified in your workspace and return cited answers",
  "queueproof:propose": "Draft proposals for you to review — never apply them",
  "queueproof:sync": "Refresh a connector you already verified",
};

/**
 * The consent screen for QueueProof's own authorization server.
 *
 * Everything the client asked for is re-validated here before a single pixel renders,
 * so a malformed or hostile authorize URL fails on this page rather than at redemption
 * time when a code already exists. The workspace is never taken from the query string:
 * approval binds the grant to whoever is signed in on this browser.
 */
export default async function OAuthAuthorizePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) query.set(key, first(value));

  let request: Awaited<ReturnType<typeof parseAuthorizationRequest>>;
  try {
    request = await parseAuthorizationRequest(query);
  } catch (error) {
    const reason = error instanceof OAuthError ? error.code : "invalid_request";
    redirect(`/developer?oauth=${encodeURIComponent(reason)}`);
  }

  try {
    await requireRequestActor();
  } catch {
    redirect(`/sign-in?next=${encodeURIComponent(`/oauth/authorize?${query.toString()}`)}`);
  }

  // Name the boundary on the button itself. A reviewer approving a read-only
  // client should not have to cross-check the scope list to know the grant
  // cannot write anything.
  const isReadOnlyGrant = request.scopes.every((scope) => scope === "queueproof:read");

  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}><QueueProofLogo /></header>
      <section className={styles.card} aria-labelledby="oauth-title">
        <span className={styles.symbol} aria-hidden="true"><QueueProofSymbol /></span>
        <span className={styles.eyebrow}>AI CLIENT CONNECTION</span>
        <h1 id="oauth-title">Connect to your proof workspace.</h1>

        <div className={styles.clientRow}>
          <span className={styles.clientMark}>{request.client.clientName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{request.client.clientName}</strong>
            <span>{originLabel(request.redirectUri)}</span>
          </div>
        </div>

        <div className={styles.permissions}>
          <h2>This client will be able to</h2>
          <ul>
            {request.scopes.map((scope) => (
              <li key={scope}><Check size={15} /> {SCOPE_COPY[scope] ?? scope}</li>
            ))}
          </ul>
        </div>

        <div className={styles.boundary}>
          <LockKeyhole size={17} />
          <span>QueueProof never gives the client your HydraDB key or another user&apos;s sources. Revoke this connection any time from the developer screen.</span>
        </div>

        <form className={styles.actions} method="post" action="/api/oauth/approve">
          <input type="hidden" name="client_id" value={request.client.clientId} />
          <input type="hidden" name="redirect_uri" value={request.redirectUri} />
          <input type="hidden" name="code_challenge" value={request.codeChallenge} />
          <input type="hidden" name="code_challenge_method" value="S256" />
          <input type="hidden" name="response_type" value="code" />
          <input type="hidden" name="scope" value={request.scopes.join(" ")} />
          {request.state ? <input type="hidden" name="state" value={request.state} /> : null}
          {request.resource ? <input type="hidden" name="resource" value={request.resource} /> : null}
          <button type="submit" name="decision" value="deny" className={styles.secondary}>Cancel</button>
          <button type="submit" name="decision" value="approve" className={styles.primary}>
            <ShieldCheck size={17} />
            {isReadOnlyGrant ? "Allow read-only access" : "Allow access"}
            <ArrowRight size={16} />
          </button>
        </form>
      </section>
      <p className={styles.footer}>You can revoke this connection from QueueProof at any time.</p>
    </main>
  );
}
