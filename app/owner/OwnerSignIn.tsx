"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import styles from "./owner.module.css";
import { QueueProofLogo } from "../components/QueueProofLogo";

type SessionState = {
  signInConfigured: boolean;
  actor: null | {
    displayName: string;
    publicAccess: boolean;
    owner: boolean;
  };
};

export default function OwnerSignIn() {
  const router = useRouter();
  const [state, setState] = useState<SessionState | null>(null);
  const [accessToken, setAccessToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkSession = () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    void fetch("/api/session", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Owner access is temporarily unavailable.");
        return response.json() as Promise<SessionState>;
      })
      .then(setState)
      .catch((reason: unknown) => {
        setError(reason instanceof DOMException && reason.name === "AbortError"
          ? "Session check timed out. Your workspace has not been changed."
          : reason instanceof Error ? reason.message : "Owner access is temporarily unavailable.");
      })
      .finally(() => window.clearTimeout(timeout));
    return () => { window.clearTimeout(timeout); controller.abort(); };
  };

  useEffect(() => {
    return checkSession();
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !result.ok) throw new Error(result.error ?? "Sign-in failed.");
      router.push("/evidence");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/session", { method: "DELETE" });
      if (!response.ok) throw new Error("Sign-out failed.");
      router.push("/");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-out failed.");
      setBusy(false);
    }
  }

  const signedIn = Boolean(state?.actor && !state.actor.publicAccess);

  return (
    <main className={styles.shell}>
      <section className={styles.card} aria-labelledby="owner-title">
        <Link className={styles.brand} href="/" aria-label="Back to QueueProof">
          <QueueProofLogo />
        </Link>

        <div className={styles.heading}>
          <p>OWNER CONTROLS</p>
          <h1 id="owner-title">Workspace owner</h1>
          <span>
            Sign in to connect sources, manage documents, approve changes, and create
            AI connection keys. The public workspace remains read-only.
          </span>
        </div>

        {!state && !error ? <p className={styles.status}>Checking session…</p> : null}

        {signedIn ? (
          <div className={styles.signedIn}>
            <div>
              <small>AUTHENTICATED</small>
              <strong>{state?.actor?.displayName}</strong>
              <span>Owner controls are available for this browser session.</span>
            </div>
            <Link className={styles.primary} href="/evidence">Open source management</Link>
            <button className={styles.secondary} type="button" disabled={busy} onClick={() => void signOut()}>
              {busy ? "Signing out…" : "Sign out"}
            </button>
          </div>
        ) : state?.signInConfigured ? (
          <form className={styles.form} onSubmit={signIn}>
            <label htmlFor="owner-token">Owner key</label>
            <input
              id="owner-token"
              type="password"
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              placeholder="Paste QUEUEPROOF_ACCESS_TOKEN"
              aria-describedby="owner-token-help"
              minLength={16}
              required
              autoComplete="current-password"
              spellCheck={false}
            />
            <p id="owner-token-help">
              Find <code>QUEUEPROOF_ACCESS_TOKEN</code> in your hosting project&apos;s
              Environment Variables. To rotate it, replace the value, redeploy, and use
              the new key here. It creates a secure 12-hour browser session.
            </p>
            <button className={styles.primary} type="submit" disabled={busy || accessToken.length < 16}>
              {busy ? "Verifying…" : "Continue as owner"}
            </button>
          </form>
        ) : state ? (
          <div className={styles.notice}>
            Owner sign-in is not configured on this deployment. The public retrieval workspace remains available.
          </div>
        ) : null}

        {error ? <div className={styles.error} role="alert">{error}<button type="button" className={styles.secondary} onClick={() => { setError(null); setState(null); checkSession(); }}>Retry</button></div> : null}

        <Link className={styles.back} href="/">← Return to public workspace</Link>
      </section>
    </main>
  );
}
