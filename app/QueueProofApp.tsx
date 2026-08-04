"use client";

import {
  Activity, ArrowRight, Bot, Braces, Check, ChevronRight, CircleAlert, CircleCheck, Clock3,
  Clipboard, Command, Database, Download, ExternalLink, Eye, FileCheck2, FileText, KeyRound,
  Link2, LoaderCircle, LockKeyhole, MoreHorizontal, Network, Play, Plus,
  Pause, Radio, RefreshCw, RotateCcw, Search, ShieldCheck, Sparkles, StepForward, Terminal,
  Unplug, UploadCloud, X as LucideX, Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SiGithub, SiGmail, SiLinear, SiSlack } from "react-icons/si";
import { ComponentProps, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WorkspaceView } from "../lib/server/workspace-state";
import type { EvidenceGraph as EvidenceGraphData } from "../packages/graph/src";
import type { LiveProofState } from "../packages/contracts/src";
import EvidenceGraphView from "./components/EvidenceGraph";

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
  score_breakdown?: Record<string, number>;
  penalties?: Record<string, number>;
  active_formula?: string;
  recommended_safe_action?: string;
  provider_coverage?: string[];
  deduplicated_tasks?: string[];
  status?: string;
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
  question?: string;
  workflow: LiveProofState;
  answer: string; evidence: Array<Evidence & { connectorId: string }>;
  claims: Array<{ text: string; citation_ids: string[]; providers: string[] }>;
  citations: Array<Evidence & { id: string }>;
  priority_items: Array<{
    id: string; title: string; normalized_entity: string; owner: string | null;
    due_date: string | null; status: string; score: number;
    score_breakdown: Record<string, number>; penalties: Record<string, number>;
    why_now: string[]; recommended_next_safe_action: string; evidence_ids: string[];
    disagreements: unknown[]; confidence: number; provider_coverage: string[];
    deduplicated_tasks: string[]; approval_required: boolean;
  }>;
  missing_information: string[];
  retrieval_receipt: {
    query_id: string; hydradb_mode: string; routing_reason: string;
    hydradb_call_count: number; total_latency_ms: number; provider_coverage: string[];
    receipt_count: number; metadata_filters: Record<string, unknown>;
    graph_usage: boolean; estimated_cost_units: number; timestamp: string;
  };
  routing_reason: string;
  contradictions: Array<{ summary: string; evidenceIds: string[]; providers: string[] }>;
  missingInformation: string[];
  validation: { status: "grounded" | "partial" | "abstained"; claimCount: number; citedClaimCount: number; evidenceCount: number; providerCoverage: string[] };
  trace: { runId: string; category: string; mode: string; latencyMs: number; callCount: number; connectorCount: number; calls: Array<Record<string, unknown>>; cost?: { estimatedUnits: number; estimatedUsd: number | null; basis: string } };
};
type McpToken = {
  id: string; clientId: string; clientType: string; scopes: string[]; expiresAt: string;
  revokedAt: string | null; createdAt: string; lastHandshakeAt: string | null; lastToolCallAt: string | null;
};
type DocumentRecord = {
  id: string; filename: string; mime: string; byteSize: number; contentHash: string;
  database: string | null; hydradbSourceId: string | null; pageCount: number | null;
  indexedAt: string | null; processingDurationMs: number | null;
  stage: string; error: string | null; createdAt: string;
};
type ActionProposal = {
  id: string; provider: string; actionType: string; payloadJson: string;
  evidenceIdsJson: string; riskClass: string; status: string; createdAt: string;
  decision: string | null; decidedAt: string | null; executionStatus: string | null;
  providerResponseId: string | null; executionError: string | null;
};
type IssuePayload = { title?: string; description?: string; teamId?: string; projectId?: string };
export type ActiveTab = "command" | "ask" | "sources" | "lab" | "replay" | "approvals" | "agent";

/** The only view in which the main application shell renders. */
type ReadyView = Extract<WorkspaceView, { kind: "ready" }>;

const nav = [
  { id: "ask", label: "Ask", mobileLabel: "Ask", icon: Sparkles },
  { id: "command", label: "Priorities", mobileLabel: "Priorities", icon: Command },
  { id: "sources", label: "Sources", mobileLabel: "Sources", icon: Link2 },
  { id: "lab", label: "Benchmarks", mobileLabel: "Tests", icon: Activity },
  { id: "replay", label: "History", mobileLabel: "History", icon: RotateCcw },
] as const;

const utilityNav = [
  { id: "approvals", label: "Approvals", mobileLabel: "Review", icon: ShieldCheck },
  { id: "agent", label: "Developer", mobileLabel: "Dev", icon: Bot },
] as const;

const routeForTab: Record<ActiveTab, string> = {
  ask: "/",
  command: "/queue",
  sources: "/evidence",
  lab: "/benchmarks",
  replay: "/replay",
  approvals: "/approvals",
  agent: "/developer",
};

const tabForRoute = Object.fromEntries(
  Object.entries(routeForTab).map(([tab, route]) => [route, tab]),
) as Record<string, ActiveTab>;

const allNav = [...nav, ...utilityNav] as const;
const mobileNav = nav.filter(({ id }) => ["ask", "command", "sources", "lab"].includes(id));

const stateCopy: Record<string, string> = {
  connector_created: "Choose scope", resources_discovered: "Choose scope",
  resources_selected: "Ready to sync", initial_sync_requested: "Indexing",
  sync_in_progress: "Indexing", data_verified: "Verified", degraded: "Needs proof",
  authentication_expired: "Auth expired", permission_insufficient: "Permission issue",
  rate_limited: "Rate limited", failed: "Failed",
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const jsonBody = typeof init?.body === "string";
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(30_000)])
        : AbortSignal.timeout(30_000),
      headers: { ...(jsonBody ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === "TimeoutError") {
      throw new Error("The request exceeded 30 seconds. Its outcome is unknown; refresh the relevant ledger before retrying.");
    }
    throw reason;
  }
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

function band(score: number) {
  return score >= 80 ? "Critical" : score >= 60 ? "High" : score >= 35 ? "Normal" : "Low";
}

let nextDialogId = 0;
const openDialogIds: number[] = [];

/**
 * Shared modal behavior for every product drawer/dialog.
 *
 * The stack guard makes Escape close only the top-most dialog (for example, a
 * citation opened from inside an execution packet). Outside content is inert,
 * focus is trapped while open, and the invoking control receives focus again
 * after close.
 */
function useDialogBehavior<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  returnFocusRef?: { readonly current: HTMLElement | null },
) {
  const dialogRef = useRef<T>(null);
  const closeRef = useRef(onClose);
  const [dialogId] = useState(() => ++nextDialogId);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const returnFocus = returnFocusRef?.current ?? (
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    );
    const previousOverflow = document.body.style.overflow;
    const inerted = new Map<HTMLElement, boolean>();
    openDialogIds.push(dialogId);
    document.body.style.overflow = "hidden";

    let branch: HTMLElement | null = dialog;
    while (branch?.parentElement) {
      for (const sibling of Array.from(branch.parentElement.children)) {
        if (sibling === branch || !(sibling instanceof HTMLElement)) continue;
        inerted.set(sibling, sibling.inert);
        sibling.inert = true;
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }

    const focusableSelector = [
      "button:not([disabled])", "a[href]", "input:not([disabled])", "select:not([disabled])",
      "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
    ].join(",");
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector))
      .filter((element) => !element.hidden && element.getAttribute("aria-hidden") !== "true");

    const initial = dialog.querySelector<HTMLElement>("[data-dialog-initial]") ?? focusable()[0] ?? dialog;
    // Focus once immediately and once on the next frame. Async dialogs can mount while
    // their invoking row is still re-rendering; the second pass keeps that update from
    // dropping keyboard focus back onto <body>.
    initial.focus({ preventScroll: true });
    const recoverFocus = () => {
      if (openDialogIds.at(-1) === dialogId && !dialog.contains(document.activeElement)) {
        initial.focus({ preventScroll: true });
      }
    };
    const frame = window.requestAnimationFrame(recoverFocus);
    const recoveryTimers = [250, 750].map((delay) => window.setTimeout(recoverFocus, delay));
    const onFocusIn = (event: FocusEvent) => {
      if (openDialogIds.at(-1) !== dialogId) return;
      if (event.target instanceof Node && !dialog.contains(event.target)) recoverFocus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogIds.at(-1) !== dialogId) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) { event.preventDefault(); dialog.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      window.cancelAnimationFrame(frame);
      recoveryTimers.forEach((timer) => window.clearTimeout(timer));
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      const stackIndex = openDialogIds.lastIndexOf(dialogId);
      if (stackIndex >= 0) openDialogIds.splice(stackIndex, 1);
      for (const [element, previous] of inerted) element.inert = previous;
      document.body.style.overflow = previousOverflow;
      if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
    };
  }, [dialogId, open, returnFocusRef]);

  return dialogRef;
}

export default function QueueProofApp({
  initialView,
  initialError,
  initialTab = "ask",
  publicOrigin,
}: {
  initialView: WorkspaceView | null;
  initialError: string | null;
  initialTab?: ActiveTab;
  publicOrigin: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tab = tabForRoute[pathname] ?? initialTab;
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  // Seeded from the server render, so the first paint is already the correct screen.
  // There is no boot state: the HTML that arrives is the answer.
  const [view, setView] = useState<WorkspaceView | null>(initialView);
  const [bootError, setBootError] = useState(initialError ?? "");
  const [retrying, setRetrying] = useState(false);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connectorsLoaded, setConnectorsLoaded] = useState(false);
  const [queue, setQueue] = useState<QueueData>({ generatedAt: null, items: [] });
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [proposalPacket, setProposalPacket] = useState<Packet | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const workspaceId = view?.kind === "ready" ? view.workspace.id : null;

  const navigateTab = useCallback((next: ActiveTab) => {
    const route = routeForTab[next];
    if (window.location.pathname !== route) router.push(route);
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [router]);

  useEffect(() => {
    const legacyTab = window.location.hash.slice(1) as ActiveTab;
    if (allNav.some((item) => item.id === legacyTab)) {
      router.replace(routeForTab[legacyTab]);
    }
  }, [router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault(); setCommandOpen((open) => !open); setCommandQuery("");
      }
      if (event.key === "Escape") {
        setCommandOpen(false); setSelectedPacket(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const loadConnectors = useCallback(async () => {
    if (!workspaceId) return;
    const data = await api<{ connectors: Connector[] }>("/api/connectors");
    setConnectors(data.connectors);
    setConnectorsLoaded(true);
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
      setConnectorsLoaded(true);
      setQueue(queueData);
    }).catch((reason: Error) => {
      if (active) { setConnectorsLoaded(true); setError(reason.message); }
    });
    return () => { active = false; };
  }, [workspaceId]);

  const verified = connectors.filter((connector) => connector.state === "data_verified");
  const publicSandbox = view?.kind === "ready" && view.actor.publicAccess;

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
  if (view.kind === "no_workspace") {
    return view.actor.publicAccess
      ? <PublicWorkspaceUnavailable />
      : <WorkspaceSetup onDone={reloadWorkspace} />;
  }

  return (
    <div className="qp-app" data-active-tab={tab}>
      <header className="app-header">
        <Link className="brand" href="/" aria-label="QueueProof home">
          <span className="brand-mark"><ShieldCheck size={17} /></span>
          <span className="brand-lockup"><span><strong>QUEUE</strong><em>PROOF</em></span><small>WORKSPACE</small></span>
        </Link>
        <nav aria-label="Primary navigation">
          {allNav.map(({ id, label, icon: Icon }) => (
            <Link key={id} href={routeForTab[id]} className={tab === id ? "active" : ""} aria-current={tab === id ? "page" : undefined}>
              <Icon size={14} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="header-status">
          <button className="command-trigger" onClick={() => setCommandOpen(true)} aria-label="Open command palette"><Search size={14} /><kbd>⌘K</kbd></button>
          <span className="demo-badge"><span className={verified.length ? "status-orb live" : "status-orb"} />{publicSandbox ? "Public sandbox" : "Live workspace"}</span>
        </div>
      </header>
      <nav className="mobile-dock" aria-label="Mobile navigation">
        {mobileNav.map(({ id, label, mobileLabel, icon: Icon }) => (
          <Link key={`dock-${id}`} href={routeForTab[id]} className={tab === id ? "active" : ""} aria-label={label} aria-current={tab === id ? "page" : undefined}>
            <Icon size={17} aria-hidden="true" /><span>{mobileLabel}</span>
          </Link>
        ))}
        <button type="button" aria-label="Open all product pages" onClick={() => { setCommandQuery(""); setCommandOpen(true); }}><MoreHorizontal size={18} aria-hidden="true" /><span>More</span></button>
      </nav>

      {publicSandbox && <div className="sandbox-disclosure" role="note"><ShieldCheck size={13} /><strong>Public sandbox</strong><span>Shared evidence and proposals · credentials and external execution disabled</span><Link href="/owner"><LockKeyhole size={12} /> Owner sign in</Link></div>}

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

      <main id="main-content" className="app-main" data-active-tab={tab}>
        {tab === "command" && (
          <CommandScreen queue={queue} verified={verified} busy={busy === "queue"}
            onGenerate={generateQueue} onOpenSources={() => navigateTab("sources")}
            onSelectPacket={setSelectedPacket} />
        )}
        {tab === "ask" && <AskScreen verified={verified} connectorsLoaded={connectorsLoaded} onOpenSources={() => navigateTab("sources")} onOpenLab={() => navigateTab("lab")} setError={setError} />}
        {tab === "sources" && <SourcesScreen workspace={view} connectors={connectors}
          reloadWorkspace={reloadWorkspace} reloadConnectors={loadConnectors}
          setError={setError} setNotice={setNotice} readOnly={publicSandbox} />}
        {tab === "lab" && <LabScreen setError={setError} />}
        {tab === "replay" && <ReplayScreen setError={setError} />}
        {tab === "approvals" && <ApprovalsScreen key={proposalPacket?.packet_id ?? "approvals"}
          seedPacket={proposalPacket} onSeedUsed={() => setProposalPacket(null)}
          setError={setError} setNotice={setNotice} readOnly={publicSandbox} />}
        {tab === "agent" && <AgentScreen workspace={view} setError={setError} setNotice={setNotice} readOnly={publicSandbox} publicOrigin={publicOrigin} />}
      </main>
      <footer className="app-footer">
        <span><ShieldCheck size={14} /><strong>QueueProof</strong> / evidence for every next step</span>
        <span>Verified reads <i /> cited decisions <i /> approval-gated writes</span>
        <Link href="/benchmarks">Open audit surface <ArrowRight size={12} /></Link>
      </footer>
      {selectedPacket && <PacketDrawer packet={selectedPacket} onClose={() => setSelectedPacket(null)}
        onPropose={() => { setProposalPacket(selectedPacket); setSelectedPacket(null); navigateTab("approvals"); }} />}
      {commandOpen && <CommandPalette query={commandQuery} setQuery={setCommandQuery} onClose={() => setCommandOpen(false)} onNavigate={(next) => { navigateTab(next); setCommandOpen(false); }} />}
    </div>
  );
}

function CommandPalette({ query, setQuery, onClose, onNavigate }: {
  query: string; setQuery: (value: string) => void; onClose: () => void;
  onNavigate: (tab: ActiveTab) => void;
}) {
  const entries = [...nav, ...utilityNav].filter((entry) => entry.label.toLowerCase().includes(query.toLowerCase()));
  const dialogRef = useDialogBehavior<HTMLDivElement>(true, onClose);
  return <div className="modal-layer command-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div ref={dialogRef} className="command-palette" role="dialog" aria-modal="true" aria-label="Navigate QueueProof" tabIndex={-1}><div className="command-search"><Search size={17} /><input data-dialog-initial autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Go to a product surface…" aria-label="Search product surfaces" /><kbd>ESC</kbd></div><div className="command-results">{entries.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => onNavigate(id)}><Icon size={16} /><span>{label}</span><ArrowRight size={13} /></button>)}</div></div></div>;
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

function PublicWorkspaceUnavailable() {
  return (
    <div className="onboarding-screen">
      <div className="onboarding-art"><Image src="/queueproof-sentinel.webp" alt="QueueProof sentinel" fill priority /></div>
      <div className="onboarding-card" role="alert">
        <span className="step-code">PUBLIC / FAIL CLOSED</span><LockKeyhole size={30} />
        <h1>The shared workspace is unavailable.</h1>
        <p>Public access did not resolve to one explicitly selected workspace. QueueProof will not guess a tenant or create durable state for an anonymous visitor.</p>
        <p className="muted">The deployment owner must set <code>QUEUEPROOF_PUBLIC_WORKSPACE_ID</code> to the intended shared workspace and redeploy.</p>
        <button className="primary-button" onClick={() => window.location.reload()}><RefreshCw size={14} /> Retry resolution</button>
      </div>
    </div>
  );
}

function CommandScreen({ queue, verified, busy, onGenerate, onOpenSources, onSelectPacket }: {
  queue: QueueData; verified: Connector[]; busy: boolean; onGenerate: () => void;
  onOpenSources: () => void; onSelectPacket: (packet: Packet) => void;
}) {
  const [sortBy, setSortBy] = useState<"score" | "confidence" | "deadline" | "newest">("score");
  const sortedItems = useMemo(() => [...queue.items].sort((a, b) => {
    if (sortBy === "confidence") return b.confidence - a.confidence;
    if (sortBy === "deadline") return (Date.parse(a.deadline ?? "9999-12-31") || Infinity) - (Date.parse(b.deadline ?? "9999-12-31") || Infinity);
    if (sortBy === "newest") return Date.parse(b.packet.created_at) - Date.parse(a.packet.created_at);
    return b.finalScore - a.finalScore;
  }), [queue.items, sortBy]);
  const first = sortedItems[0];
  return (
    <section className="screen command-screen">
      <div className="screen-heading command-heading">
        <div><span className="eyebrow"><Sparkles size={13} /> Evidence-ranked command queue</span>
          <h1>What deserves<br /><em>attention now.</em></h1>
          <p>QueueProof reads only verified sources, checks risky instructions, and builds one cited action card at a time.</p>
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
            <p>{verified.length ? "Build the first queue from real commitments, blockers, deadlines, incidents, and customer risk." : "QueueProof will not invent a task list. Connect Slack, Gmail, Linear, or another source first."}</p>
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
            <div className="list-title queue-toolbar"><span><Command size={14} /> Ranked actions</span><label>Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} aria-label="Sort priority queue"><option value="score">Priority score</option><option value="confidence">Confidence</option><option value="deadline">Deadline</option><option value="newest">Newest receipt</option></select></label></div>
            {sortedItems.map((item, index) => (
              <button key={item.packetId} className={item.packetId === first.packetId ? "queue-item active" : "queue-item"} onClick={() => onSelectPacket(item.packet)}>
                <span className="rank-number">{String(index + 1).padStart(2, "0")}</span>
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

const FLAGSHIP_QUESTION = "Who escalated the AuthShield outage, what did engineering commit to, and is the fix already merged?";
const proofPrompts = [
  FLAGSHIP_QUESTION,
  "Which sources disagree about the billing migration deadline?",
  "Which promise to Northwind has no issue tracking it?",
  "Which open issue appears to be already resolved elsewhere?",
];

function ProviderIcon({ provider, size = 15 }: { provider: string; size?: number }) {
  if (provider === "github") return <SiGithub size={size} aria-hidden="true" />;
  if (provider === "gmail") return <SiGmail size={size} aria-hidden="true" />;
  if (provider === "slack") return <SiSlack size={size} aria-hidden="true" />;
  if (provider === "linear") return <SiLinear size={size} aria-hidden="true" />;
  return <FileText size={size} />;
}

/** Every icon-only close control receives an accessible name, including nested modals. */
function X(props: ComponentProps<typeof LucideX>) {
  return <><LucideX {...props} aria-hidden="true" /><span className="sr-only">Close</span></>;
}

function CitedAnswer({ text, citations, onOpen }: {
  text: string;
  citations: Array<Evidence & { id: string }>;
  onOpen: (evidence: Evidence, index: number) => void;
}) {
  return <>{text.split(/(\[\d+\])/g).map((part, index) => {
    if (!/^\[\d+\]$/.test(part)) return <span key={`${part}-${index}`}>{part}</span>;
    const citationIndex = Number(part.slice(1, -1)) - 1;
    const evidence = citations[citationIndex];
    if (!evidence) return <sup className="citation-chip unavailable" key={`${part}-${index}`} aria-label={`Citation ${citationIndex + 1} unavailable`}>{citationIndex + 1}</sup>;
    return <sup key={`${part}-${index}`}><button type="button" className="citation-chip" aria-label={`Open citation ${citationIndex + 1}: ${evidence.title}`} onClick={() => onOpen(evidence, citationIndex)}>{citationIndex + 1}</button></sup>;
  })}</>;
}

function AskScreen({ verified, connectorsLoaded, onOpenSources, onOpenLab, setError }: {
  verified: Connector[]; connectorsLoaded: boolean; onOpenSources: () => void; onOpenLab: () => void; setError: (value: string) => void;
}) {
  const [question, setQuestion] = useState(FLAGSHIP_QUESTION);
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [mode, setMode] = useState<"auto" | "fast" | "thinking">("auto");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskData | null>(null);
  const [citationPreview, setCitationPreview] = useState<{ evidence: Evidence; index: number } | null>(null);
  const [judgePulse, setJudgePulse] = useState<{
    status: string;
    passed: number;
    total: number;
    p50: number | null;
    calls: number | null;
    citationPrecision: number | null;
    citationCompleteness: number | null;
    unsupportedClaimRate: number | null;
  } | null>(null);
  const runPending = useRef(false);
  const requestController = useRef<AbortController | null>(null);
  const restoredReceipt = useRef("");
  const stageRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const verifiedCount = verified.length;
  // The synchronous API deliberately exposes no pseudo-live intermediate UI.
  // Its returned workflow contains the exact persisted backend events.
  useEffect(() => () => requestController.current?.abort(), []);

  useEffect(() => {
    const runId = new URLSearchParams(window.location.search).get("run");
    if (!runId || restoredReceipt.current === runId || result || busy) return;
    restoredReceipt.current = runId;
    let active = true;
    void api<{ result: AskData }>(`/api/ask/${encodeURIComponent(runId)}`)
      .then(({ result: storedResult }) => {
        if (!active) return;
        setResult(storedResult);
        setSubmittedQuestion(storedResult.question ?? "Saved investigation");
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message);
      });
    return () => { active = false; };
  }, [busy, result, setError]);

  useEffect(() => {
    const target = busy ? stageRef.current : result ? resultRef.current : null;
    if (!target) return;
    const frame = window.requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [busy, result]);

  useEffect(() => {
    let active = true;
    void api<{ results: LabResults }>("/api/lab").then(({ results }) => {
      if (!active) return;
      const rows = results.live?.rows ?? [];
      const measured = rows.filter((row) => typeof row.pass === "boolean");
      const calls = rows.some((row) => typeof row.callCount === "number")
        ? rows.reduce((total, row) => total + (row.callCount ?? 0), 0) / Math.max(rows.length, 1)
        : null;
      setJudgePulse({
        status: results.live?.status ?? "unavailable",
        passed: measured.filter((row) => row.pass).length,
        total: measured.length,
        p50: results.live?.latencyMs?.p50 ?? null,
        calls,
        citationPrecision: results.live?.quality?.citationPrecision ?? null,
        citationCompleteness: results.live?.quality?.citationCompleteness ?? null,
        unsupportedClaimRate: results.live?.quality?.unsupportedClaimRate ?? null,
      });
    }).catch(() => { /* The proof workflow remains usable if telemetry is unavailable. */ });
    return () => { active = false; };
  }, []);

  async function run(nextQuestion = question) {
    if (runPending.current) return;
    if (!connectorsLoaded) return;
    if (!verifiedCount) { onOpenSources(); return; }
    runPending.current = true;
    const controller = new AbortController();
    requestController.current = controller;
    setSubmittedQuestion(nextQuestion);
    setBusy(true); setError(""); setCitationPreview(null);
    setResult(null);
    try {
      const data = await api<AskData>("/api/ask", {
        method: "POST",
        body: JSON.stringify({ question: nextQuestion, mode }),
        signal: controller.signal,
      });
      setResult(data);
      const receiptUrl = new URL(window.location.href);
      receiptUrl.pathname = "/";
      receiptUrl.hash = "";
      receiptUrl.searchParams.set("run", data.retrieval_receipt.query_id);
      window.history.replaceState({ queueproofRun: data.retrieval_receipt.query_id }, "", receiptUrl);
    } catch (reason) {
      setError(reason instanceof DOMException && reason.name === "AbortError"
        ? "You stopped waiting for this investigation. The server may still finish its audit record; check Replay before running it again."
        : reason instanceof Error ? reason.message : "Evidence retrieval failed.");
    } finally {
      if (requestController.current === controller) requestController.current = null;
      runPending.current = false;
      setBusy(false);
    }
  }
  function cancelRun() {
    requestController.current?.abort();
  }
  async function submit(event: FormEvent) { event.preventDefault(); await run(); }

  const directlyCitedEvidence = result?.citations ?? [];
  const rankedEvidence = directlyCitedEvidence.length > 0 ? directlyCitedEvidence : result?.evidence.slice(0, 6) ?? [];
  const rankedEvidenceIds = new Set(rankedEvidence.map((item) => item.id ?? item.sourceId));
  const supportingEvidence = result?.evidence.filter((item) => !rankedEvidenceIds.has(item.id ?? item.sourceId)) ?? [];
  const missingInformation = [...new Set([...(result?.missing_information ?? []), ...(result?.missingInformation ?? [])])];
  const resultTone = result?.validation.status === "abstained" ? "abstained" : result?.validation.status === "partial" || missingInformation.length ? "partial" : "grounded";
  const judgeMeasured = judgePulse?.status === "measured";
  const contradictionEvidenceIds = new Set(result?.contradictions.flatMap((item) => item.evidenceIds) ?? []);
  const timelineEvidence = [...(result?.evidence ?? [])]
    .sort((left, right) => {
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    })
    .slice(0, 10);

  return (
    <section className="screen ask-screen proof-screen">
      <header className="ask-intro">
        <div>
          <span className="eyebrow"><ShieldCheck size={13} /> Evidence-backed workspace</span>
          <h1>What needs attention?</h1>
          <p>Ask across your work. QueueProof returns one grounded answer, the receipts behind it, any disagreement, and the next safe action.</p>
        </div>
        <div className="source-readiness" aria-label="Source readiness">
          <span className={verifiedCount ? "status-orb live" : connectorsLoaded ? "status-orb" : "status-orb indexing"} />
          <strong>{connectorsLoaded ? `${verifiedCount} source${verifiedCount === 1 ? "" : "s"} verified` : "Checking sources"}</strong>
          <button type="button" onClick={onOpenSources}>{verifiedCount ? "View sources" : "Connect sources"}<ArrowRight size={12} /></button>
        </div>
      </header>
      <div className="proof-hero">
        <div className="proof-copy">
          <span className="eyebrow"><Radio size={13} /> Live · HydraDB evidence control plane</span>
          <h1><span>One answer.</span><br /><em>Every system.</em><br /><span className="outline-word">Proven.</span></h1>
          <div className="proof-details">
            <p>Ask one question across Slack, Linear, GitHub, Gmail, and documents. QueueProof shows the answer, the exact sources, what disagrees, and the safest next step.</p>
            <div className="live-source-row">
              {verified.map((connector) => <span key={connector.id} data-provider={connector.provider}><ProviderIcon provider={connector.provider} />{connector.provider}<i /></span>)}
              {!connectorsLoaded && <span className="connector-loading"><LoaderCircle className="spin" size={13} /> Resolving source proofs</span>}
              {connectorsLoaded && !verified.length && <button onClick={onOpenSources}><Plus size={13} /> Connect evidence</button>}
            </div>
            <div className="hero-proofline" aria-label="Current source proof and recorded live benchmark">
              <span><strong>{verifiedCount}</strong><small>LIVE SYSTEMS PROVEN</small></span>
              <span><strong>{judgeMeasured && judgePulse?.citationPrecision !== null && judgePulse?.citationPrecision !== undefined ? `${Math.round(judgePulse.citationPrecision * 100)}%` : "—"}</strong><small>RECORDED CITATION PRECISION</small></span>
              <span><strong>{judgeMeasured && judgePulse?.unsupportedClaimRate !== null && judgePulse?.unsupportedClaimRate !== undefined ? `${Math.round(judgePulse.unsupportedClaimRate * 100)}%` : "—"}</strong><small>RECORDED UNSUPPORTED RATE</small></span>
            </div>
            <div className="proof-manifest" aria-label="QueueProof evidence workflow">
              <span><b>01</b> Verify sources</span><i />
              <span><b>02</b> Match the facts</span><i />
              <span><b>03</b> Cite every claim</span><i />
              <span><b>04</b> Approve the action</span>
            </div>
            <div className="proof-cta-row">
              <button type="button" className="primary-button proof-hero-cta" onClick={() => document.getElementById("proof-question")?.focus()}><Play size={14} fill="currentColor" /> Prove it live <ArrowRight size={13} /></button>
              <button type="button" className="secondary-button" onClick={onOpenLab}>See measured results</button>
            </div>
          </div>
        </div>
      </div>
      <form className="ask-console premium-console" onSubmit={submit}>
        <div className="console-line">
          <span><span className={verifiedCount ? "status-orb live" : connectorsLoaded ? "status-orb" : "status-orb indexing"} />{connectorsLoaded ? `${verifiedCount} verified systems` : "Resolving connector proofs"}</span>
          <div className="mode-control">
            {(["auto", "fast", "thinking"] as const).map((value) => <button key={value} type="button" className={mode === value ? "mode active" : "mode"} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === "auto" ? "Auto" : value === "thinking" ? "Deep check" : "Fast"}</button>)}
          </div>
        </div>
        <div className="typing-cue"><Terminal size={13} /><span>Ask one question. See every receipt.</span></div>
        <label className="sr-only" htmlFor="proof-question">Cross-source proof question</label>
        <textarea id="proof-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void run(); } }} placeholder="Ask what to do next, who promised what, or where systems disagree…" required maxLength={4000} />
        <div className="prompt-actions">
          <span>⌘ Enter to run</span>
          <button className="primary-button proof-button" disabled={!connectorsLoaded || !verifiedCount || busy || !question.trim()}>{busy || !connectorsLoaded ? <LoaderCircle className="spin" size={15} /> : verifiedCount ? <Play size={15} fill="currentColor" /> : <Link2 size={15} />}{!connectorsLoaded ? "Checking sources" : !verifiedCount ? "Connect a source first" : busy ? "Checking the evidence" : "Run live proof"}</button>
        </div>
      </form>

      {!result && !busy && <>
        <div className="prompt-shelf" aria-label="Example proof questions">
          {proofPrompts.slice(0, 3).map((prompt, index) => <button key={prompt} disabled={!connectorsLoaded || !verifiedCount} onClick={() => { setQuestion(prompt); void run(prompt); }} aria-label={`Run example ${index + 1}: ${prompt}`}><span>{String(index + 1).padStart(2, "0")}</span>{prompt}<ArrowRight size={13} /></button>)}
        </div>
        <div className="proof-trustline" aria-label="QueueProof safeguards">
          <span><CircleCheck size={14} /> Every claim opens to a receipt</span>
          <span><CircleAlert size={14} /> Disagreement stays visible</span>
          <span><LockKeyhole size={14} /> External writes need approval</span>
        </div>
      </>}

      <section className="landing-proof-sections" aria-label="QueueProof product overview">
        <div className="landing-problem">
          <span className="eyebrow">Why QueueProof</span>
          <h2>Your work is split across tools.<br /><em>AI can summarise it. QueueProof verifies it.</em></h2>
          <p>Messages, tickets, code, email, and documents often disagree. QueueProof keeps the disagreement visible and links every supported claim to the exact receipt.</p>
        </div>
        <div className="landing-steps" aria-label="How QueueProof works">
          {[
            ["01", "Connect", "Prove a source can return real, attributable records."],
            ["02", "Ask", "Choose one operational question or claim to verify."],
            ["03", "Verify", "Compare receipts, dates, people, and changed information."],
            ["04", "Act", "Recommend one safe next step and gate external writes."],
          ].map(([number, title, body]) => <article key={number}><small>{number}</small><h3>{title}</h3><p>{body}</p></article>)}
        </div>
        <div className="landing-proof-grid">
          <article className="flagship-proof-card">
            <span className="eyebrow">Flagship proof</span>
            <h3>Who escalated AuthShield, what was promised, and is the fix merged?</h3>
            <p>QueueProof reconstructs the warning, commitment, implementation, tracked state, and missing follow-up across the verified sources available to this workspace.</p>
            <div><span><small>LIVE SOURCES PROVEN</small><strong>{verifiedCount || "—"}</strong></span><span><small>RECORDED CITATION PRECISION</small><strong>{judgeMeasured && judgePulse?.citationPrecision !== null && judgePulse?.citationPrecision !== undefined ? `${Math.round(judgePulse.citationPrecision * 100)}%` : "Not measured"}</strong></span><span><small>RECORDED UNSUPPORTED</small><strong>{judgeMeasured && judgePulse?.unsupportedClaimRate !== null && judgePulse?.unsupportedClaimRate !== undefined ? `${Math.round(judgePulse.unsupportedClaimRate * 100)}%` : "Not measured"}</strong></span></div>
            <button type="button" className="secondary-button" onClick={() => { setQuestion("Who escalated the AuthShield outage, what did engineering commit to, and is the fix already merged?"); document.getElementById("proof-question")?.focus(); }}>Load this investigation</button>
          </article>
          <article className="difficult-questions-card">
            <span className="eyebrow">Built for difficult questions</span>
            <ul><li>Timeline reasoning</li><li>Cross-source identity</li><li>Updated information</li><li>Thread understanding</li><li>Multi-hop retrieval</li></ul>
            <p>Fast handles direct facts. Deep check performs a bounded evidence-derived follow-up only when the question requires it.</p>
          </article>
        </div>
        <div className="measured-cta">
          <div><span className="eyebrow">Measured, not claimed</span><h2>Failures stay visible.</h2><p>Expected facts, observed answers, citation support, latency, HydraDB calls, mode, and relative cost live together in the benchmark receipt.</p></div>
          <div><a className="primary-button" href="/demo">Ask QueueProof <ArrowRight size={13} /></a><a className="secondary-button" href="/benchmarks">Inspect the benchmark</a><a className="text-link" href="/method">How proof works</a></div>
        </div>
      </section>

      {verified.length > 0 && <section className="connector-proof-rail" aria-label="Verified connector receipts">
        <div className="rail-heading"><span><Link2 size={13} /> Live connector receipts</span><button onClick={onOpenSources}>Inspect evidence boundary <ArrowRight size={12} /></button></div>
        <div className="connector-proof-grid">
          {verified.map((connector) => <button key={connector.id} data-provider={connector.provider} onClick={onOpenSources}>
            <span className="brand-icon"><ProviderIcon provider={connector.provider} size={20} /></span>
            <span><strong>{connector.provider}</strong><small>{connector.database}{connector.collection ? ` / ${connector.collection}` : ""}</small></span>
            <span className="connector-receipt"><b>{connector.canaryResultCount ?? 0}</b><small>RECORDS PROVEN</small></span>
            <CircleCheck size={15} />
          </button>)}
        </div>
      </section>}

      {busy && <div ref={stageRef} className="retrieval-stage" role="status" aria-live="polite" tabIndex={-1}>
        <div className="stage-track"><i /><i /><i /><i /></div>
        <div><strong>HydraDB request in progress.</strong><span>{mode === "thinking" ? "Deep check" : mode === "fast" ? "Fast check" : "QueueProof selected the route"} · searching {verified.map((connector) => connector.provider).join(", ")} · unsupported claims stay blocked</span></div>
        <button type="button" className="secondary-button retrieval-cancel" onClick={cancelRun}>Stop waiting</button>
      </div>}

      {result && <p className="sr-only" role="status" aria-live="polite">Answer ready with {result.validation.citedClaimCount} cited claim{result.validation.citedClaimCount === 1 ? "" : "s"}.</p>}
      {result && <div ref={resultRef} className={`ask-results premium-results ${resultTone}`} tabIndex={-1}>
        <div className="result-telemetry">
          <span>{resultTone === "grounded" ? <ShieldCheck size={14} /> : <CircleAlert size={14} />}{resultTone}</span>
          <span><Network size={14} />{result.validation.providerCoverage.length} providers</span>
          <span><Activity size={14} />{result.trace.callCount} HydraDB call{result.trace.callCount === 1 ? "" : "s"}</span>
          <span><Clock3 size={14} />{(result.trace.latencyMs / 1000).toFixed(2)}s</span>
          <span><Zap size={14} />{result.trace.mode === "thinking" ? "Deep check" : result.trace.mode}</span>
        </div>
        <article className={`answer-surface ${resultTone}`}>
          <div className="answer-kicker"><span>{resultTone === "abstained" ? "INSUFFICIENT EVIDENCE" : resultTone === "partial" ? "PARTIAL EVIDENCE" : "GROUNDED ANSWER"}</span><button className="copy-id" onClick={() => void navigator.clipboard.writeText(result.retrieval_receipt.query_id)} title="Copy query receipt ID" aria-label="Copy query receipt ID"><code>{result.retrieval_receipt.query_id.slice(-8)}</code><Clipboard size={12} /></button></div>
          <p className="result-question"><small>QUESTION</small>{result.question ?? submittedQuestion}</p>
          <h2><CitedAnswer text={result.answer} citations={result.citations} onOpen={(evidence, index) => setCitationPreview({ evidence, index })} /></h2>
          <div className="answer-verdict">{resultTone === "grounded" ? <CircleCheck size={17} /> : <CircleAlert size={17} />}<span><strong>{result.validation.citedClaimCount}/{result.validation.claimCount} claims cited</strong> · {resultTone === "abstained" ? "no unsupported answer was generated" : resultTone === "partial" ? "supported claims are shown, but evidence gaps remain" : "unsupported prose is blocked"}</span></div>
        </article>

        {result.contradictions.length > 0 && <div className="contradiction-stack">
          {result.contradictions.map((item, index) => <article key={`${item.summary}-${index}`}><CircleAlert size={18} /><div><span>CONTRADICTION PRESERVED</span><strong>{item.summary}</strong><small>{item.providers.join(" ↔ ")} · receipts {item.evidenceIds.map((id) => id.slice(0, 6)).join(", ")}</small></div></article>)}
        </div>}

        {missingInformation.length > 0 && <section className={`missing-information ${resultTone}`} aria-labelledby="missing-information-title"><CircleAlert size={18} /><div><span>{resultTone === "abstained" ? "ANSWER WITHHELD" : "EVIDENCE GAP"}</span><h3 id="missing-information-title">Evidence still needed</h3><ul>{missingInformation.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div></section>}

        <details className="technical-details">
          <summary><Activity size={14} /> Technical details <span>{result.trace.callCount} calls · {(result.trace.latencyMs / 1000).toFixed(2)}s</span></summary>
        <section className="evidence-strength" aria-labelledby="evidence-strength-title">
          <div className="result-heading"><div><span className="eyebrow">Evidence strength</span><h3 id="evidence-strength-title">Five checks, kept separate.</h3></div></div>
          <div className="strength-grid">
            <span><small>SOURCE COVERAGE</small><strong>{result.validation.providerCoverage.length} provider{result.validation.providerCoverage.length === 1 ? "" : "s"}</strong><em>{result.validation.providerCoverage.join(" · ") || "No provider coverage"}</em></span>
            <span><small>CITATION SUPPORT</small><strong>{result.validation.citedClaimCount}/{result.validation.claimCount}</strong><em>claims linked to receipts</em></span>
            <span><small>TIMELINE</small><strong>{timelineEvidence.filter((item) => item.timestamp).length}/{timelineEvidence.length}</strong><em>receipts with timestamps</em></span>
            <span><small>RECOMMENDATION CONFIDENCE</small><strong>{result.priority_items[0] ? `${Math.round(result.priority_items[0].confidence * 100)}%` : "Not measured"}</strong><em>{result.priority_items[0]?.normalized_entity ?? "No grounded recommendation"}</em></span>
            <span><small>CONTRADICTION RISK</small><strong>{result.contradictions.length ? `${result.contradictions.length} review` : "No conflict found"}</strong><em>never folded into one score</em></span>
          </div>
        </section>

        {timelineEvidence.length > 0 && <section className="evidence-timeline" aria-labelledby="evidence-timeline-title">
          <div className="result-heading"><div><span className="eyebrow">Evidence timeline</span><h3 id="evidence-timeline-title">What the receipts establish, in order.</h3></div><span>{timelineEvidence.length} events</span></div>
          <ol>
            {timelineEvidence.map((item, index) => {
              const receiptId = item.id ?? item.sourceId ?? `${item.provider}-${index}`;
              const isConflict = contradictionEvidenceIds.has(receiptId);
              const isCited = rankedEvidenceIds.has(receiptId);
              return <li key={receiptId} className={isConflict ? "conflict" : ""}>
                <time>{dateLabel(item.timestamp)}</time>
                <i />
                <article>
                  <div><span className="provider-glyph"><ProviderIcon provider={item.provider} size={13} /></span><strong>{item.provider}</strong><small>{isConflict ? "Conflicts with another receipt" : isCited ? "Supports the answer" : "Supporting context"}</small></div>
                  <h4>{item.title}</h4>
                  <p>{item.excerpt}</p>
                  <button type="button" onClick={() => setCitationPreview({ evidence: item as Evidence & { id: string }, index })}>Inspect receipt <Eye size={12} /></button>
                </article>
              </li>;
            })}
          </ol>
        </section>}

        <div className="retrieval-receipt" aria-label="Retrieval receipt">
          <span><small>ROUTING</small><strong>{result.routing_reason}</strong></span>
          <span><small>GRAPH</small><strong>{result.retrieval_receipt.graph_usage ? "Enabled" : "Not required"}</strong></span>
          <span><small>RECEIPTS</small><strong>{result.retrieval_receipt.receipt_count}</strong></span>
          <span><small>COST UNITS</small><strong>{result.retrieval_receipt.estimated_cost_units}</strong></span>
        </div>
        <details className="trace-drawer"><summary><Terminal size={14} /> Reproducible retrieval trace <span>{result.trace.runId}</span></summary><pre>{JSON.stringify(result.trace, null, 2)}</pre></details>
        </details>

        {result.priority_items[0] && <article className="priority-result">
          <div className="priority-score"><small>NEXT SAFE ACTION</small><strong>{result.priority_items[0].score}</strong><span>/100</span></div>
          <div><span className="eyebrow"><Command size={12} /> Evidence-ranked priority</span><h3>{result.priority_items[0].title}</h3><p>{result.priority_items[0].recommended_next_safe_action}</p><div className="priority-meta"><span>{result.priority_items[0].provider_coverage.join(" · ")}</span><span>{Math.round(result.priority_items[0].confidence * 100)}% recommendation confidence</span><span>{result.priority_items[0].approval_required ? "Approval gated" : "Read only"}</span></div></div>
        </article>}

        <div className="result-heading"><div><span className="eyebrow">Ranked evidence</span><h3>Receipts behind the answer.</h3></div><button className="secondary-button" onClick={onOpenLab}>Inspect benchmark <ArrowRight size={13} /></button></div>
        <div className="evidence-grid proof-evidence">{rankedEvidence.map((item, index) => <EvidenceCard key={`${item.provider}-${item.id ?? index}`} evidence={item} index={index} />)}</div>
        {supportingEvidence.length > 0 && <details className="supporting-records"><summary>Show {supportingEvidence.length} additional retrieved record{supportingEvidence.length === 1 ? "" : "s"}</summary><div className="evidence-grid proof-evidence">{supportingEvidence.map((item, index) => <EvidenceCard key={`${item.provider}-${item.id ?? index + rankedEvidence.length}`} evidence={item} index={index + rankedEvidence.length} />)}</div></details>}
      </div>}
      {citationPreview && <EvidenceReceiptDialog evidence={citationPreview.evidence} index={citationPreview.index} onClose={() => setCitationPreview(null)} />}
    </section>
  );
}

function EvidenceCard({ evidence, index }: { evidence: Evidence; index: number }) {
  const [open, setOpen] = useState(false);
  return <><article className="evidence-card" data-provider={evidence.provider}><div className="evidence-top"><span className="provider-glyph"><ProviderIcon provider={evidence.provider} size={14} /></span><span>{evidence.provider}</span><small>[{index + 1}]</small></div><h3>{evidence.title}</h3><blockquote>{evidence.excerpt}</blockquote><div className="evidence-footer"><span>{dateLabel(evidence.timestamp)}</span><button type="button" onClick={() => setOpen(true)}>Inspect receipt <Eye size={12} /></button></div></article>{open && <EvidenceReceiptDialog evidence={evidence} index={index} onClose={() => setOpen(false)} />}</>;
}

function EvidenceReceiptDialog({ evidence, index, onClose }: { evidence: Evidence; index: number; onClose: () => void }) {
  const dialogRef = useDialogBehavior<HTMLElement>(true, onClose);
  const browserSafe = evidence.url?.startsWith("https://") || evidence.url?.startsWith("http://");
  const receiptId = evidence.id ?? evidence.sourceId ?? evidence.externalId ?? "unavailable";
  return <div className="drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside ref={dialogRef} className="source-preview" role="dialog" aria-modal="true" aria-labelledby={`evidence-receipt-title-${index}`} tabIndex={-1}><button type="button" className="modal-close" data-dialog-initial aria-label="Close evidence receipt" onClick={onClose}><X size={16} /></button><span className="eyebrow"><ProviderIcon provider={evidence.provider} /> {evidence.provider} receipt [{index + 1}]</span><h2 id={`evidence-receipt-title-${index}`}>{evidence.title}</h2><blockquote>{evidence.excerpt}</blockquote><div className="source-receipt-grid"><span><small>RECEIPT ID</small><code>{receiptId}</code></span><span><small>SOURCE TIME</small><strong>{dateLabel(evidence.timestamp)}</strong></span><span><small>INGESTED</small><strong>{dateLabel(evidence.ingestionTimestamp)}</strong></span><span><small>AUTHORITY</small><strong>{evidence.authority ?? "Indexed source"}</strong></span></div><div className="drawer-actions"><button type="button" className="secondary-button" onClick={() => void navigator.clipboard.writeText(String(receiptId))}><Clipboard size={14} /> Copy receipt ID</button>{browserSafe && <a className="primary-button" href={evidence.url!} target="_blank" rel="noreferrer">Open provider source <ExternalLink size={13} /></a>}</div></aside></div>;
}

function SourcesScreen({ workspace, connectors, reloadWorkspace, reloadConnectors, setError, setNotice, readOnly }: {
  workspace: ReadyView; connectors: Connector[]; reloadWorkspace: () => Promise<WorkspaceView>;
  reloadConnectors: () => Promise<void>; setError: (value: string) => void; setNotice: (value: string) => void;
  readOnly: boolean;
}) {
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState("");
  const [setupOpen, setSetupOpen] = useState(false);
  const [proof, setProof] = useState<Record<string, unknown> | null>(null);
  const proofReturnFocusRef = useRef<HTMLButtonElement | null>(null);

  async function connectHydra(event: FormEvent) {
    event.preventDefault(); setBusy("hydra"); setError("");
    try { await api("/api/hydradb/configure", { method: "POST", body: JSON.stringify({ apiKey }) }); setApiKey(""); await reloadWorkspace(); setNotice("HydraDB authenticated. Provider and database discovery are now live."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "HydraDB setup failed."); }
    finally { setBusy(""); }
  }

  async function connectorAction(connector: Connector, opener: HTMLButtonElement) {
    proofReturnFocusRef.current = opener;
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
    <div className="screen-heading"><div><span className="eyebrow"><Database size={13} /> Live evidence boundary</span><h1>Connect once.<br /><em>Prove every read.</em></h1><p>Connect each source once. QueueProof will not trust it until a real record comes back with a receipt.</p></div>{workspace.hydradb.configured && !readOnly && <button className="primary-button" onClick={() => setSetupOpen(true)}><Plus size={15} /> Add source</button>}</div>
    {readOnly && <div className="inline-warning"><LockKeyhole size={14} />Public sandbox: connector credentials and lifecycle mutations are owner-only. Verified proof receipts remain inspectable.</div>}
    {!workspace.hydradb.configured ? readOnly ? <div className="honest-empty"><LockKeyhole size={24} /><div><strong>Evidence configuration is owner-only.</strong><p>This public sandbox cannot accept credentials.</p></div></div> : <form className="hydra-setup" onSubmit={connectHydra}><div className="hydra-symbol"><Database size={29} /></div><div><span className="eyebrow">Step 1 · Evidence engine</span><h2>Attach your HydraDB account.</h2><p>Use a newly generated API key. QueueProof verifies it against the authenticated database endpoint, encrypts it with AES-GCM, and never returns it.</p><label>HydraDB API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste new key" autoComplete="off" required minLength={12} /></label><button className="primary-button" disabled={busy === "hydra"}>{busy === "hydra" ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />} Verify and encrypt</button></div></form> : <>
      <div className="source-stats"><div><small>HYDRADB</small><strong><CircleCheck size={14} /> Authenticated</strong><span>{workspace.hydradb.fingerprint ?? "Encrypted"}</span></div><div><small>CONNECTED</small><strong>{connectors.length}</strong><span>workplace sources</span></div><div><small>VERIFIED</small><strong>{connectors.filter((item) => item.state === "data_verified").length}</strong><span>eligible for retrieval</span></div><div><small>POLICY</small><strong>Fail closed</strong><span>no proof · no ranking</span></div></div>
      {connectors.length ? <div className="connector-list">{connectors.map((connector) => <article className="connector-row" data-provider={connector.provider} key={connector.id}><span className="provider-glyph large"><ProviderIcon provider={connector.provider} size={19} /></span><div className="connector-identity"><strong>{connector.name}</strong><span>{connector.provider} · {connector.database}{connector.collection ? ` / ${connector.collection}` : ""}</span></div><div className="connector-state"><span className={connector.state === "data_verified" ? "status-orb live" : connector.state.includes("sync") ? "status-orb indexing" : "status-orb"} /><strong>{stateCopy[connector.state] ?? connector.state}</strong><small>{connector.state === "data_verified" ? `${connector.canaryResultCount ?? 0} live records proven` : connector.lastError || "Awaiting next lifecycle step"}</small></div><button className="secondary-button" onClick={(event) => void connectorAction(connector, event.currentTarget)} disabled={busy === connector.id || (readOnly && connector.state !== "data_verified")}>{busy === connector.id ? <LoaderCircle className="spin" size={14} /> : connector.state === "data_verified" ? <Eye size={14} /> : readOnly ? <LockKeyhole size={14} /> : connector.state === "connector_created" || connector.state === "resources_discovered" ? <Search size={14} /> : <RefreshCw size={14} />}{connector.state === "data_verified" ? "View proof" : readOnly ? "Owner action" : connector.state === "connector_created" || connector.state === "resources_discovered" ? "Choose scope" : connector.state === "resources_selected" ? "Start sync" : "Check proof"}</button></article>)}</div> : <div className="empty-source"><Unplug size={28} /><div><h2>No workplace source yet.</h2><p>Add Slack, Gmail, Linear, or any provider exposed by your live HydraDB catalogue.</p></div>{!readOnly && <button className="primary-button" onClick={() => setSetupOpen(true)}><Plus size={15} /> Add first source</button>}</div>}
      <DocumentsPanel databases={[...new Set(connectors.map((item) => item.database).filter(Boolean))]}
        setError={setError} setNotice={setNotice} readOnly={readOnly} />
      <EvidenceGraphPanel setError={setError} />
    </>}
    {setupOpen && <SourceSetup onClose={() => setSetupOpen(false)} onDone={async () => { setSetupOpen(false); await reloadConnectors(); setNotice("Connector created. Choose the exact resources QueueProof may index."); }} setError={setError} />}
    {proof && <ProofModal data={proof} returnFocusRef={proofReturnFocusRef} onClose={() => setProof(null)} onConfigured={async () => { setProof(null); await reloadConnectors(); setNotice("Scope saved and initial backfill started. Check proof when indexing completes."); }} setError={setError} />}
  </section>;
}

function prettyBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsPanel({ databases, setError, setNotice, readOnly }: {
  databases: string[]; setError: (value: string) => void; setNotice: (value: string) => void;
  readOnly: boolean;
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

  const processingDocumentIds = useMemo(() => documents
    .filter((document) => ["processing", "uploading"].includes(document.stage) && document.hydradbSourceId)
    .map((document) => document.id), [documents]);
  const processingDocumentKey = processingDocumentIds.join("|");

  useEffect(() => {
    if (readOnly || !processingDocumentIds.length) return;
    const timer = window.setInterval(() => {
      void Promise.all(processingDocumentIds.map((id) => api(`/api/documents/${id}/status`)))
        .then(load)
        .catch(() => { /* Manual Check remains available with the surfaced error path. */ });
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [processingDocumentKey, processingDocumentIds, readOnly]);

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
    if (readOnly) return;
    setBusy(document.id); setError("");
    try {
      const data = await api<{ document: DocumentRecord; terminal?: boolean; indexingStatus?: string | null }>(`/api/documents/${document.id}/status`);
      await load();
      setNotice(data.terminal ? `${document.filename} is ${data.document.stage}.` : `${document.filename}: ${data.indexingStatus ?? data.document.stage}.`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Indexing check failed."); }
    finally { setBusy(""); }
  }

  return <section className="document-panel">
    <div className="section-kicker"><span><FileText size={14} /> Document evidence</span><small>PDF · Markdown · text · QueueProof intake cap 25 MB</small></div>
    {readOnly && <div className="inline-warning"><LockKeyhole size={14} />Uploads are disabled in the public sandbox; the indexed document ledger remains readable.</div>}
    <div className="document-grid">
      <form className="upload-card" onSubmit={upload} onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); if (!readOnly) setFile(event.dataTransfer.files[0] ?? null); }}>
        <UploadCloud size={30} />
        <h2>Drop knowledge into the evidence graph.</h2>
        <p>QueueProof verifies the file, removes exact duplicates, and waits for HydraDB to confirm that search is ready.</p>
        <label className="file-picker">
          <input key={inputKey} type="file" accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={readOnly} />
          <span>{readOnly ? "Owner upload only" : file ? file.name : "Choose a document"}</span>
          <small>{readOnly ? "public intake disabled" : file ? prettyBytes(file.size) : "or drag it here"}</small>
        </label>
        {databases.length > 0 && <label className="database-choice">Evidence database<select value={database} onChange={(event) => setDatabase(event.target.value)} disabled={readOnly}>{databases.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>}
        <button className="primary-button" disabled={readOnly || !file || busy === "upload"}>{busy === "upload" ? <LoaderCircle className="spin" size={14} /> : readOnly ? <LockKeyhole size={14} /> : <UploadCloud size={14} />}{busy === "upload" ? "Validating and sending" : readOnly ? "Upload disabled" : "Ingest document"}</button>
      </form>
      <div className="document-list">
        <div className="list-title"><span><ShieldCheck size={14} /> Ingestion ledger</span><button onClick={() => void load()}><RefreshCw size={12} /> Refresh</button></div>
        {documents.length ? documents.map((document) => <article className="document-row" key={document.id}>
          <span className={`document-stage ${document.stage}`}><FileText size={15} /></span>
          <div><strong>{document.filename}</strong><small>{prettyBytes(document.byteSize)} · {document.pageCount ? `${document.pageCount} pages · ` : ""}{document.mime} · {dateLabel(document.createdAt)}</small><code title={document.contentHash}>SHA-256 {document.contentHash.slice(0, 18)}…</code>{document.hydradbSourceId && <code title={document.hydradbSourceId}>Hydra source {document.hydradbSourceId}</code>}<small>{document.database ? `Database ${document.database}` : "Database pending"}{document.processingDurationMs ? ` · indexed in ${(document.processingDurationMs / 1000).toFixed(1)}s` : ""}</small>{document.error && <em>{document.error}</em>}</div>
          <span className={`stage-chip ${document.stage}`}>{document.stage}</span>
          <button className="receipt-copy" aria-label={`Copy receipt for ${document.filename}`} onClick={() => void navigator.clipboard.writeText(JSON.stringify(document, null, 2))}><Clipboard size={13} /></button>
          {!readOnly && (document.stage === "processing" || document.stage === "validated" || document.stage === "uploading") && <button className="secondary-button" onClick={() => void poll(document)} disabled={busy === document.id}>{busy === document.id ? <LoaderCircle className="spin" size={13} /> : <RefreshCw size={13} />} Check</button>}
        </article>) : <div className="honest-empty"><FileText size={24} /><div><strong>No document evidence yet.</strong><p>The ledger will show validation, hashing, processing, and the real terminal indexing state.</p></div></div>}
      </div>
    </div>
  </section>;
}

/**
 * Fetches /api/graph and renders it. Loading/empty conventions match
 * DocumentsPanel above: a single active-flag effect, api<T>() for the fetch,
 * setError for failures, .modal-loading for the spinner, .honest-empty for
 * the no-data state.
 */
function EvidenceGraphPanel({ setError }: { setError: (value: string) => void }) {
  const [graph, setGraph] = useState<EvidenceGraphData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void api<{ graph: EvidenceGraphData }>("/api/graph")
      .then((data) => { if (active) setGraph(data.graph); })
      .catch((reason: Error) => { if (active) setError(reason.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [setError]);

  return <section className="document-panel">
    <div className="section-kicker"><span><Network size={14} /> Relationships</span><small>How receipts support facts, work, and next steps</small></div>
    {loading
      ? <div className="modal-loading" role="status"><LoaderCircle className="spin" /> Deriving evidence graph…</div>
      : graph
        ? <EvidenceGraphView graph={graph} />
        : <div className="honest-empty"><Network size={24} /><div><strong>No relationships available.</strong><p>Generate a priority queue first, then check back here.</p></div></div>}
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
  const dialogRef = useDialogBehavior<HTMLFormElement>(true, onClose);
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
  return <div className="modal-layer" role="presentation"><form ref={dialogRef} className="modal-card source-modal" role="dialog" aria-modal="true" aria-labelledby="source-setup-title" tabIndex={-1} onSubmit={submit}><button type="button" className="modal-close" data-dialog-initial onClick={onClose}><X size={16} /></button><span className="eyebrow"><Plus size={13} /> New evidence source</span><h2 id="source-setup-title">Connect from the live catalogue.</h2><p>QueueProof renders this form from HydraDB’s current provider contract. It never guesses provider credentials.</p>{busy && !providers.length ? <div className="modal-loading" role="status"><LoaderCircle className="spin" /> Hydrating provider contracts…</div> : <div className="setup-form"><label>Provider<select value={providerId} onChange={(event) => { setProviderId(event.target.value); setCredentials({}); }} required>{providers.filter((item) => item.available).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.supportClass}</option>)}</select></label><div className="two-cols"><label>HydraDB database<select value={database} onChange={(event) => setDatabase(event.target.value)} required><option value="" disabled>Select database</option>{databases.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Collection <small>optional isolation</small><input value={collection} onChange={(event) => setCollection(event.target.value)} placeholder="team-work" /></label></div>{!databases.length && <div className="database-create"><input value={newDatabase} onChange={(event) => setNewDatabase(event.target.value)} placeholder="Create database name" aria-label="Create database name" /><button type="button" className="secondary-button" onClick={() => void createDatabase()}>Create</button></div>}<label>Provider account scope <small>recommended for multi-account safety</small><input value={accountScope} onChange={(event) => setAccountScope(event.target.value)} placeholder="workspace / org / account identifier" /></label><div className="credential-grid">{selected?.credentialFields.map((field) => <label key={field.name}>{field.title || field.name}{field.required && <b> required</b>}{field.enum?.length ? <select value={credentials[field.name] ?? ""} onChange={(event) => setCredentials((current) => ({ ...current, [field.name]: event.target.value }))} required={field.required}><option value="">Select</option>{field.enum.map((value) => <option key={value} value={value}>{value}</option>)}</select> : <input type={field.format === "password" || /token|secret|password|key/i.test(field.name) ? "password" : "text"} value={credentials[field.name] ?? ""} onChange={(event) => setCredentials((current) => ({ ...current, [field.name]: event.target.value }))} required={field.required} autoComplete="off" />}{field.description && <small>{field.description}</small>}</label>)}</div>{selected && !selected.credentialFields.length && <div className="inline-warning"><CircleAlert size={14} />This provider contract exposes no credential fields. QueueProof will submit no credentials only if HydraDB marks that valid.</div>}<button className="primary-button" disabled={busy || !database || !selected}>{busy ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />} Create connector</button></div>}</form></div>;
}

function ProofModal({ data, returnFocusRef, onClose, onConfigured, setError }: { data: Record<string, unknown>; returnFocusRef?: { readonly current: HTMLElement | null }; onClose: () => void; onConfigured: () => Promise<void>; setError: (value: string) => void }) {
  const connector = data.connector as Connector | undefined;
  const resources = (data.resources ?? []) as Resource[];
  const verification = data.verification as Record<string, unknown> | undefined;
  const [selected, setSelected] = useState<string[]>(resources.filter((item) => item.selected).map((item) => item.id));
  const [busy, setBusy] = useState(false);
  const dialogRef = useDialogBehavior<HTMLDivElement>(true, onClose, returnFocusRef);
  async function configure() {
    if (!connector || !selected.length) return; setBusy(true);
    try { await api(`/api/connectors/${connector.id}/configure`, { method: "POST", body: JSON.stringify({ resourceIds: selected, lookbackDays: 30 }) }); await onConfigured(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Scope configuration failed."); }
    finally { setBusy(false); }
  }
  return <div className="modal-layer" role="presentation"><div ref={dialogRef} className="modal-card proof-modal" role="dialog" aria-modal="true" aria-labelledby="connection-proof-title" tabIndex={-1}><button type="button" className="modal-close" data-dialog-initial aria-label="Close connection proof" onClick={onClose}><X size={16} /></button><span className="eyebrow"><ShieldCheck size={13} /> Connection proof</span><h2 id="connection-proof-title">{connector?.name ?? "Verified source"}</h2>{verification ? <><div className="proof-seal"><CircleCheck size={28} /><div><strong>{String(verification.stage ?? "Proof available")}</strong><span>{String(verification.canaryResultCount ?? 0)} real provider records · {dateLabel(String(verification.verifiedAt ?? ""))}</span></div></div><div className="proof-grid"><div><small>CURSOR EVIDENCE</small><code>{String(verification.cursorEvidenceHash ?? "Not available").slice(0, 24)}</code></div><div><small>PROVIDER COVERAGE</small><strong>{Array.isArray(verification.providerCoverage) ? verification.providerCoverage.join(", ") : "Not available"}</strong></div><div><small>LAST SYNC</small><strong>{dateLabel(String(verification.lastSuccessfulSync ?? ""))}</strong></div><div><small>FAILURE</small><strong>{String(verification.failureReason ?? "None")}</strong></div></div><details className="trace-drawer"><summary><Terminal size={14} /> Raw proof record</summary><pre>{JSON.stringify(verification, null, 2)}</pre></details></> : <><p>Select the smallest resource scope QueueProof may index. Configure starts HydraDB’s initial backfill automatically.</p><div className="resource-picker">{resources.map((resource) => <label key={resource.id}><input type="checkbox" checked={selected.includes(resource.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, resource.id] : current.filter((id) => id !== resource.id))} /><span><strong>{resource.name}</strong><small>{resource.resourceType} · {resource.id}</small></span><Check size={14} /></label>)}</div><button type="button" className="primary-button" disabled={!selected.length || busy} onClick={() => void configure()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Zap size={15} />} Save scope and start sync</button></>}</div></div>;
}

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function ApprovalsScreen({ seedPacket, onSeedUsed, setError, setNotice, readOnly }: {
  seedPacket: Packet | null; onSeedUsed: () => void;
  setError: (value: string) => void; setNotice: (value: string) => void;
  readOnly: boolean;
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
  const closeComposer = () => { setComposerOpen(false); onSeedUsed(); };
  const composerDialogRef = useDialogBehavior<HTMLFormElement>(composerOpen, closeComposer);
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
    } catch (reason) {
      await load().catch(() => { /* The original approval error remains primary. */ });
      setSelected(null); setConfirmed(false);
      setError(reason instanceof Error ? reason.message : "Approval failed; the ledger was refreshed before any retry.");
    }
    finally { setBusy(""); }
  }

  const pending = proposals.filter((item) => !item.decision && item.status === "proposed").length;
  const executed = proposals.filter((item) => item.executionStatus === "succeeded" || item.status === "executed").length;

  return <section className="screen approvals-screen">
    <div className="screen-heading"><div><span className="eyebrow"><ShieldCheck size={13} /> Human approval</span><h1>Agents propose.<br /><em>Humans commit.</em></h1><p>See the exact action, the receipts behind it, and the risk before anything is written. An approved action can run only once.</p></div><button className="primary-button" onClick={() => setComposerOpen(true)}><Plus size={15} /> New proposal</button></div>
    {readOnly && <div className="inline-warning"><LockKeyhole size={14} />Public visitors may create evidence-linked proposals for the demo, but only a private workspace owner can approve or execute them.</div>}
    <div className="approval-stats"><div><small>PENDING REVIEW</small><strong>{pending}</strong><span>nothing executes silently</span></div><div><small>EXECUTED ONCE</small><strong>{executed}</strong><span>provider-confirmed writes</span></div><div><small>GUARDRAIL</small><strong>At most once</strong><span>unique execution claim</span></div></div>
    <div className="approval-list">
      <div className="list-title"><span><LockKeyhole size={14} /> Action ledger</span><button onClick={() => void load()}><RefreshCw size={12} /> Refresh</button></div>
      {proposals.length ? proposals.map((proposal) => {
        const payload = parseJson<IssuePayload>(proposal.payloadJson, {});
        const evidence = parseJson<string[]>(proposal.evidenceIdsJson, []);
        const complete = proposal.executionStatus === "succeeded" || proposal.status === "executed";
        const failed = proposal.executionStatus === "failed";
        return <article className="approval-row" key={proposal.id}>
          <span className={`risk-mark ${proposal.riskClass}`}><ShieldCheck size={17} /></span>
          <div className="approval-copy"><span><b>{proposal.provider}</b> · {proposal.actionType.replaceAll("_", " ")} · {dateLabel(proposal.createdAt)}</span><strong>{payload.title ?? "Untitled provider action"}</strong><small>{evidence.length} evidence receipt{evidence.length === 1 ? "" : "s"} · risk {proposal.riskClass}</small>{failed && <em>{proposal.executionError ?? "The provider attempt failed; inspect the audit ledger before any follow-up."}</em>}</div>
          <span className={`stage-chip ${complete ? "indexed" : failed ? "failed" : proposal.decision ? "validated" : "processing"}`}>{complete ? "executed" : failed ? "execution failed" : proposal.decision ?? "review"}</span>
          <button className="secondary-button" onClick={() => { setSelected(proposal); setConfirmed(false); }}>{complete || failed ? <Eye size={13} /> : <ShieldCheck size={13} />}{complete ? "Inspect" : failed ? "Inspect failure" : proposal.decision ? "Approved" : "Review"}</button>
        </article>;
      }) : <div className="honest-empty"><ShieldCheck size={24} /><div><strong>No provider write is waiting.</strong><p>Open an execution packet and send it here, or create a grounded proposal manually.</p></div></div>}
    </div>

    {composerOpen && <div className="modal-layer" role="presentation"><form ref={composerDialogRef} className="modal-card action-composer" role="dialog" aria-modal="true" aria-labelledby="proposal-composer-title" tabIndex={-1} onSubmit={createProposal}><button type="button" className="modal-close" data-dialog-initial onClick={closeComposer}><X size={16} /></button><span className="eyebrow"><Plus size={13} /> Approval-gated Linear issue</span><h2 id="proposal-composer-title">Seal the proposed payload.</h2><p>This step records a proposal only. It cannot write to Linear until a human separately reviews and approves the exact result.</p><div className="setup-form"><label>Commitment summary<textarea value={summary} onChange={(event) => setSummary(event.target.value)} required maxLength={4000} /></label><div className="two-cols"><label>Owner <small>optional</small><input value={owner} onChange={(event) => setOwner(event.target.value)} /></label><label>Deadline <small>optional</small><input value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label></div><label>Evidence receipt IDs<textarea value={evidenceIds} onChange={(event) => setEvidenceIds(event.target.value)} placeholder="One source ID per line" required /></label><div className="two-cols"><label>Linear team ID<input value={teamId} onChange={(event) => setTeamId(event.target.value)} placeholder="Required provider team UUID" required /></label><label>Linear project ID <small>optional</small><input value={projectId} onChange={(event) => setProjectId(event.target.value)} /></label></div><button className="primary-button" disabled={busy === "create" || !summary.trim() || !evidenceIds.trim() || !teamId.trim()}>{busy === "create" ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />} Create reviewable proposal</button></div></form></div>}

    {selected && <ApprovalModal proposal={selected} confirmed={confirmed} setConfirmed={setConfirmed}
      busy={busy === selected.id} onApprove={approve} onClose={() => { setSelected(null); setConfirmed(false); }} readOnly={readOnly} />}
  </section>;
}

function ApprovalModal({ proposal, confirmed, setConfirmed, busy, onApprove, onClose, readOnly }: {
  proposal: ActionProposal; confirmed: boolean; setConfirmed: (value: boolean) => void;
  busy: boolean; onApprove: () => Promise<void>; onClose: () => void; readOnly: boolean;
}) {
  const dialogRef = useDialogBehavior<HTMLDivElement>(true, onClose);
  const payload = parseJson<IssuePayload>(proposal.payloadJson, {});
  const evidence = parseJson<string[]>(proposal.evidenceIdsJson, []);
  const complete = proposal.executionStatus === "succeeded" || proposal.status === "executed";
  const decided = Boolean(proposal.decision);
  return <div className="modal-layer" role="presentation"><div ref={dialogRef} className="modal-card approval-modal" role="dialog" aria-modal="true" aria-labelledby="approval-modal-title" tabIndex={-1}><button className="modal-close" data-dialog-initial onClick={onClose}><X size={16} /></button><span className="eyebrow"><ShieldCheck size={13} /> Exact provider payload</span><h2 id="approval-modal-title">{complete ? "Execution receipt." : decided ? "Approval recorded." : "Review before commit."}</h2><div className="risk-banner"><span className={`risk-mark ${proposal.riskClass}`}><CircleAlert size={16} /></span><div><strong>{proposal.riskClass} risk · Linear create issue</strong><small>Proposal {proposal.id}</small></div></div><div className="payload-grid"><div><small>TITLE</small><strong>{payload.title ?? "Missing title"}</strong></div><div><small>TEAM</small><code>{payload.teamId ?? "Missing team"}</code></div>{payload.projectId && <div><small>PROJECT</small><code>{payload.projectId}</code></div>}<div className="payload-description"><small>DESCRIPTION</small><pre>{payload.description ?? "Missing description"}</pre></div></div><div className="evidence-receipts"><small>EVIDENCE RECEIPTS · {evidence.length}</small>{evidence.map((id) => <code key={id}>{id}</code>)}</div>{complete ? <div className="proof-seal"><CircleCheck size={25} /><div><strong>Provider-confirmed execution</strong><span>Linear response ID {proposal.providerResponseId ?? "recorded"} · duplicate execution is blocked</span></div></div> : decided ? <div className="proof-seal"><CircleCheck size={25} /><div><strong>Human approval recorded</strong><span>{dateLabel(proposal.decidedAt)} · execution unavailable or pending</span></div></div> : readOnly ? <div className="inline-warning"><LockKeyhole size={14} />Approval and provider execution are disabled in the public sandbox. This exact payload remains inspectable.</div> : <><label className="approval-confirm"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span><strong>I reviewed this exact payload and its evidence.</strong><small>I understand QueueProof will attempt one Linear issue creation if the deployment has execution credentials.</small></span></label><button className="primary-button full" disabled={!confirmed || busy} onClick={() => void onApprove()}>{busy ? <LoaderCircle className="spin" size={14} /> : <Zap size={14} />}{busy ? "Claiming execution slot" : "Approve and execute once"}</button></>}</div></div>;
}

function AgentScreen({ workspace, setError, setNotice, readOnly, publicOrigin }: { workspace: ReadyView; setError: (value: string) => void; setNotice: (value: string) => void; readOnly: boolean; publicOrigin: string }) {
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [clientType, setClientType] = useState("codex");
  const [writeScopes, setWriteScopes] = useState(false);
  const [freshToken, setFreshToken] = useState("");
  const [busy, setBusy] = useState(false);
  const endpoint = `${publicOrigin}/mcp`;
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
  return <section className="screen agent-screen"><div className="screen-heading"><div><span className="eyebrow"><Bot size={13} /> Agent dock · MCP</span><h1>Give agents the plan.<br /><em>Keep humans in control.</em></h1><p>Generate a scoped token, connect any modern MCP client, and retrieve the exact execution packet shown in Command. Provider writes remain proposals unless a human approves them.</p></div></div>{readOnly && <div className="inline-warning"><LockKeyhole size={14} />Token issuance and revocation are disabled in the public sandbox. The integration shape and endpoint remain visible.</div>}<div className="agent-grid"><div className="token-console"><div className="console-line"><span><Terminal size={14} /> New agent connection</span><span className="secure-chip"><LockKeyhole size={12} /> hashed at rest</span></div><label>Client<select value={clientType} onChange={(event) => setClientType(event.target.value)} disabled={readOnly}><option value="codex">Codex</option><option value="claude">Claude Code</option><option value="kimi">Kimi Code</option><option value="kilo">Kilo Code</option><option value="generic">Generic MCP client</option></select></label><label className="scope-choice"><input type="checkbox" checked={writeScopes} onChange={(event) => setWriteScopes(event.target.checked)} disabled={readOnly} /><span><strong>Allow proposal + sync tools</strong><small>Still cannot execute a provider write without QueueProof approval.</small></span></label><button className="primary-button" onClick={() => void createToken()} disabled={readOnly || busy}>{busy ? <LoaderCircle className="spin" size={15} /> : readOnly ? <LockKeyhole size={15} /> : <KeyRound size={15} />}{readOnly ? "Token issuance disabled" : "Generate 30-day token"}</button>{freshToken && <div className="token-reveal"><span><CircleAlert size={13} /> Copy once — it cannot be shown again</span><code>{freshToken}</code><button onClick={() => void navigator.clipboard.writeText(freshToken)}><Clipboard size={13} /> Copy token</button></div>}</div><div className="config-card"><div className="list-title"><span><Braces size={14} /> Project configuration</span><button onClick={() => void navigator.clipboard.writeText(JSON.stringify(config, null, 2))}><Clipboard size={13} /> Copy</button></div><pre>{JSON.stringify(config, null, 2)}</pre><div className="endpoint-row"><small>REMOTE MCP ENDPOINT</small><code>{endpoint}</code></div></div></div><div className="token-list"><div className="list-title"><span><ShieldCheck size={14} /> Issued credentials</span><small>{workspace.workspace?.name}</small></div>{tokens.length ? tokens.map((token) => <div className="token-row" key={token.id}><span className={token.revokedAt ? "status-orb" : token.lastHandshakeAt ? "status-orb live" : "status-orb indexing"} /><div><strong>{token.clientType}</strong><small>{token.scopes.join(" · ")} · expires {dateLabel(token.expiresAt)}</small></div><span>{token.revokedAt ? "Revoked" : token.lastHandshakeAt ? `Connected ${dateLabel(token.lastHandshakeAt)}` : "Awaiting handshake"}</span>{!token.revokedAt && !readOnly && <button onClick={() => void revoke(token.id)}>Revoke</button>}</div>) : <div className="honest-empty"><Bot size={24} /><div><strong>No agent credential exists.</strong><p>Create one only when you are ready to connect a client.</p></div></div>}</div></section>;
}

type BenchmarkReplayRow = {
  id?: string; runId?: string; label: string; question: string; expected?: string; actual?: string;
  pass?: boolean; mode: string; latencyMs: number; callCount?: number; sources: number;
  providers: string[]; costUnits?: number;
};

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
    notMeasured?: Array<string | { metric?: string; reason?: string }>;
    caveat?: string;
  };
  live?: {
    status?: string; note?: string; target?: string; generatedAt?: string; cases?: number;
    connectors?: string[]; allThreeProviders?: number; fast?: number; thinking?: number;
    latencyMs?: { p50?: number; p95?: number; min?: number; max?: number };
    quality?: { requiredFactRecall?: number; citationPrecision?: number; citationCompleteness?: number; unsupportedClaimRate?: number; note?: string };
    rows?: BenchmarkReplayRow[];
  };
  modeComparison?: {
    status: string;
    note: string;
    comparable: boolean;
    fast: BenchmarkModeSummary;
    thinking: BenchmarkModeSummary;
    deltas: null | {
      thinkingMinusFastPasses: number;
      thinkingMinusFastFactAccuracy: number | null;
      thinkingMinusFastP50LatencyMs: number | null;
      thinkingToFastP50LatencyRatio: number | null;
      thinkingMinusFastMeanCalls: number | null;
      thinkingMinusFastCostUnits: number | null;
    };
    rows: Array<{
      id: string;
      label: string;
      fast: BenchmarkModeCase;
      thinking: BenchmarkModeCase;
    }>;
  };
};

type BenchmarkModeSummary = {
  status: string;
  cases: number;
  passed: number;
  requiredFactAccuracy: number | null;
  citationPrecision: number | null;
  citationCompleteness: number | null;
  p50LatencyMs: number | null;
  p95LatencyMs: number | null;
  meanCalls: number | null;
  totalCostUnits: number | null;
  release: { commitSha: string | null; commitRef: string | null };
};

type BenchmarkModeCase = {
  pass: boolean;
  requiredFactRecall: number | null;
  latencyMs: number | null;
  callCount: number | null;
  costUnits: number | null;
};

function ReplayScreen({ setError }: { setError: (value: string) => void }) {
  const [data, setData] = useState<LabResults | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    let active = true;
    void api<{ results: LabResults }>("/api/lab")
      .then((payload) => { if (active) setData(payload.results); })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [setError]);

  const rows = data?.live?.rows ?? [];
  const selected = rows[selectedIndex] ?? null;
  const replaySteps = useMemo(() => selected ? [
    { label: "Question captured", value: selected.question },
    { label: "Router decision", value: `${selected.mode === "thinking" ? "Deep check" : "Fast"} mode selected` },
    { label: "Source checkpoint", value: `${selected.providers.join(", ") || "No provider coverage"} · ${dateLabel(data?.live?.generatedAt ?? data?.generatedAt)}` },
    { label: "HydraDB retrieval", value: `${selected.callCount ?? "—"} call${selected.callCount === 1 ? "" : "s"} · ${selected.sources} retained receipt${selected.sources === 1 ? "" : "s"}` },
    { label: "Expected result", value: selected.expected ?? "No frozen expected answer" },
    { label: "Observed result", value: selected.actual ?? "No observed answer captured" },
    { label: "Evaluation", value: typeof selected.pass === "boolean" ? selected.pass ? "PASS" : "REVIEW" : "MEASURED" },
  ] : [], [data?.generatedAt, data?.live?.generatedAt, selected]);

  useEffect(() => {
    if (!playing || !replaySteps.length) return;
    const timer = window.setInterval(() => {
      setStep((current) => {
        if (current >= replaySteps.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, Math.max(350, 1100 / speed));
    return () => window.clearInterval(timer);
  }, [playing, replaySteps.length, speed]);

  function selectRow(index: number) {
    setSelectedIndex(index);
    setStep(0);
    setPlaying(false);
  }
  function exportRun() {
    if (!selected) return;
    const payload = {
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      checkpoint: data?.live?.generatedAt ?? data?.generatedAt ?? null,
      target: data?.live?.target ?? null,
      run: selected,
      replay: replaySteps,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `queueproof-${selected.id ?? selected.runId ?? "replay"}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return <section className="screen replay-screen">
    <div className="screen-heading"><div><span className="eyebrow"><RotateCcw size={13} /> Reproducible investigation</span><h1>Replay the proof.<br /><em>Step by measured step.</em></h1><p>Each frame comes from a stored benchmark artifact. If source data changes, the next benchmark creates a new checkpoint instead of rewriting this run.</p></div></div>
    {!rows.length ? <div className="honest-empty"><RotateCcw size={24} /><div><strong>No measured replay is available.</strong><p>Run the controlled live benchmark first. QueueProof will not animate a fixture and call it production evidence.</p></div></div> : <div className="replay-layout">
      <aside className="replay-runs" aria-label="Recorded investigations"><div className="list-title"><span><FileCheck2 size={14} /> Recorded runs</span><small>{rows.length}</small></div>{rows.map((row, index) => <button key={row.id ?? `${row.label}-${index}`} className={selectedIndex === index ? "active" : ""} aria-pressed={selectedIndex === index} onClick={() => selectRow(index)}><span><strong>{row.label}</strong><small>{row.mode} · {row.providers.join(" · ")}</small></span><em className={row.pass === false ? "review" : "pass"}>{typeof row.pass === "boolean" ? row.pass ? "PASS" : "REVIEW" : "MEASURED"}</em></button>)}</aside>
      <div className="replay-stage-panel">
        <div className="replay-toolbar">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              if (!playing && step >= replaySteps.length - 1) setStep(0);
              setPlaying((value) => !value);
            }}
          >
            {playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
            {playing ? "Pause" : step >= replaySteps.length - 1 ? "Play again" : "Play"}
          </button>
          <button type="button" className="secondary-button" onClick={() => { setPlaying(false); setStep((value) => Math.min(value + 1, replaySteps.length - 1)); }} disabled={step >= replaySteps.length - 1}><StepForward size={14} /> Step</button>
          <button type="button" className="secondary-button" onClick={() => { setPlaying(false); setStep(0); }} disabled={step === 0}><RotateCcw size={14} /> Reset</button>
          <label>Speed<select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={2}>2×</option></select></label>
          <button type="button" className="secondary-button" onClick={exportRun}><Download size={14} /> Export JSON</button>
        </div>
        {selected && <><div className="replay-head"><div><small>RUN ID</small><code>{selected.runId ?? selected.id ?? "artifact row"}</code></div><div><small>CHECKPOINT</small><strong>{dateLabel(data?.live?.generatedAt ?? data?.generatedAt)}</strong></div><div><small>DURATION</small><strong>{(selected.latencyMs / 1000).toFixed(2)}s</strong></div><div><small>COST</small><strong>{selected.costUnits ?? "—"} units</strong></div></div>
          <ol className="replay-steps">{replaySteps.map((item, index) => <li key={item.label} className={index < step ? "complete" : index === step ? "active" : "pending"}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{item.label}</strong>{index <= step && <p>{item.value}</p>}</div></li>)}</ol>
          <div className="replay-progress" role="progressbar" aria-label="Replay progress" aria-valuemin={1} aria-valuemax={replaySteps.length} aria-valuenow={step + 1}><i style={{ width: `${((step + 1) / replaySteps.length) * 100}%` }} /></div></>}
      </div>
    </div>}
  </section>;
}

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
  const [modeFilter, setModeFilter] = useState<"all" | "fast" | "thinking">("all");

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
  const live = data?.live;
  const comparison = data?.modeComparison;
  const rows = live?.rows ?? [];
  const filteredRows = modeFilter === "all" ? rows : rows.filter((row) => row.mode === modeFilter);
  const passed = rows.filter((row) => row.pass === true).length;
  const graded = rows.filter((row) => typeof row.pass === "boolean").length;
  const averageCalls = rows.some((row) => typeof row.callCount === "number")
    ? rows.reduce((total, row) => total + (row.callCount ?? 0), 0) / Math.max(rows.length, 1)
    : null;
  const benchmarkGatesMet = (router?.total ?? 0) >= 30 && graded > 0 && passed === graded
    && typeof live?.quality?.requiredFactRecall === "number" && live.quality.requiredFactRecall >= .9
    && typeof live?.quality?.citationCompleteness === "number" && live.quality.citationCompleteness >= .95
    && typeof live?.quality?.unsupportedClaimRate === "number" && live.quality.unsupportedClaimRate === 0;

  return (
    <section className="screen benchmark-screen">
      <div className="screen-heading benchmark-heading">
        <div>
          <span className="eyebrow"><Activity size={13} /> Production evidence lab</span>
          <h1>The benchmark is<br /><em>part of the product.</em></h1>
          <p>Replay the same hard questions against the live app. Expected facts, real answers, sources, speed, and cost stay together in one receipt.</p>
        </div>
        {live?.target && <a className="secondary-button" href={live.target} target="_blank" rel="noreferrer">Live target <ExternalLink size={13} /></a>}
      </div>

      {loading && <p className="muted">Loading evaluation results…</p>}
      {!loading && live?.status !== "measured" && <div className="inline-warning"><CircleAlert size={14} />{live?.note ?? "Strict production benchmark evidence is not available yet."}</div>}

      <div className="lab-summary premium-metrics">
        <div className="lab-metric primary"><small>LIVE CASES</small><strong>{rows.length || live?.cases || "—"}</strong><span>{graded ? `${passed}/${graded} required-signal checks passed` : "production cross-source runs"}</span></div>
        <div className="lab-metric"><small>P50 LATENCY</small><strong>{live?.latencyMs?.p50 ? `${(live.latencyMs.p50 / 1000).toFixed(2)}s` : "—"}</strong><span>p95 {live?.latencyMs?.p95 ? `${(live.latencyMs.p95 / 1000).toFixed(2)}s` : "not recorded"}</span></div>
        <div className="lab-metric"><small>PROVIDER PROOF</small><strong>{live?.connectors?.length ?? "—"}</strong><span>{live?.connectors?.join(" · ") || "not recorded"}</span></div>
        <div className="lab-metric"><small>CALL EFFICIENCY</small><strong>{averageCalls === null ? "—" : averageCalls.toFixed(1)}</strong><span>average HydraDB calls per answer</span></div>
      </div>

      <section className="mode-comparison" aria-labelledby="mode-comparison-title">
        <div className="mode-comparison-heading">
          <div><span className="eyebrow"><Zap size={13} /> Fast versus Deep check</span><h2 id="mode-comparison-title">Use more reasoning only when it earns its cost.</h2></div>
          <span className={comparison?.comparable ? "comparison-status measured" : "comparison-status"}>{comparison?.comparable ? <CircleCheck size={14} /> : <CircleAlert size={14} />}{comparison?.comparable ? "Measured" : "Not yet comparable"}</span>
        </div>
        {comparison?.comparable ? <>
          <div className="mode-comparison-grid">
            {(["fast", "thinking"] as const).map((key) => {
              const summary = comparison[key];
              return <article key={key}><span>{key === "fast" ? "FAST" : "DEEP CHECK"}</span><strong>{summary.passed}/{summary.cases} passed</strong><div><small>P50</small><b>{summary.p50LatencyMs === null ? "—" : `${(summary.p50LatencyMs / 1000).toFixed(2)}s`}</b></div><div><small>AVG CALLS</small><b>{summary.meanCalls === null ? "—" : summary.meanCalls.toFixed(1)}</b></div><div><small>COST UNITS</small><b>{summary.totalCostUnits ?? "—"}</b></div></article>;
            })}
          </div>
          <p className="comparison-note">{comparison.note}{comparison.deltas?.thinkingToFastP50LatencyRatio ? ` Deep check used ${comparison.deltas.thinkingToFastP50LatencyRatio.toFixed(1)}× the Fast p50 latency on this frozen set.` : ""}</p>
          {comparison.rows.length > 0 && <details className="comparison-cases"><summary>Compare all {comparison.rows.length} matched cases</summary><div>{comparison.rows.map((row) => <span key={row.id}><strong>{row.label}</strong><small>Fast {row.fast.pass ? "pass" : "review"} · {row.fast.latencyMs === null ? "—" : `${(row.fast.latencyMs / 1000).toFixed(2)}s`}</small><small>Deep {row.thinking.pass ? "pass" : "review"} · {row.thinking.latencyMs === null ? "—" : `${(row.thinking.latencyMs / 1000).toFixed(2)}s`}</small></span>)}</div></details>}
        </> : <div className="comparison-empty"><div><strong>The comparison has not been claimed.</strong><p>{comparison?.note ?? "Run the same frozen questions in both modes against one verified release."}</p></div><code>npm run benchmark:live -- --mode fast</code><code>npm run benchmark:live -- --mode thinking</code></div>}
      </section>

      <section className="judge-lens" aria-label="Hackathon judging evidence">
        <div className="judge-lens-heading"><div><span className="eyebrow"><ShieldCheck size={13} /> Judge lens</span><h2>Every scoring claim has a receipt.</h2></div><span className={benchmarkGatesMet ? "readiness-seal ready" : "readiness-seal"}>{benchmarkGatesMet ? <CircleCheck size={15} /> : <Activity size={15} />} {benchmarkGatesMet ? "BENCHMARK GATES MET" : "EVIDENCE BUILDING"}</span></div>
        <div className="judge-proof-grid">
          <article><small>01 · REQUIRED SIGNALS</small><strong>{typeof live?.quality?.requiredFactRecall === "number" ? `${Math.round(live.quality.requiredFactRecall * 100)}%` : graded ? `${passed}/${graded}` : "—"}</strong><p>{typeof live?.quality?.unsupportedClaimRate === "number" ? `${Math.round((live.quality.citationCompleteness ?? 0) * 100)}% claims cited · ${Math.round(live.quality.unsupportedClaimRate * 100)}% unsupported` : "Required facts are stored beside observed production answers; this is not universal correctness."}</p></article>
          <article><small>02 · CROSS-SOURCE</small><strong>{live?.connectors?.length ?? "—"}</strong><p>Distinct providers appear in the replayable benchmark receipt.</p></article>
          <article><small>03 · LATENCY</small><strong>{live?.latencyMs?.p50 ? `${(live.latencyMs.p50 / 1000).toFixed(2)}s` : "—"}</strong><p>P50 and p95 are measured on the deployed public target.</p></article>
          <article><small>04 · COST</small><strong>{averageCalls === null ? "—" : averageCalls.toFixed(1)}</strong><p>Average HydraDB calls per answer—not a vague efficiency claim.</p></article>
          <article><small>05 · REPRODUCIBILITY</small><strong>1 CMD</strong><p>The exact benchmark command is published with the results.</p></article>
          <article><small>06 · DEVELOPER EXPERIENCE</small><strong>3 SURFACES</strong><p>The same proof packet is available in web, API, and MCP.</p></article>
        </div>
      </section>

      {rows.length > 0 && <><div className="benchmark-filter" aria-label="Filter benchmark cases"><span><Search size={13} /> Case explorer</span>{(["all", "fast", "thinking"] as const).map((filter) => <button key={filter} className={modeFilter === filter ? "active" : ""} aria-pressed={modeFilter === filter} onClick={() => setModeFilter(filter)}>{filter === "all" ? "All modes" : filter}</button>)}</div><div className="benchmark-cases">
        {filteredRows.map((row, index) => <article className="benchmark-case" key={`${row.label}-${index}`}>
          <div className="case-index"><span>{String(index + 1).padStart(2, "0")}</span><i className={row.pass === false ? "fail" : "pass"} /></div>
          <div className="case-body"><span className="case-label">{row.label}</span><h3>{row.question}</h3>
            {row.expected && <div className="answer-compare"><div><small>EXPECTED</small><p>{row.expected}</p></div><div><small>OBSERVED</small><p>{row.actual || "No answer captured"}</p></div></div>}
            <div className="case-meta"><span><Zap size={12} />{row.mode}</span><span><Clock3 size={12} />{(row.latencyMs / 1000).toFixed(2)}s</span><span><Activity size={12} />{row.callCount ?? "—"} calls</span><span><FileCheck2 size={12} />{row.sources} receipts</span><span>{row.providers.join(" · ")}</span></div>
          </div>
          <span className={row.pass === false ? "case-status fail" : "case-status pass"}>{typeof row.pass === "boolean" ? row.pass ? "PASS" : "REVIEW" : "MEASURED"}</span>
        </article>)}
      </div></>}

      {router && <details className="fixture-diagnostics"><summary><Braces size={14} /> Offline router diagnostics · {(router.accuracy * 100).toFixed(1)}% mode match · {router.total} labelled cases</summary><div className="diagnostic-grid">{perCategory.map(([name, entry]) => <span key={name}><strong>{name}</strong><i>{entry.correct}/{entry.total}</i></span>)}</div><p>{data?.fixture?.caveat}</p></details>}

      <div className="reproduce-strip"><Terminal size={18} /><div><strong>Replay the receipt</strong><code>npm run benchmark:live -- --url https://queueproof.vercel.app</code></div><span>{dateLabel(live?.generatedAt ?? data?.generatedAt)}</span></div>
    </section>
  );
}

function PacketDrawer({ packet, onClose, onPropose }: { packet: Packet; onClose: () => void; onPropose: () => void }) {
  const dialogRef = useDialogBehavior<HTMLElement>(true, onClose);
  return <div className="drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside ref={dialogRef} className="packet-drawer" role="dialog" aria-modal="true" aria-labelledby="execution-packet-title" tabIndex={-1}><button type="button" className="modal-close" data-dialog-initial aria-label="Close execution packet" onClick={onClose}><X size={16} /></button><div className="drawer-head"><span className="eyebrow"><FileCheck2 size={13} /> Execution packet</span><code>{packet.packet_id}</code><h2 id="execution-packet-title">{packet.task.title}</h2><p>{packet.task.objective}</p></div><div className="drawer-score"><strong>{packet.task.priority_score}</strong><span>{band(packet.task.priority_score)} priority<br />{Math.round(packet.task.confidence * 100)}% confidence</span></div>{packet.score_breakdown && <div className="score-receipt"><div className="list-title"><span><Activity size={14} /> Score receipt</span><small>{packet.policy_version}</small></div>{Object.entries(packet.score_breakdown).map(([label, value]) => <span key={label}><small>{label.replace(/([A-Z])/g, " $1")}</small><i style={{ width: `${Math.min(value * 4, 100)}%` }} /><strong>+{value}</strong></span>)}{Object.entries(packet.penalties ?? {}).filter(([, value]) => value > 0).map(([label, value]) => <span className="penalty" key={label}><small>{label.replace(/([A-Z])/g, " $1")}</small><i style={{ width: `${Math.min(value * 4, 100)}%` }} /><strong>−{value}</strong></span>)}{packet.active_formula && <code>{packet.active_formula}</code>}</div>}<PacketSection title="Why now" items={packet.why_now} /><div className="packet-columns"><PacketSection title="Constraints" items={packet.constraints} empty="None evidenced" /><PacketSection title="Dependencies" items={packet.dependencies} empty="None evidenced" /></div><PacketSection title="Acceptance criteria" items={packet.acceptance_criteria} /><div className="packet-section"><h3>Evidence receipts <span>{packet.evidence.length}</span></h3>{packet.evidence.map((item, index) => <EvidenceCard key={item.sourceId ?? index} evidence={item} index={index} />)}</div><WhyAboveSection why={packet.why_above_next} /><PacketSection title="Missing information" items={packet.missing_information} empty="No missing fields" /><ReceiptHashBlock hash={packet.receipt_hash} /><div className="permission-block"><LockKeyhole size={16} /><div><strong>Agent permissions</strong><span>Read: {packet.permissions.read.join(", ") || "none"} · Write: {packet.permissions.write.join(", ") || "none"} · Approval {packet.permissions.approval_required ? "required" : "not required"}</span></div></div><div className="drawer-actions"><button type="button" className="primary-button" onClick={onPropose}><ShieldCheck size={14} /> Send to approval</button><button type="button" className="secondary-button" onClick={() => void navigator.clipboard.writeText(JSON.stringify(packet, null, 2))}><Clipboard size={14} /> Copy canonical JSON</button></div></aside></div>;
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
