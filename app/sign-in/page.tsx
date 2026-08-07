import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { EmberBackdrop } from "@/components/queueproof/ember-backdrop";
import { QueueProofLogo, QueueProofSymbol } from "../components/QueueProofLogo";
import {
  createQueueProofServerClient,
  enabledSupabaseSocialProviders,
  supabaseConfig,
  supabaseWebEnabled,
} from "../../lib/server/supabase";
import { queueProofAuthErrorMessage } from "../../lib/supabase/auth-errors";
import { SignInForm } from "./SignInForm";
import styles from "./sign-in.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Open a private QueueProof workspace for your sources, investigations, and ChatGPT connection.",
  robots: { index: false, follow: false },
};

type SignInPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    mode?: string | string[];
    next?: string | string[];
  }>;
};

function safeNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const client = await createQueueProofServerClient();
  const claims = client ? await client.auth.getClaims() : null;
  if (claims?.data?.claims?.sub) redirect("/");

  const params = await searchParams;
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const creating = mode === "signup";
  const config = supabaseConfig();
  const configured = supabaseWebEnabled() && Boolean(config);
  const initialError = queueProofAuthErrorMessage(params.error);
  const nextPath = safeNext(params.next);
  const socialProviders =
    configured && config ? await enabledSupabaseSocialProviders(config) : [];

  return (
    <main className={styles.page} id="main-content">
      <div className={styles.shell}>
        <section className={styles.story} aria-labelledby="sign-in-story-title">
          <EmberBackdrop placement="detail" state="idle" />
          <div className={styles.storyContent}>
            <Link
              className={styles.brand}
              href="/"
              aria-label="QueueProof home"
            >
              <QueueProofLogo />
            </Link>
            <div className={styles.storyCopy}>
              <span className={styles.kicker}>PRIVATE EVIDENCE WORKSPACE</span>
              <h1 id="sign-in-story-title">
                Your work,
                <br />
                with the proof attached.
              </h1>
              <p>
                Bring messages, tickets, code, email, and documents into one
                workspace that cites every supported answer.
              </p>
            </div>
            <ul
              className={styles.proofList}
              aria-label="QueueProof account benefits"
            >
              <li>
                <Check size={15} /> Your sources stay in your workspace
              </li>
              <li>
                <Check size={15} /> Missing evidence stays visible
              </li>
              <li>
                <Check size={15} /> Import existing HydraDB connectors in one
                step
              </li>
            </ul>
          </div>
        </section>

        <section className={styles.authPanel} aria-labelledby="sign-in-title">
          <Link className={styles.back} href="/">
            <ArrowLeft size={15} /> Continue in the public demo
          </Link>
          <div className={styles.authCard}>
            <span className={styles.symbol} aria-hidden="true">
              <QueueProofSymbol />
            </span>
            <span className={styles.eyebrow}>
              {creating ? "CREATE YOUR WORKSPACE" : "WELCOME BACK"}
            </span>
            <h2 id="sign-in-title">
              {creating ? "Start your QueueProof." : "Sign in to QueueProof."}
            </h2>
            <p>
              {creating
                ? "Create one private workspace, then connect only the sources you choose."
                : "Return to your private sources, investigations, approvals, and connected AI clients."}
            </p>

            {configured && config ? (
              <SignInForm
                creating={creating}
                initialError={initialError}
                nextPath={nextPath}
                socialProviders={socialProviders}
                supabase={{
                  url: config.url,
                  publishableKey: config.publishableKey,
                }}
              />
            ) : (
              <div className={styles.unavailable} role="status">
                <ShieldCheck size={17} />
                Account sign-in is temporarily unavailable. The public demo
                remains open.
              </div>
            )}

            <div className={styles.switchMode}>
              <span>
                {creating ? "Already have an account?" : "New to QueueProof?"}
              </span>
              <Link href={creating ? "/sign-in" : "/sign-in?mode=signup"}>
                {creating ? "Sign in" : "Create an account"}
              </Link>
            </div>

            <div className={styles.trustNote}>
              <ShieldCheck size={17} />
              <div>
                <strong>Identity first, sources second</strong>
                <span>
                  Signing in only proves who you are. Sources and provider
                  permissions are connected separately inside your private
                  workspace.
                </span>
              </div>
            </div>
          </div>
          <nav className={styles.helpLinks} aria-label="Account help">
            <Link href="/method">How QueueProof works</Link>
            <Link href="/developer">Use with ChatGPT</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/support">Support</Link>
          </nav>
        </section>
      </div>
    </main>
  );
}
