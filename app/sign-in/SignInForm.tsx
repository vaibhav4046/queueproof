"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowRight, LoaderCircle, Mail } from "lucide-react";
import { SiGithub, SiGoogle, SiSlack } from "react-icons/si";
import {
  createQueueProofBrowserClient,
  type QueueProofBrowserConfig,
} from "../../lib/supabase/client";
import type { QueueProofSocialProvider } from "../../lib/supabase/social-providers";
import styles from "./sign-in.module.css";

type SignInFormProps = {
  creating: boolean;
  nextPath: string;
  socialProviders: QueueProofSocialProvider[];
  supabase: QueueProofBrowserConfig;
};

const SOCIAL_PROVIDER_LABELS: Record<QueueProofSocialProvider, string> = {
  google: "Google",
  github: "GitHub",
  slack_oidc: "Slack",
};

function SocialIcon({ provider }: { provider: QueueProofSocialProvider }) {
  if (provider === "google") return <SiGoogle aria-hidden="true" size={16} />;
  if (provider === "github") return <SiGithub aria-hidden="true" size={17} />;
  return <SiSlack aria-hidden="true" size={16} />;
}

export function SignInForm({ creating, nextPath, socialProviders, supabase }: SignInFormProps) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [socialPending, setSocialPending] = useState<QueueProofSocialProvider | null>(null);

  function callbackUrl() {
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", nextPath);
    return callback.toString();
  }

  async function continueWith(provider: QueueProofSocialProvider) {
    if (pending || socialPending) return;
    setSocialPending(provider);
    setError("");
    const client = createQueueProofBrowserClient(supabase);
    if (!client) {
      setError("Account sign-in is temporarily unavailable. The public demo remains open.");
      setSocialPending(null);
      return;
    }
    const { error: authError } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: callbackUrl() },
    });
    if (authError) {
      setError(`We could not continue with ${SOCIAL_PROVIDER_LABELS[provider]}. Try work email instead.`);
      setSocialPending(null);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    const client = createQueueProofBrowserClient(supabase);
    if (!client) {
      setError("Account sign-in is temporarily unavailable. The public demo remains open.");
      setPending(false);
      return;
    }
    const { error: authError } = await client.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callbackUrl(),
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
    <div className={styles.authMethods}>
      {socialProviders.length ? (
        <div className={styles.socialMethods} aria-label="Social sign in options">
          {socialProviders.map((provider) => (
            <button
              className={styles.social}
              type="button"
              key={provider}
              onClick={() => void continueWith(provider)}
              disabled={pending || Boolean(socialPending)}
            >
              {socialPending === provider
                ? <LoaderCircle className={styles.spinner} size={17} />
                : <SocialIcon provider={provider} />}
              <span>Continue with {SOCIAL_PROVIDER_LABELS[provider]}</span>
              <ArrowRight aria-hidden="true" size={15} />
            </button>
          ))}
          <div className={styles.divider}><span>or use work email</span></div>
        </div>
      ) : null}
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
          disabled={pending || Boolean(socialPending)}
        />
        <button className={styles.primary} type="submit" disabled={pending || Boolean(socialPending) || !email.trim()}>
          {pending ? <LoaderCircle className={styles.spinner} size={17} /> : <Mail size={17} />}
          {pending ? "Sending secure link…" : creating ? "Create my private workspace" : "Email me a sign-in link"}
          <ArrowRight aria-hidden="true" size={16} />
        </button>
        {error ? <p className={styles.formError} role="alert">{error}</p> : null}
      </form>
    </div>
  );
}
