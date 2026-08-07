"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Check, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import type { OAuthAuthorizationDetails } from "@supabase/supabase-js";
import {
  createQueueProofBrowserClient,
  type QueueProofBrowserConfig,
} from "../../../lib/supabase/client";
import { QueueProofLogo, QueueProofSymbol } from "../../components/QueueProofLogo";
import styles from "./authorize.module.css";

type ConsentClientProps = {
  authorizationId: string;
  supabase: QueueProofBrowserConfig;
};

function safeRedirect(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function originLabel(raw: string): string {
  try { return new URL(raw).hostname; } catch { return "registered AI client"; }
}

export function ConsentClient({ authorizationId, supabase }: ConsentClientProps) {
  const client = createQueueProofBrowserClient(supabase);
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [error, setError] = useState(
    client ? "" : "AI connection is not configured on this deployment.",
  );
  const [pending, setPending] = useState<"approve" | "deny" | null>(null);

  useEffect(() => {
    let active = true;
    if (!client) return () => { active = false; };
    async function loadDetails() {
      const result = await client.auth.oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      const { data, error: authError } = result;
      if (authError || !data) {
        setError("This authorization request is invalid or has expired.");
        return;
      }
      if ("redirect_url" in data) {
        const destination = safeRedirect(data.redirect_url);
        if (destination) window.location.assign(destination);
        else setError("The registered client returned an unsafe redirect.");
        return;
      }
      setDetails(data);
    }
    void loadDetails();
    return () => { active = false; };
  }, [authorizationId, client]);

  async function decide(decision: "approve" | "deny") {
    if (!client || pending) return;
    setPending(decision);
    setError("");
    const result = decision === "approve"
      ? await client.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await client.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    const destination = result.data?.redirect_url ? safeRedirect(result.data.redirect_url) : null;
    if (result.error || !destination) {
      setPending(null);
      setError("QueueProof could not complete this authorization request. Try connecting again.");
      return;
    }
    window.location.assign(destination);
  }

  const scopes = details?.scope.split(/\s+/).filter(Boolean) ?? [];
  return (
    <main className={styles.page} id="main-content">
      <header className={styles.header}><QueueProofLogo /></header>
      <section className={styles.card} aria-labelledby="oauth-title">
        <span className={styles.symbol} aria-hidden="true"><QueueProofSymbol /></span>
        <span className={styles.eyebrow}>AI CLIENT CONNECTION</span>
        <h1 id="oauth-title">Connect to your proof workspace.</h1>
        {error ? <div className={styles.error} role="alert"><ShieldCheck size={18} />{error}</div> : null}
        {!details && !error ? (
          <div className={styles.loading} role="status"><LoaderCircle size={18} />Checking the signed request…</div>
        ) : null}
        {details ? <>
          <div className={styles.clientRow}>
            <span className={styles.clientMark}>{details.client.name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{details.client.name}</strong>
              <span>{originLabel(details.redirect_uri)}</span>
            </div>
          </div>
          <div className={styles.permissions}>
            <h2>This client will be able to</h2>
            <ul>
              <li><Check size={15} /> Search only sources verified in your QueueProof workspace</li>
              <li><Check size={15} /> Return cited answers and evidence gaps</li>
              <li><Check size={15} /> Identify you through {scopes.join(", ") || "the approved account scope"}</li>
            </ul>
          </div>
          <div className={styles.boundary}>
            <LockKeyhole size={17} />
            <span>This connection starts read-only. QueueProof never gives the client your HydraDB key or another user&apos;s sources.</span>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} disabled={Boolean(pending)} onClick={() => decide("deny")}>Cancel</button>
            <button type="button" className={styles.primary} disabled={Boolean(pending)} onClick={() => decide("approve")}>
              {pending === "approve" ? <LoaderCircle size={17} /> : <ShieldCheck size={17} />}
              {pending === "approve" ? "Connecting…" : "Allow read-only access"}
              <ArrowRight size={16} />
            </button>
          </div>
        </> : null}
      </section>
      <p className={styles.footer}>You can revoke this connection from QueueProof at any time.</p>
    </main>
  );
}
