"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { createQueueProofBrowserClient } from "../../lib/supabase/client";
import styles from "./sign-in.module.css";

type SignInFormProps = {
  creating: boolean;
  nextPath: string;
};

export function SignInForm({ creating, nextPath }: SignInFormProps) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const client = createQueueProofBrowserClient();
    if (!client) {
      setError("Account sign-in is temporarily unavailable. The public demo remains open.");
      setPending(false);
      return;
    }
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", nextPath);
    const { error: authError } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callback.toString(),
        shouldCreateUser: creating,
      },
    });
    setPending(false);
    if (authError) {
      setError(
        creating
          ? "We could not send the secure link. Check the address and try again."
          : "We could not send the secure link. If you are new, create a workspace first.",
      );
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className={styles.sent} role="status" aria-live="polite">
        <Mail size={18} />
        <div>
          <strong>Check your inbox.</strong>
          <span>Open the QueueProof link sent to {email.trim()}. It expires automatically.</span>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label htmlFor={emailId}>Work email</label>
      <input
        id={emailId}
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        maxLength={254}
        placeholder="you@company.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        disabled={pending}
      />
      <button className={styles.primary} type="submit" disabled={pending || !email.trim()}>
        {pending ? <LoaderCircle className={styles.spinner} size={17} /> : <Mail size={17} />}
        {pending ? "Sending secure link…" : creating ? "Create my private workspace" : "Email me a sign-in link"}
        <ArrowRight size={16} />
      </button>
      {error ? <p className={styles.formError} role="alert">{error}</p> : null}
    </form>
  );
}
