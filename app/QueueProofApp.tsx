"use client";

import {
  ArrowRight, Bot, Braces, Check, ChevronRight, CircleAlert, CircleCheck,
  Clipboard, Command, Database, ExternalLink, Eye, FileCheck2, FileText, KeyRound,
  Link2, LoaderCircle, LockKeyhole, MessageSquareText, Plus, RefreshCw,
  Search, ShieldCheck, Sparkles, Terminal, Unplug, UploadCloud, X, Zap,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { WorkspaceView } from "../lib/server/workspace-state";


type CredentialField = {
  name: string; required?: boolean; title?: string; description?: string;
  type?: string; format?: string; enum?: string[];
};

type Provider = {
  id: string; name: string; available: boolean; maturity: string | null;
  category: string | null; supportClass: string; credentialFields: CredentialField[];
  indexedObjectTypes: unknown[]; setupGuide?: unknown; authTypes?: unknown[];
};

type Connector = {
  id: string; hydradbConnectorId: string; provider: string; name: string;
  state: string; database: string; collection: string | null;
  verificationStage?: string | null; canaryResultCount?: number | null;
  verifiedAt?: string | null; lastSuccessfulSyncAt?: string | null; lastError?: string | null;
};

type Resource = { id: string; name: string; resourceType: string; selected?: number; status?: string };
type Evidence = {
  sourceId?: string; id?: string; provider: string; externalId?: string | null;
  title: string; excerpt: string; timestamp?: string | null;
  ingestionTimestamp?: string | null; url?: string | null; authority?: string;
};
type ComponentDelta = { component: string; delta: number; label: string };
type WhyAboveNext = {
  leaderId: string; runnerUpId: string; scoreDelta: number;
  components: ComponentDelta[]; summary: string;
};
type Packet = {
  packet_id: string; created_at: string; policy_version: string;
  task: { title: string; objective: string; owner: string | null; project: string | null;
    deadline: string | null; priority_score: number; confidence: number };
  why_now: string[]; constraints: string[]; dependencies: string[];
  acceptance_criteria: string[]; evidence: Evidence[]; contradictions: unknown[];
  missing_information: string[]; recommended_agent: string;
  // Persisted with the packet at generation time, so the value shown here is the same
  // one the API and MCP return — parity is read, not recomputed.
  receipt_hash?: string;
  why_above_next?: WhyAboveNext | null;
  permissions: { read: string[]; write: string[]; approval_required: boolean };
};
type QueueItem = {
  rank: number; finalScore: number; confidence: number; componentScores: Record<string, number>;
  penalties: Record<string, number>; taskId: string; title: string; recommendedAction: string;
  owner: string | null; project: string | null; customer: string | null; deadline: string | null;
  status: string; packetId: string; packet: Packet;
};
type QueueData = { generatedAt: string | null; items: QueueItem[] };
type AskData = {
  answer: string; evidence: Array<Evidence & { connectorId: string }>;
  trace: { runId: string; category: string; mode: string; latencyMs: number; calls: Array<Record<string, unknown>> };
};
type McpToken = {
  id: string; clientId: string; clientType: string; scopes: string[]; expiresAt: string;
  revokedAt: string | null; createdAt: string; lastHandshakeAt: string | null; lastToolCallAt: string | null;
};
type DocumentRecord = {
  id: string; filename: string; mime: string; byteSize: number; contentHash: string;
  hydradbSourceId: string | null; stage: string; error: string | null; createdAt: string;
};
type ActionProposal = {
  id: string; provider: string; actionType: string; payloadJson: string;
  evidenceIdsJson: string; riskClass: string; status: string; createdAt: string;
  decision: string | null; decidedAt: string | null; executionStatus: string | null;
  providerResponseId: string | null;
};
type IssuePayload = { title?: string; description?: string; teamId?: string; projectId?: string };
type ActiveTab = "command" | "ask" | "sources" | "lab" | "approvals" | "agent";

/** The only view in which the main application shell renders. */
type ReadyView = Extract<WorkspaceView, { kind: "ready" }>;

const nav = [
  { id: "command", label: "Command", icon: Command },
  { id: "ask", label: "Ask", icon: MessageSquareText },
  { id: "sources", label: "Sources", icon: Link2 },
  { id: "lab", label: "Lab", icon: Braces },
  { id: "approvals", label: "Approvals", icon: ShieldCheck },
  { id: "agent", label: "Agents", icon: Bot },
] as const;

const stateCopy: Record<string, string> = {
  connector_created: "Choose scope", resources_discovered: "Choose scope",
  resources_selected: "Ready to sync", initial_sync_requested: "Indexing",
  sync_in_progress: "Indexing", data_verified: "Verified", degraded: "Needs proof",
  authentication_expired: "Auth expired", permission_insufficient: "Permission issue",
  rate_limited: "Rate limited", failed: "Failed",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const jsonBody = typeof init?.body === "string";
  const response = await fetch(url, {
    ...init,
    headers: { ...(jsonBody ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await response.text();
  let data: (T & { error?: string }) | null = null;
  try { data = text ? JSON.parse(text) as T & { error?: string } : null; } catch { /* handled below */ }
  if (!response.ok) throw new Error(data?.error ?? text ?? `Request failed (${response.status}).`);
  if (!data) throw new Error("QueueProof returned an empty response.");
  return data;
}

function dateLabel(value?: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : value;
}

function providerGlyph(provider: string) {
  return provider.slice(0, 2).toUpperCase();
}

function band(score: number) {
  return score >= 80 ? "Critical" : score >= 60 ? "High" : score >= 35 ? "Normal" : "Low";
}

export default function QueueProofApp({
  initialView,
  initialError,
}: {
  initialView: WorkspaceView | null;
  initialError: string | null;
}) {
  const [tab, setTab] = useState<ActiveTab>("command");
  // Seeded from the server render, so the first paint is already the correct screen.
  // There is no boot state: the HTML that arrives is the answer.
  const [view, setView] = useState<WorkspaceView | null>(initialView);
  const [bootError, setBootError] = useState(initialError ?? "");
  const [retrying, setRetrying] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [queue, setQueue] = useState<QueueData>({ generatedAt: null, items: [] });
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [proposalPacket, setProposalPacket] = useState<Packet | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const workspaceId = view?.kind === "ready" ? view.workspace.id : null;

  const loadConnectors = useCallback(async () => {
    if (!workspaceId) return;
    const data = await api<{ connectors: Connector[] }>("/api/connectors");
    setConnectors(data.connectors);
  }, [workspaceId]);

  const reloadWorkspace = useCallback(async () => {
    const payload = await api<{ view: WorkspaceView }>("/api/workspace");
    setView(payload.view);
    setBootError("");
    return payload.view;
  }, []);

  const retryBoot = useCallback(async () => {
    setRetrying(true);
    try {
      await reloadWorkspace();
    } catch (reason) {
      setBootError(reason instanceof Error ? reason.message : "QueueProof is still unreachable.");
    } finally {
      setRetrying(false);
    }
  }, [reloadWorkspace]);

  useEffect(() => {
    if (!workspaceId) return;
    let active = true;
    void Promise.all([
      api<{ connectors: Connector[] }>("/api/connectors"),
      api<QueueData>("/api/queue"),
    ]).then(([connectorData, queueData]) => {
      if (!active) return;
      setConnectors(connectorData.connectors);
      setQueue(queueData);
    }).catch((reason: Error) => {
      if (active) setError(reason.message);
    });
    return () => { active = false; };
  }, [workspaceId]);

  const verified = connectors.filter((connector) => connector.state === "data_verified");

  async function generateQueue() {
    setBusy("queue"); setError(""); setNotice("");
    try {
      const data = await api<QueueData>("/api/queue", { method: "POST" });
      setQueue(data);
      setSelectedPacket(data.items[0]?.packet ?? null);
      setNotice(`Built ${data.items.length} cited execution packet${data.items.length === 1 ? "" : "s"} from live evidence.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Queue generation failed."); }
    finally { setBusy(""); }
  }

  // Every branch below is a named, reachable state. There is no "still deciding" screen:
  // if the server could not determine the state, that is an error with a retry, not a
  // spinner that waits forever.
  if (bootError || !view) {
    return (
      <BootError
        message={bootError || "QueueProof could not determine the workspace state."}
        busy={retrying}
        onRetry={retryBoot}
      />
    );
  }
  if (view.kind === "storage_unconfigured") return <StorageNotConfigured detail={view.detail} />;
  if (view.kind === "sign_in_required") {
    return <SignIn signInConfigured={view.signInConfigured} onSignedIn={reloadWorkspace} />;
  }
  if (view.kind === "no_workspace") return <WorkspaceSetup onDone={reloadWorkspace} />;

  const { actor } = view;

  return (
    <div className="qp-app">
      <div className="grain" />
      <header className="app-header">
        <button className="brand" onClick={() => setTab("command")} aria-label="QueueProof home">
          <span className="brand-mark"><ShieldCheck size={17} /></span>
          <span><strong>QUEUE</strong><em>PROOF</em></span>
        </button>
        <nav aria-label="Primary navigation">
          {nav.map(({ id, label, icon: Icon }) => (
            <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
              <Icon size={14} />{label}
            </button>
          ))}
        </nav>
        <div className="header-status">
          <span className={verified.length ? "status-orb live" : "status-orb"} />
          <span>{verified.length ? `${verified.length} source${verified.length === 1 ? "" : "s"} live` : "Setup required"}</span>
          <span className="avatar" title={actor.displayName}>
            {actor.displayName.slice(0, 2).toUpperCase()}
          </span>
        </div>
      </header>

      {view.storageBackend === "ephemeral" && (
        <div className="storage-banner" role="status">
          <CircleAlert size={14} />
          <span>
            <strong>Ephemeral storage.</strong> This deployment stores data on the serverless
            instance only. It is lost on cold start. Set <code>TURSO_DATABASE_URL</code> and{" "}
            <code>TURSO_AUTH_TOKEN</code> for durable storage.
          </span>
        </div>
      )}

      {(error || notice) && (
        <div className={`toast ${error ? "error" : "success"}`} role="status">
          {error ? <CircleAlert size={16} /> : <CircleCheck size={16} />}
          <span>{error || notice}</span>
          <button onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      <main>
        {tab === "command" && (
          <CommandScreen queue={queue} verified={verified} busy={busy === "queue"}
            onGenerate={generateQueue} onOpenSources={() => setTab("sources")}
            onSelectPacket={setSelectedPacket} />
        )}
        {tab === "ask" && <AskScreen verifiedCount={verified.length} onOpenSources={() => setTab("sources")} setError={setError} />}
        {tab === "sources" && <SourcesScreen workspace={view} connectors={connectors}
          reloadWorkspace={reloadWorkspace} reloadConnectors={loadConnectors}
          setError={setError} setNotice={setNotice} />}
        {tab === "lab" && <LabScreen setError={setError} />}
        {tab === "approvals" && <ApprovalsScreen key={proposalPacket?.packet_id ?? "approvals"}
          seedPacket={proposalPacket} onSeedUsed={() => setProposalPacket(null)}
          setError={setError} setNotice={setNotice} />}
        {tab === "agent" && <AgentScreen workspace={view} setError={setError} setNotice={setNotice} />}
      </main>
      {selectedPacket && <PacketDrawer packet={selectedPacket} onClose={() => setSelectedPacket(null)}
        onPropose={() => { setProposalPacket(selectedPacket); setSelectedPacket(null); setTab("approvals"); }} />}
    </div>
  );
}

/**
 * Shown when the server could not determine the workspace state.
 *
 * This replaces the former BootScreen, an indefinite "Establishing workspace trust
 * boundary…" spinner that was also what the server rendered into the HTML, so any client
 * that could not complete a round trip stayed on it forever. A state that cannot resolve
 * is an error, and an error needs a cause and a retry.
 */
function BootError({
  message,
  busy,
  onRetry,
}: {
  message: string;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="onboarding-screen">
      <div className="onboarding-card">
        <span className="step-code">ERROR</span>
        <CircleAlert size={30} />
        <h1>QueueProof could not start.</h1>
        <p>{message}</p>
        <p className="muted">
          This is usually a missing database binding or an unreachable deployment. The
          diagnostics endpoint reports which dependency is at fault.
        </p>
        <button className="primary-button" onClick={onRetry} disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} Retry
        </button>
        <a className="muted-link" href="/api/health/dependencies">
          View diagnostics <ExternalLink size={13} />
        </a>
      </div>
    </div>
  );
}

/**
 * Sign-in for a hosted deployment. Exchanges the deployment access token for the
 * HMAC-signed httpOnly session cookie issued by /api/session. The token is never stored
 * client-side and never placed in the URL.
 */
function SignIn({
  signInConfigured,
  onSignedIn,
}: {
  signInConfigured: boolean;
  onSignedIn: () => Promise<unknown>;
}) {
  const [accessToken, setAccessToken] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/session", {
        method: "POST",
        body: JSON.stringify({ accessToken, email: email || undefined }),
      });
      setAccessToken("");
      await onSignedIn();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!signInConfigured) {
    return (
      <div className="onboarding-screen">
        <div className="onboarding-card">
          <span className="step-code">SETUP / 01</span>
          <KeyRound size={30} />
          <h1>Sign-in is not configured.</h1>
          <p>
            This deployment has durable storage but no way for a person to authenticate, so
            no workspace can be reached.
          </p>
          <ul className="setup-list">
            <li><code>QUEUEPROOF_ACCESS_TOKEN</code> — 16+ characters, then redeploy</li>
          </ul>
          <a className="primary-button" href="/api/health/dependencies">
            View diagnostics <ArrowRight size={15} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="onboarding-screen">
      <div className="onboarding-art">
        <Image src="/queueproof-sentinel.webp" alt="QueueProof sentinel" fill priority />
      </div>
      <form className="onboarding-card" onSubmit={submit}>
        <span className="step-code">SIGN IN</span>
        <LockKeyhole size={30} />
        <h1>Open your control plane.</h1>
        <p>
          Enter this deployment&rsquo;s access token. QueueProof issues a signed, expiring
          session cookie; the token itself is never stored in your browser.
        </p>
        <label>
          Access token
          <input
            type="password"
            value={accessToken}
            onChange={(event) => setAccessToken(event.target.value)}
            autoComplete="current-password"
            required
            minLength={16}
            autoFocus
          />
        </label>
        <label>
          Email <span className="muted">(optional, labels the session)</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
          />
        </label>
        {error && <div className="inline-error"><CircleAlert size={14} />{error}</div>}
        <button className="primary-button" disabled={busy || accessToken.length < 16}>
          {busy ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />} Sign in
        </button>
      </form>
    </div>
  );
}

/**
 * Shown when the deployment has no durable storage bound.
 *
 * This previously rendered marketing copy ("This public edge is the launch surface")
 * whose only action linked to a separate host that returns 401 — so the public URL
 * looked like a finished product but was a dead end. It now states the actual
 * configuration gap and the exact variables that close it.
 */
function StorageNotConfigured({ detail }: { detail?: string }) {
  return (
    <div className="onboarding-screen">
      <div className="onboarding-art">
        <Image src="/queueproof-sentinel.webp" alt="QueueProof sentinel" fill priority />
      </div>
      <div className="onboarding-card">
        <span className="step-code">SETUP / 00</span>
        <Database size={30} />
        <h1>Durable storage is not configured.</h1>
        <p>
          QueueProof stores workspaces, encrypted source credentials, ranked queues, decision
          receipts, and the audit trail in a database. This deployment does not have one bound
          yet, so no workspace can be created and nothing is being faked in the meantime.
        </p>
        {detail && <p className="muted">{detail}</p>}
        <p>Set these on the deployment, then redeploy:</p>
        <ul className="setup-list">
          <li><code>TURSO_DATABASE_URL</code> and <code>TURSO_AUTH_TOKEN</code> — hosted libSQL</li>
          <li><code>QUEUEPROOF_ENCRYPTION_KEY</code> — 32 random bytes, base64</li>
          <li><code>QUEUEPROOF_ACCESS_TOKEN</code> — 16+ characters, used to sign in</li>
        </ul>
        <p className="muted">
          Running locally instead? Set <code>QUEUEPROOF_SQLITE_PATH</code> and the full stack
          works with no accounts.
        </p>
        <a className="primary-button" href="/api/health/dependencies">
          View storage diagnostics <ArrowRight size={15} />
        </a>
      </div>
    </div>
  );
}

function WorkspaceSetup({ onDone }: { onDone: () => Promise<WorkspaceView> }) {
  const [name, setName] = useState("My QueueProof");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api("/api/workspace", { method: "POST", body: JSON.stringify({ name }) }); await onDone(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not create workspace."); }
    finally { setBusy(false); }
  }
  return (
    <div className="onboarding-screen">
      <div className="onboarding-art"><Image src="/queueproof-sentinel.webp" alt="QueueProof sentinel" fill priority /></div>
      <form className="onboarding-card" onSubmit={submit}>
        <span className="step-code">INITIALIZE / 01</span><ShieldCheck size={30} />
        <h1>Create your control plane.</h1>
        <p>One workspace holds your encrypted source connections, deterministic queue, audit history, and agent access.</p>
        <label>Workspace name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} autoFocus /></label>
        {error && <div className="inline-error"><CircleAlert size={14} />{error}</div>}
        <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />} Create workspace</button>
      </form>
    </div>
  );
}

function CommandScreen({ queue, verified, busy, onGenerate, onOpenSources, onSelectPacket }: {
  queue: QueueData; verified: Connector[]; busy: boolean; onGenerate: () => void;
  onOpenSources: () => void; onSelectPacket: (packet: Packet) => void;
}) {
  const first = queue.items[0];
  return (
    <section className="screen command-screen">
      <div className="screen-heading command-heading">
        <div><span className="eyebrow"><Sparkles size={13} /> Evidence-ranked command queue</span>
          <h1>What deserves<br /><em>attention now.</em></h1>
          <p>QueueProof retrieves only verified workplace evidence, screens unsafe instructions, applies a deterministic policy, and emits one cited packet per action.</p>
        </div>
        <div className="heading-actions">
          <span className="source-proof"><span className={verified.length ? "status-orb live" : "status-orb"} />{verified.length} verified</span>
          <button className="primary-button" onClick={verified.length ? onGenerate : onOpenSources} disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={15} /> : verified.length ? <RefreshCw size={15} /> : <Plus size={15} />}
            {verified.length ? (queue.items.length ? "Refresh from evidence" : "Build live queue") : "Connect a source"}
          </button>
        </div>
      </div>

      {!queue.items.length ? (
        <div className="empty-command">
          <div className="radar"><Search size={28} /><i /><i /><i /></div>
          <div><span className="eyebrow">No fabricated priorities</span>
            <h2>{verified.length ? "Your sources are ready to reason over." : "Connect evidence before asking what matters."}</h2>
            <p>{verified.length ? "Build the first queue from commitments, blockers, deadlines, incidents, and customer risk found in verified source records." : "QueueProof refuses to invent a task list. Connect Slack, Gmail, Linear, or another HydraDB provider first."}</p>
          </div>
        </div>
      ) : (
        <div className="command-grid">
          <button className="hero-packet" onClick={() => onSelectPacket(first.packet)}>
            <span className="packet-serial">NEXT / {first.packetId.slice(-8).toUpperCase()}</span>
            <span className={`priority-band band-${band(first.finalScore).toLowerCase()}`}>{band(first.finalScore)}</span>
            <strong className="hero-score">{first.finalScore}<small>/100</small></strong>
            <h2>{first.title}</h2>
            <p>{first.packet.task.objective}</p>
            <div className="packet-facts"><span><small>OWNER</small>{first.owner || "Needs assignment"}</span><span><small>DEADLINE</small>{dateLabel(first.deadline)}</span><span><small>CONFIDENCE</small>{Math.round(first.packet.task.confidence * 100)}%</span></div>
            <span className="open-proof">Open complete proof packet <ArrowRight size={14} /></span>
          </button>
          <div className="queue-list">
            <div className="list-title"><span><Command size={14} /> Ranked actions</span><small>{dateLabel(queue.generatedAt)}</small></div>
            {queue.items.map((item) => (
              <button key={item.packetId} className={item.packetId === first.packetId ? "queue-item active" : "queue-item"} onClick={() => onSelectPacket(item.packet)}>
                <span className="rank-number">{String(item.rank).padStart(2, "0")}</span>
                <span className="queue-copy"><strong>{item.title}</strong><small>{item.packet.evidence[0]?.provider ?? "source"} · {item.owner || "owner missing"}</small></span>
                <span className="queue-value">{item.finalScore}</span><ChevronRight size={14} />
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="method-strip"><span><ShieldCheck size={14} /> Verified sources only</span><span><Braces size={14} /> Deterministic policy {first?.packet.policy_version ?? "1.0"}</span><span><FileCheck2 size={14} /> Web/API/MCP packet parity</span></div>
    </section>
  );
}

function AskScreen({ verifiedCount, onOpenSources, setError }: { verifiedCount: number; onOpenSources: () => void; setError: (value: string) => void }) {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState<"fast" | "thinking">("thinking");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskData | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!verifiedCount) { onOpenSources(); return; }
    setBusy(true); setError("");
    try { setResult(await api<AskData>("/api/ask", { method: "POST", body: JSON.stringify({ question, mode }) })); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Evidence retrieval failed."); }
    finally { setBusy(false); }
  }
  return (
    <section className="screen ask-screen">
      <div className="screen-heading"><div><span className="eyebrow"><Search size={13} /> Cross-source evidence retrieval</span><h1>Ask the work,<br /><em>not another chatbot.</em></h1><p>QueueProof fans one question across every verified source boundary and returns excerpts, links, timestamps, and the full retrieval trace. No supporting record means no invented answer.</p></div></div>
      <form className="ask-console" onSubmit={submit}>
        <div className="console-line"><span><span className={verifiedCount ? "status-orb live" : "status-orb"} />{verifiedCount} verified source{verifiedCount === 1 ? "" : "s"}</span><div><button type="button" className={mode === "fast" ? "mode active" : "mode"} onClick={() => setMode("fast")}>Fast</button><button type="button" className={mode === "thinking" ? "mode active" : "mode"} onClick={() => setMode("thinking")}>Thinking</button></div></div>
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What commitments are blocked, who owns them, and what evidence supports that?" required maxLength={4000} />
        <button className="primary-button" disabled={busy || !question.trim()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Search size={15} />}{busy ? "Searching verified evidence" : "Retrieve evidence"}</button>
      </form>
      {result && <div className="ask-results">
        <div className="answer-banner"><ShieldCheck size={18} /><div><span className="eyebrow">Grounding contract</span><p>{result.answer}</p></div></div>
        <div className="evidence-grid">{result.evidence.map((item, index) => <EvidenceCard key={`${item.provider}-${item.id ?? index}`} evidence={item} index={index} />)}</div>
        <details className="trace-drawer"><summary><Terminal size={14} /> Retrieval trace <span>{result.trace.runId}</span></summary><pre>{JSON.stringify(result.trace, null, 2)}</pre></details>
      </div>}
    </section>
  );
}

function EvidenceCard({ evidence, index }: { evidence: Evidence; index: number }) {
  return <article className="evidence-card"><div className="evidence-top"><span className="provider-glyph">{providerGlyph(evidence.provider)}</span><span>{evidence.provider}</span><small>#{String(index + 1).padStart(2, "0")}</small></div><h3>{evidence.title}</h3><blockquote>{evidence.excerpt}</blockquote><div className="evidence-footer"><span>{dateLabel(evidence.timestamp)}</span>{evidence.url && <a href={evidence.url} target="_blank" rel="noreferrer">Open source <ExternalLink size={12} /></a>}</div></article>;
}

function SourcesScreen({ workspace, connectors, reloadWorkspace, reloadConnectors, setError, setNotice }: {
  workspace: ReadyView; connectors: Connector[]; reloadWorkspace: () => Promise<WorkspaceView>;
  reloadConnectors: () => Promise<void>; setError: (value: string) => void; setNotice: (value: string) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [proof, setProof] = useState<Record<string, unknown> | null>(null);

  async function connectHydra(event: FormEvent) {
    event.preventDefault(); setBusy("hydra"); setError("");
    try { await api("/api/hydradb/configure", { method: "POST", body: JSON.stringify({ apiKey }) }); setApiKey(""); await reloadWorkspace(); setNotice("HydraDB authenticated. Provider and database discovery are now live."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "HydraDB setup failed."); }
    finally { setBusy(""); }
  }

  async function connectorAction(connector: Connector) {
    setBusy(connector.id); setError(""); setProof(null);
    try {
      if (connector.state === "connector_created" || connector.state === "resources_discovered") {
        const data = await api<{ resources: Resource[] }>(`/api/connectors/${connector.id}/discover`, { method: "POST" });
        setProof({ connector, resources: data.resources });
      } else if (connector.state === "resources_selected") {
        await api(`/api/connectors/${connector.id}/sync`, { method: "POST" });
        setNotice("Sync requested. Check proof after HydraDB has indexed the selected resources.");
      } else if (connector.state === "data_verified") {
        setProof(await api<Record<string, unknown>>(`/api/connectors/${connector.id}/proof`));
      } else {
        const data = await api<{ verification: Record<string, unknown> }>(`/api/connectors/${connector.id}/verify`, { method: "POST" });
        setProof({ connector, verification: data.verification });
        setNotice("Connection proof passed: cursor evidence and real provider records were retrieved.");
      }
      await reloadConnectors();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Connector operation failed."); await reloadConnectors(); }
    finally { setBusy(""); }
  }

  return <section className="screen sources-screen">
    <div className="screen-heading"><div><span className="eyebrow"><Database size={13} /> Live evidence boundary</span><h1>Connect once.<br /><em>Prove every read.</em></h1><p>Credentials are encrypted server-side. A source becomes usable only after QueueProof sees cursor evidence and retrieves real provider records.</p></div>{workspace.hydradb.configured && <button className="primary-button" onClick={() => setSetupOpen(true)}><Plus size={15} /> Add source</button>}</div>
    {!workspace.hydradb.configured ? <form className="hydra-setup" onSubmit={connectHydra}><div className="hydra-symbol"><Database size={29} /></div><div><span className="eyebrow">Step 1 · Evidence engine</span><h2>Attach your HydraDB account.</h2><p>Use a newly generated API key. QueueProof verifies it against the authenticated database endpoint, encrypts it with AES-GCM, and never returns it.</p><label>HydraDB API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste new key" autoComplete="off" required minLength={12} /></label><button className="primary-button" disabled={busy === "hydra"}>{busy === "hydra" ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />} Verify and encrypt</button></div></form> : <>
      <div className="source-stats"><div><small>HYDRADB</small><strong><CircleCheck size={14} /> Authenticated</strong><span>{workspace.hydradb.fingerprint ?? "Encrypted"}</span></div><div><small>CONNECTED</small><strong>{connectors.length}</strong><span>workplace sources</span></div><div><small>VERIFIED</small><strong>{connectors.filter((item) => item.state === "data_verified").length}</strong><span>eligible for retrieval</span></div><div><small>POLICY</small><strong>Fail closed</strong><span>no proof · no ranking</span></div></div>
      {connectors.length ? <div className="connector-list">{connectors.map((connector) => <article className="connector-row" key={connector.id}><span className="provider-glyph large">{providerGlyph(connector.provider)}</span><div className="connector-identity"><strong>{connector.name}</strong><span>{connector.provider} · {connector.database}{connector.collection ? ` / ${connector.collection}` : ""}</span></div><div className="connector-state"><span className={connector.state === "data_verified" ? "status-orb live" : connector.state.includes("sync") ? "status-orb indexing" : "status-orb"} /><strong>{stateCopy[connector.state] ?? connector.state}</strong><small>{connector.state === "data_verified" ? `${connector.canaryResultCount ?? 0} live records proven` : connector.lastError || "Awaiting next lifecycle step"}</small></div><button className="secondary-button" onClick={() => void connectorAction(connector)} disabled={busy === connector.id}>{busy === connector.id ? <LoaderCircle className="spin" size={14} /> : connector.state === "data_verified" ? <Eye size={14} /> : connector.state === "connector_created" || connector.state === "resources_discovered" ? <Search size={14} /> : <RefreshCw size={14} />}{connector.state === "data_verified" ? "View proof" : connector.state === "connector_created" || connector.state === "resources_discovered" ? "Choose scope" : connector.state === "resources_selected" ? "Start sync" : "Check proof"}</button></article>)}</div> : <div className="empty-source"><Unplug size={28} /><div><h2>No workplace source yet.</h2><p>Add Slack, Gmail, Linear, or any provider exposed by your live HydraDB catalogue.</p></div><button className="primary-button" onClick={() => setSetupOpen(true)}><Plus size={15} /> Add first source</button></div>}
      <DocumentsPanel databases={[...new Set(connectors.map((item) => item.database).filter(Boolean))]}
        setError={setError} setNotice={setNotice} />
    </>}
    {setupOpen && <SourceSetup onClose={() => setSetupOpen(false)} onDone={async () => { setSetupOpen(false); await reloadConnectors(); setNotice("Connector created. Choose the exact resources QueueProof may index."); }} setError={setError} />}
    {proof && <ProofModal data={proof} onClose={() => setProof(null)} onConfigured={async () => { setProof(null); await reloadConnectors(); setNotice("Scope saved and initial backfill started. Check proof when indexing completes."); }} setError={setError} />}
  </section>;
}

function prettyBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsPanel({ databases, setError, setNotice }: {
  databases: string[]; setError: (value: string) => void; setNotice: (value: string) => void;
}) {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [database, setDatabase] = useState(databases[0] ?? "");
  const [busy, setBusy] = useState("");
  const [inputKey, setInputKey] = useState(0);
  async function load() {
    const data = await api<{ documents: DocumentRecord[] }>("/api/documents");
    setDocuments(data.documents);
  }

  useEffect(() => {
    let active = true;
    void api<{ documents: DocumentRecord[] }>("/api/documents")
      .then((data) => { if (active) setDocuments(data.documents); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [setError]);

  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    setBusy("upload"); setError("");
    const form = new FormData();
    form.append("file", file);
    if (database) form.append("database", database);
    try {
      const data = await api<{ message?: string; duplicate?: boolean }>("/api/documents", { method: "POST", body: form });
      await load();
      setFile(null); setInputKey((value) => value + 1);
      setNotice(data.message ?? (data.duplicate ? "This document was already indexed." : "Document accepted for indexing."));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Document ingestion failed."); }
    finally { setBusy(""); }
  }

  async function poll(document: DocumentRecord) {
    setBusy(document.id); setError("");
    try {
      const data = await api<{ document: DocumentRecord; terminal?: boolean; indexingStatus?: string | null }>(`/api/documents/${document.id}/status`);
      await load();
      setNotice(data.terminal ? `${document.filename} is ${data.document.stage}.` : `${document.filename}: ${data.indexingStatus ?? data.document.stage}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Indexing check failed."); }
    finally { setBusy(""); }
  }

  return <section className="document-panel">
    <div className="section-kicker"><span><FileText size={14} /> Document evidence</span><small>PDF · Markdown · text · 25 MB max</small></div>
    <div className="document-grid">
      <form className="upload-card" onSubmit={upload} onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); setFile(event.dataTransfer.files[0] ?? null); }}>
        <UploadCloud size={30} />
        <h2>Drop knowledge into the evidence graph.</h2>
        <p>QueueProof validates the real file signature, deduplicates by SHA-256, then waits for HydraDB to confirm indexing.</p>
        <label className="file-picker">
          <input key={inputKey} type="file" accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <span>{file ? file.name : "Choose a document"}</span>
          <small>{file ? prettyBytes(file.size) : "or drag it here"}</small>
        </label>
        {databases.length > 0 && <label className="database-choice">Evidence database<select value={database} onChange={(event) => setDatabase(event.target.value)}>{databases.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}
        <button className="primary-button" disabled={!file || busy === "upload"}>{busy === "upload" ? <LoaderCircle className="spin" size={14} /> : <UploadCloud size={14} />}{busy === "upload" ? "Validating and sending" : "Ingest document"}</button>
      </form>
      <div className="document-list">
        <div className="list-title"><span><ShieldCheck size={14} /> Ingestion ledger</span><button onClick={() => void load()}><RefreshCw size={12} /> Refresh</button></div>
        {documents.length ? documents.map((document) => <article className="document-row" key={document.id}>
          <span className={`document-stage ${document.stage}`}><FileText size={15} /></span>
          <div><strong>{document.filename}</strong><small>{prettyBytes(document.byteSize)} · {document.mime} · {dateLabel(document.createdAt)}</small><code>{document.contentHash.slice(0, 18)}…</code>{document.error && <em>{document.error}</em>}</div>
          <span className={`stage-chip ${document.stage}`}>{document.stage}</span>
          {(document.stage === "processing" || document.stage === "validated" || document.stage === "uploading") && <button className="secondary-button" onClick={() => void poll(document)} disabled={busy === document.id}>{busy === document.id ? <LoaderCircle className="spin" size={13} /> : <RefreshCw size={13} />} Check</button>}
        </article>) : <div className="honest-empty"><FileText size={24} /><div><strong>No document evidence yet.</strong><p>The ledger will show validation, hashing, processing, and the real terminal indexing state.</p></div></div>}
      </div>
    </div>
  </section>;
}

function SourceSetup({ onClose, onDone, setError }: { onClose: () => void; onDone: () => Promise<void>; setError: (value: string) => void }) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [providerId, setProviderId] = useState("");
  const [database, setDatabase] = useState("");
  const [collection, setCollection] = useState("");
  const [accountScope, setAccountScope] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [newDatabase, setNewDatabase] = useState("");
  const [busy, setBusy] = useState(true);
  const selected = providers.find((item) => item.id === providerId);
  useEffect(() => {
    void Promise.all([api<{ providers: Provider[] }>("/api/providers"), api<{ databases: string[] }>("/api/databases")])
      .then(([providerData, databaseData]) => { setProviders(providerData.providers); setDatabases(databaseData.databases); setProviderId(providerData.providers[0]?.id ?? ""); setDatabase(databaseData.databases[0] ?? ""); })
      .catch((reason: Error) => setError(reason.message)).finally(() => setBusy(false));
  }, [setError]);
  async function createDatabase() {
    if (!newDatabase.trim()) return; setBusy(true);
    try { const data = await api<{ database: string }>("/api/databases", { method: "POST", body: JSON.stringify({ database: newDatabase }) }); setDatabases((current) => [...new Set([...current, data.database])]); setDatabase(data.database); setNewDatabase(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Database creation failed."); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!selected) return; setBusy(true); setError("");
    try { await api("/api/connectors", { method: "POST", body: JSON.stringify({ provider: selected.id, name: selected.name, database, collection: collection || undefined, accountScope: accountScope || undefined, credentials }) }); await onDone(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Connector creation failed."); }
    finally { setBusy(false); }
  }
  return <div className="modal-layer"><form className="modal-card source-modal" onSubmit={submit}><button type="button" className="modal-close" onClick={onClose}><X size={16} /></button><span className="eyebrow"><Plus size={13} /> New evidence source</span><h2>Connect from the live catalogue.</h2><p>QueueProof renders this form from HydraDB’s current provider contract. It never guesses provider credentials.</p>{busy && !providers.length ? <div className="modal-loading"><LoaderCircle className="spin" /> Hydrating provider contracts…</div> : <div className="setup-form"><label>Provider<select value={providerId} onChange={(event) => { setProviderId(event.target.value); setCredentials({}); }} required>{providers.filter((item) => item.available).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.supportClass}</option>)}</select></label><div className="two-cols"><label>HydraDB database<select value={database} onChange={(event) => setDatabase(event.target.value)} required><option value="" disabled>Select database</option>{databases.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Collection <small>optional isolation</small><input value={collection} onChange={(event) => setCollection(event.target.value)} placeholder="team-work" /></label></div>{!databases.length && <div className="database-create"><input value={newDatabase} onChange={(event) => setNewDatabase(event.target.value)} placeholder="Create database name" /><button type="button" className="secondary-button" onClick={() => void createDatabase()}>Create</button></div>}<label>Provider account scope <small>recommended for multi-account safety</small><input value={accountScope} onChange={(event) => setAccountScope(event.target.value)} placeholder="workspace / org / account identifier" /></label><div className="credential-grid">{selected?.credentialFields.map((field) => <label key={field.name}>{field.title || field.name}{field.required && <b> required</b>}{field.enum?.length ? <select value={credentials[field.name] ?? ""} onChange={(event) => setCredentials((current) => ({ ...current, [field.name]: event.target.value }))} required={field.required}><option value="">Select</option>{field.enum.map((value) => <option key={value} value={value}>{value}</option>)}</select> : <input type={field.format === "password" || /token|secret|password|key/i.test(field.name) ? "password" : "text"} value={credentials[field.name] ?? ""} onChange={(event) => setCredentials((current) => ({ ...current, [field.name]: event.target.value }))} required={field.required} autoComplete="off" />}{field.description && <small>{field.description}</small>}</label>)}</div>{selected && !selected.credentialFields.length && <div className="inline-warning"><CircleAlert size={14} />This provider contract exposes no credential fields. QueueProof will submit no credentials only if HydraDB marks that valid.</div>}<button className="primary-button" disabled={busy || !database || !selected}>{busy ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />} Create connector</button></div>}</form></div>;
}

function ProofModal({ data, onClose, onConfigured, setError }: { data: Record<string, unknown>; onClose: () => void; onConfigured: () => Promise<void>; setError: (value: string) => void }) {
  const connector = data.connector as Connector | undefined;
  const resources = (data.resources ?? []) as Resource[];
  const verification = data.verification as Record<string, unknown> | undefined;
  const [selected, setSelected] = useState<string[]>(resources.filter((item) => item.selected).map((item) => item.id));
  const [busy, setBusy] = useState(false);
  async function configure() {
    if (!connector || !selected.length) return; setBusy(true);
    try { await api(`/api/connectors/${connector.id}/configure`, { method: "POST", body: JSON.stringify({ resourceIds: selected, lookbackDays: 30 }) }); await onConfigured(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Scope configuration failed."); }
    finally { setBusy(false); }
  }
  return <div className="modal-layer"><div className="modal-card proof-modal"><button className="modal-close" onClick={onClose}><X size={16} /></button><span className="eyebrow"><ShieldCheck size={13} /> Connection proof</span><h2>{connector?.name ?? "Verified source"}</h2>{verification ? <><div className="proof-seal"><CircleCheck size={28} /><div><strong>{String(verification.stage ?? "Proof available")}</strong><span>{String(verification.canaryResultCount ?? 0)} real provider records · {dateLabel(String(verification.verifiedAt ?? ""))}</span></div></div><div className="proof-grid"><div><small>CURSOR EVIDENCE</small><code>{String(verification.cursorEvidenceHash ?? "Not available").slice(0, 24)}</code></div><div><small>PROVIDER COVERAGE</small><strong>{Array.isArray(verification.providerCoverage) ? verification.providerCoverage.join(", ") : "Not available"}</strong></div><div><small>LAST SYNC</small><strong>{dateLabel(String(verification.lastSuccessfulSync ?? ""))}</strong></div><div><small>FAILURE</small><strong>{String(verification.failureReason ?? "None")}</strong></div></div><details className="trace-drawer"><summary><Terminal size={14} /> Raw proof record</summary><pre>{JSON.stringify(verification, null, 2)}</pre></details></> : <><p>Select the smallest resource scope QueueProof may index. Configure starts HydraDB’s initial backfill automatically.</p><div className="resource-picker">{resources.map((resource) => <label key={resource.id}><input type="checkbox" checked={selected.includes(resource.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, resource.id] : current.filter((id) => id !== resource.id))} /><span><strong>{resource.name}</strong><small>{resource.resourceType} · {resource.id}</small></span><Check size={14} /></label>)}</div><button className="primary-button" disabled={!selected.length || busy} onClick={() => void configure()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Zap size={15} />} Save scope and start sync</button></>}</div></div>;
}

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function ApprovalsScreen({ seedPacket, onSeedUsed, setError, setNotice }: {
  seedPacket: Packet | null; onSeedUsed: () => void;
  setError: (value: string) => void; setNotice: (value: string) => void;
}) {
  const seedEvidence = seedPacket?.evidence
    .map((item) => item.sourceId ?? item.id ?? item.externalId)
    .filter((item): item is string => Boolean(item)) ?? [];
  const [proposals, setProposals] = useState<ActionProposal[]>([]);
  const [selected, setSelected] = useState<ActionProposal | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [composerOpen, setComposerOpen] = useState(Boolean(seedPacket));
  const [summary, setSummary] = useState(seedPacket?.task.objective || seedPacket?.task.title || "");
  const [owner, setOwner] = useState(seedPacket?.task.owner ?? "");
  const [deadline, setDeadline] = useState(seedPacket?.task.deadline ?? "");
  const [evidenceIds, setEvidenceIds] = useState(seedEvidence.join("\n"));
  const [teamId, setTeamId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState("");
  async function load() {
    const data = await api<{ proposals: ActionProposal[] }>("/api/actions");
    setProposals(data.proposals);
  }

  useEffect(() => {
    let active = true;
    void api<{ proposals: ActionProposal[] }>("/api/actions")
      .then((data) => { if (active) setProposals(data.proposals); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [setError]);

  async function createProposal(event: FormEvent) {
    event.preventDefault(); setBusy("create"); setError("");
    const ids = evidenceIds.split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
    try {
      const data = await api<{ replayed?: boolean; proposalId: string }>("/api/actions", {
        method: "POST",
        body: JSON.stringify({
          commitment: {
            id: seedPacket?.packet_id,
            summary, owner: owner || null, deadline: deadline || null,
            customer: null, evidenceIds: ids,
            sourceProvider: [...new Set(seedPacket?.evidence.map((item) => item.provider) ?? ["queueproof"])].join(", "),
          },
          teamId, projectId: projectId || undefined,
        }),
      });
      await load(); setComposerOpen(false); onSeedUsed();
      setNotice(data.replayed ? "The identical proposal already exists; QueueProof reused it." : "Proposal sealed. A human must review the exact payload before execution.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Proposal creation failed."); }
    finally { setBusy(""); }
  }

  async function approve() {
    if (!selected || !confirmed) return;
    setBusy(selected.id); setError("");
    try {
      const data = await api<{ executed?: boolean; message?: string }>(`/api/actions/${selected.id}/approve`, { method: "POST" });
      await load(); setSelected(null); setConfirmed(false);
      setNotice(data.message ?? (data.executed ? "Linear confirmed the issue creation." : "Human approval recorded."));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Approval failed."); }
    finally { setBusy(""); }
  }

  const pending = proposals.filter((item) => !item.decision && item.status === "proposed").length;
  const executed = proposals.filter((item) => item.executionStatus === "succeeded" || item.status === "executed").length;

  return <section className="screen approvals-screen">
    <div className="screen-heading"><div><span className="eyebrow"><ShieldCheck size={13} /> Human control plane</span><h1>Agents propose.<br /><em>Humans commit.</em></h1><p>Review the exact provider payload, its evidence chain, and risk class. Approval is an auditable decision; execution is idempotent and can happen at most once.</p></div><button className="primary-button" onClick={() => setComposerOpen(true)}><Plus size={15} /> New proposal</button></div>
    <div className="approval-stats"><div><small>PENDING REVIEW</small><strong>{pending}</strong><span>nothing executes silently</span></div><div><small>EXECUTED ONCE</small><strong>{executed}</strong><span>provider-confirmed writes</span></div><div><small>GUARDRAIL</small><strong>At most once</strong><span>unique execution claim</span></div></div>
    <div className="approval-list">
      <div className="list-title"><span><LockKeyhole size={14} /> Action ledger</span><button onClick={() => void load()}><RefreshCw size={12} /> Refresh</button></div>
      {proposals.length ? proposals.map((proposal) => {
        const payload = parseJson<IssuePayload>(proposal.payloadJson, {});
        const evidence = parseJson<string[]>(proposal.evidenceIdsJson, []);
        const complete = proposal.executionStatus === "succeeded" || proposal.status === "executed";
        return <article className="approval-row" key={proposal.id}>
          <span className={`risk-mark ${proposal.riskClass}`}><ShieldCheck size={17} /></span>
          <div className="approval-copy"><span><b>{proposal.provider}</b> · {proposal.actionType.replaceAll("_", " ")} · {dateLabel(proposal.createdAt)}</span><strong>{payload.title ?? "Untitled provider action"}</strong><small>{evidence.length} evidence receipt{evidence.length === 1 ? "" : "s"} · risk {proposal.riskClass}</small></div>
          <span className={`stage-chip ${complete ? "indexed" : proposal.decision ? "validated" : "processing"}`}>{complete ? "executed" : proposal.decision ?? "review"}</span>
          <button className="secondary-button" onClick={() => { setSelected(proposal); setConfirmed(false); }}>{complete ? <Eye size={13} /> : <ShieldCheck size={13} />}{complete ? "Inspect" : proposal.decision ? "Approved" : "Review"}</button>
        </article>;
      }) : <div className="honest-empty"><ShieldCheck size={24} /><div><strong>No provider write is waiting.</strong><p>Open an execution packet and send it here, or create a grounded proposal manually.</p></div></div>}
    </div>

    {composerOpen && <div className="modal-layer"><form className="modal-card action-composer" onSubmit={createProposal}><button type="button" className="modal-close" onClick={() => { setComposerOpen(false); onSeedUsed(); }}><X size={16} /></button><span className="eyebrow"><Plus size={13} /> Approval-gated Linear issue</span><h2>Seal the proposed payload.</h2><p>This step records a proposal only. It cannot write to Linear until a human separately reviews and approves the exact result.</p><div className="setup-form"><label>Commitment summary<textarea value={summary} onChange={(event) => setSummary(event.target.value)} required maxLength={4000} /></label><div className="two-cols"><label>Owner <small>optional</small><input value={owner} onChange={(event) => setOwner(event.target.value)} /></label><label>Deadline <small>optional</small><input value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label></div><label>Evidence receipt IDs<textarea value={evidenceIds} onChange={(event) => setEvidenceIds(event.target.value)} placeholder="One source ID per line" required /></label><div className="two-cols"><label>Linear team ID<input value={teamId} onChange={(event) => setTeamId(event.target.value)} placeholder="Required provider team UUID" required /></label><label>Linear project ID <small>optional</small><input value={projectId} onChange={(event) => setProjectId(event.target.value)} /></label></div><button className="primary-button" disabled={busy === "create" || !summary.trim() || !evidenceIds.trim() || !teamId.trim()}>{busy === "create" ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />} Create reviewable proposal</button></div></form></div>}

    {selected && <ApprovalModal proposal={selected} confirmed={confirmed} setConfirmed={setConfirmed}
      busy={busy === selected.id} onApprove={approve} onClose={() => { setSelected(null); setConfirmed(false); }} />}
  </section>;
}

function ApprovalModal({ proposal, confirmed, setConfirmed, busy, onApprove, onClose }: {
  proposal: ActionProposal; confirmed: boolean; setConfirmed: (value: boolean) => void;
  busy: boolean; onApprove: () => Promise<void>; onClose: () => void;
}) {
  const payload = parseJson<IssuePayload>(proposal.payloadJson, {});
  const evidence = parseJson<string[]>(proposal.evidenceIdsJson, []);
  const complete = proposal.executionStatus === "succeeded" || proposal.status === "executed";
  const decided = Boolean(proposal.decision);
  return <div className="modal-layer"><div className="modal-card approval-modal"><button className="modal-close" onClick={onClose}><X size={16} /></button><span className="eyebrow"><ShieldCheck size={13} /> Exact provider payload</span><h2>{complete ? "Execution receipt." : decided ? "Approval recorded." : "Review before commit."}</h2><div className="risk-banner"><span className={`risk-mark ${proposal.riskClass}`}><CircleAlert size={16} /></span><div><strong>{proposal.riskClass} risk · Linear create issue</strong><small>Proposal {proposal.id}</small></div></div><div className="payload-grid"><div><small>TITLE</small><strong>{payload.title ?? "Missing title"}</strong></div><div><small>TEAM</small><code>{payload.teamId ?? "Missing team"}</code></div>{payload.projectId && <div><small>PROJECT</small><code>{payload.projectId}</code></div>}<div className="payload-description"><small>DESCRIPTION</small><pre>{payload.description ?? "Missing description"}</pre></div></div><div className="evidence-receipts"><small>EVIDENCE RECEIPTS · {evidence.length}</small>{evidence.map((id) => <code key={id}>{id}</code>)}</div>{complete ? <div className="proof-seal"><CircleCheck size={25} /><div><strong>Provider-confirmed execution</strong><span>Linear response ID {proposal.providerResponseId ?? "recorded"} · duplicate execution is blocked</span></div></div> : decided ? <div className="proof-seal"><CircleCheck size={25} /><div><strong>Human approval recorded</strong><span>{dateLabel(proposal.decidedAt)} · execution unavailable or pending</span></div></div> : <><label className="approval-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><strong>I reviewed this exact payload and its evidence.</strong><small>I understand QueueProof will attempt one Linear issue creation if the deployment has execution credentials.</small></span></label><button className="primary-button full" disabled={!confirmed || busy} onClick={() => void onApprove()}>{busy ? <LoaderCircle className="spin" size={14} /> : <Zap size={14} />}{busy ? "Claiming execution slot" : "Approve and execute once"}</button></>}</div></div>;
}

function AgentScreen({ workspace, setError, setNotice }: { workspace: ReadyView; setError: (value: string) => void; setNotice: (value: string) => void }) {
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [clientType, setClientType] = useState("codex");
  const [writeScopes, setWriteScopes] = useState(false);
  const [freshToken, setFreshToken] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = typeof window === "undefined" ? "/mcp" : `${window.location.origin}/mcp`;
  const load = useCallback(() => api<{ tokens: McpToken[] }>("/api/mcp-tokens").then((data) => setTokens(data.tokens)), []);
  useEffect(() => { void load().catch((reason: Error) => setError(reason.message)); }, [load, setError]);
  async function createToken() {
    setBusy(true); setFreshToken("");
    try { const data = await api<{ token: string }>("/api/mcp-tokens", { method: "POST", body: JSON.stringify({ clientType, scopes: writeScopes ? ["queueproof:read", "queueproof:propose", "queueproof:sync"] : ["queueproof:read"], expiresInDays: 30 }) }); setFreshToken(data.token); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Token creation failed."); }
    finally { setBusy(false); }
  }
  async function revoke(tokenId: string) {
    try { await api("/api/mcp-tokens", { method: "DELETE", body: JSON.stringify({ tokenId }) }); await load(); setNotice("Agent token revoked immediately."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Token revocation failed."); }
  }
  const config = useMemo(() => ({ mcpServers: { queueproof: { url: endpoint, headers: { Authorization: "Bearer ${QUEUEPROOF_MCP_TOKEN}" } } } }), [endpoint]);
  return <section className="screen agent-screen"><div className="screen-heading"><div><span className="eyebrow"><Bot size={13} /> Agent dock · MCP</span><h1>Give agents the plan.<br /><em>Keep humans in control.</em></h1><p>Generate a scoped token, connect any modern MCP client, and retrieve the exact execution packet shown in Command. Provider writes remain proposals unless a human approves them.</p></div></div><div className="agent-grid"><div className="token-console"><div className="console-line"><span><Terminal size={14} /> New agent connection</span><span className="secure-chip"><LockKeyhole size={12} /> hashed at rest</span></div><label>Client<select value={clientType} onChange={(event) => setClientType(event.target.value)}><option value="codex">Codex</option><option value="claude">Claude Code</option><option value="kimi">Kimi Code</option><option value="kilo">Kilo Code</option><option value="generic">Generic MCP client</option></select></label><label className="scope-choice"><input type="checkbox" checked={writeScopes} onChange={(event) => setWriteScopes(event.target.checked)} /><span><strong>Allow proposal + sync tools</strong><small>Still cannot execute a provider write without QueueProof approval.</small></span></label><button className="primary-button" onClick={() => void createToken()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />} Generate 30-day token</button>{freshToken && <div className="token-reveal"><span><CircleAlert size={13} /> Copy once — it cannot be shown again</span><code>{freshToken}</code><button onClick={() => void navigator.clipboard.writeText(freshToken)}><Clipboard size={13} /> Copy token</button></div>}</div><div className="config-card"><div className="list-title"><span><Braces size={14} /> Project configuration</span><button onClick={() => void navigator.clipboard.writeText(JSON.stringify(config, null, 2))}><Clipboard size={13} /> Copy</button></div><pre>{JSON.stringify(config, null, 2)}</pre><div className="endpoint-row"><small>REMOTE MCP ENDPOINT</small><code>{endpoint}</code></div></div></div><div className="token-list"><div className="list-title"><span><ShieldCheck size={14} /> Issued credentials</span><small>{workspace.workspace?.name}</small></div>{tokens.length ? tokens.map((token) => <div className="token-row" key={token.id}><span className={token.revokedAt ? "status-orb" : token.lastHandshakeAt ? "status-orb live" : "status-orb indexing"} /><div><strong>{token.clientType}</strong><small>{token.scopes.join(" · ")} · expires {dateLabel(token.expiresAt)}</small></div><span>{token.revokedAt ? "Revoked" : token.lastHandshakeAt ? `Connected ${dateLabel(token.lastHandshakeAt)}` : "Awaiting handshake"}</span>{!token.revokedAt && <button onClick={() => void revoke(token.id)}>Revoke</button>}</div>) : <div className="honest-empty"><Bot size={24} /><div><strong>No agent credential exists.</strong><p>Create one only when you are ready to connect a client.</p></div></div>}</div></section>;
}

type LabResults = {
  generatedAt?: string;
  fixture?: {
    label?: string;
    caseCount?: number;
    metrics?: {
      totalCases?: number;
      router?: { correct: number; total: number; accuracy: number };
      perCategory?: Record<string, { total: number; correct: number; accuracy: number }>;
    };
    notMeasured?: string[];
    caveat?: string;
  };
  live?: { status?: string; note?: string };
};

/**
 * Evaluation Lab.
 *
 * Shows what was actually measured and, just as prominently, what was not. The fixture
 * suite can only score the deterministic layer; citation quality, latency, call counts
 * and cost need connected sources, so they are listed as unmeasured rather than shown as
 * zero — a zero in a metrics panel reads as a result.
 */
function LabScreen({ setError }: { setError: (value: string) => void }) {
  const [data, setData] = useState<LabResults | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void api<{ results: LabResults }>("/api/lab")
      .then((payload) => { if (active) setData(payload.results); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setError]);

  const router = data?.fixture?.metrics?.router;
  const perCategory = Object.entries(data?.fixture?.metrics?.perCategory ?? {});
  const notMeasured = (data?.fixture?.notMeasured ?? []).filter((entry) => entry && entry.trim());

  return (
    <section className="screen">
      <div className="screen-heading">
        <div>
          <span className="eyebrow"><Braces size={13} /> Evaluation</span>
          <h1>Measured, not<br /><em>asserted.</em></h1>
          <p>
            Every case below is scored by running the real retrieval router and the real
            ranking policy. Metrics that require connected sources are named as unmeasured
            rather than shown as zero.
          </p>
        </div>
      </div>

      {loading && <p className="muted">Loading evaluation results…</p>}

      {router && (
        <div className="lab-summary">
          <div className="lab-metric">
            <strong>{(router.accuracy * 100).toFixed(1)}%</strong>
            <span>Router mode accuracy<br />{router.correct} of {router.total} cases</span>
          </div>
          <div className="lab-metric">
            <strong>{data?.fixture?.metrics?.totalCases ?? perCategory.length}</strong>
            <span>Ground-truth cases<br />across {perCategory.length} categories</span>
          </div>
          <div className="lab-metric">
            <strong>{data?.live?.status === "not_requested" ? "Offline" : String(data?.live?.status ?? "—")}</strong>
            <span>Live suite<br />requires connected sources</span>
          </div>
        </div>
      )}

      {perCategory.length > 0 && (
        <div className="lab-table-wrap">
          <table className="lab-table">
            <thead>
              <tr><th>Category</th><th>Correct</th><th>Total</th><th>Accuracy</th></tr>
            </thead>
            <tbody>
              {perCategory.map(([name, entry]) => (
                <tr key={name} className={entry.accuracy === 1 ? "pass" : entry.accuracy === 0 ? "fail" : ""}>
                  <td>{name}</td>
                  <td>{entry.correct}</td>
                  <td>{entry.total}</td>
                  <td>{(entry.accuracy * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {notMeasured.length > 0 && (
        <div className="packet-section">
          <h3>Not measured<span>{notMeasured.length}</span></h3>
          <ul>{notMeasured.map((entry) => <li key={entry}>{entry}</li>)}</ul>
        </div>
      )}

      {data?.fixture?.caveat && <p className="muted">{data.fixture.caveat}</p>}
      {data?.live?.note && <p className="muted">{data.live.note}</p>}
      {data?.generatedAt && <p className="muted">Generated {dateLabel(data.generatedAt)} by <code>scripts/run-evals.mjs</code>.</p>}
    </section>
  );
}

function PacketDrawer({ packet, onClose, onPropose }: { packet: Packet; onClose: () => void; onPropose: () => void }) {
  return <div className="drawer-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="packet-drawer"><button className="modal-close" onClick={onClose}><X size={16} /></button><div className="drawer-head"><span className="eyebrow"><FileCheck2 size={13} /> Execution packet</span><code>{packet.packet_id}</code><h2>{packet.task.title}</h2><p>{packet.task.objective}</p></div><div className="drawer-score"><strong>{packet.task.priority_score}</strong><span>{band(packet.task.priority_score)} priority<br />{Math.round(packet.task.confidence * 100)}% confidence</span></div><PacketSection title="Why now" items={packet.why_now} /><div className="packet-columns"><PacketSection title="Constraints" items={packet.constraints} empty="None evidenced" /><PacketSection title="Dependencies" items={packet.dependencies} empty="None evidenced" /></div><PacketSection title="Acceptance criteria" items={packet.acceptance_criteria} /><div className="packet-section"><h3>Evidence receipts <span>{packet.evidence.length}</span></h3>{packet.evidence.map((item, index) => <EvidenceCard key={item.sourceId ?? index} evidence={item} index={index} />)}</div><WhyAboveSection why={packet.why_above_next} /><PacketSection title="Missing information" items={packet.missing_information} empty="No missing fields" /><ReceiptHashBlock hash={packet.receipt_hash} /><div className="permission-block"><LockKeyhole size={16} /><div><strong>Agent permissions</strong><span>Read: {packet.permissions.read.join(", ") || "none"} · Write: {packet.permissions.write.join(", ") || "none"} · Approval {packet.permissions.approval_required ? "required" : "not required"}</span></div></div><div className="drawer-actions"><button className="primary-button" onClick={onPropose}><ShieldCheck size={14} /> Send to approval</button><button className="secondary-button" onClick={() => void navigator.clipboard.writeText(JSON.stringify(packet, null, 2))}><Clipboard size={14} /> Copy canonical JSON</button></div></aside></div>;
}

/**
 * Why this item outranks the next one, rendered from stored score deltas.
 *
 * These numbers are arithmetic on the deterministic policy, not model prose, and they
 * sum to the score gap — so the explanation accounts for the difference rather than
 * gesturing at it. The last item in a queue has no runner-up and says so.
 */
function WhyAboveSection({ why }: { why?: WhyAboveNext | null }) {
  if (!why) {
    return (
      <div className="packet-section">
        <h3>Why above #2</h3>
        <p>This is the last item in the queue, so there is no lower-ranked alternative to compare against.</p>
      </div>
    );
  }
  return (
    <div className="packet-section why-above">
      <h3>Why above #2<span>{why.scoreDelta > 0 ? `+${why.scoreDelta}` : why.scoreDelta}</span></h3>
      <p>{why.summary}</p>
      {why.components.length > 0 && (
        <ul className="delta-list">
          {why.components.map((entry) => (
            <li key={entry.component} className={entry.delta > 0 ? "gain" : "loss"}>
              <code>{entry.delta > 0 ? `+${entry.delta}` : entry.delta}</code>
              <span>{entry.label.replace(/^[+-][\d.]+\s/, "")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * The receipt hash. Stated precisely: it proves this receipt's content is identical
 * wherever it is read, not that the provider data behind it is unchanged.
 */
function ReceiptHashBlock({ hash }: { hash?: string }) {
  if (!hash) return null;
  return (
    <div className="receipt-hash">
      <ShieldCheck size={15} />
      <div>
        <strong>Receipt hash</strong>
        <code>{hash}</code>
        <span>Identical in the web app, the API and MCP. It does not attest to the provider data itself.</span>
      </div>
    </div>
  );
}

function PacketSection({ title, items, empty = "None" }: { title: string; items: string[]; empty?: string }) {
  return <div className="packet-section"><h3>{title}<span>{items.length}</span></h3>{items.length ? <ul>{items.map((item, index) => <li key={`${title}-${index}`}>{item}</li>)}</ul> : <p>{empty}</p>}</div>;
}
