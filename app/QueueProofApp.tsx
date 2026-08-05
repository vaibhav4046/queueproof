"use client";

import {
  Activity, ArrowRight, Bot, Braces, Check, ChevronRight, CircleAlert, CircleCheck, Clock3,
  Clipboard, Command, Database, Download, ExternalLink, Eye, FileCheck2, FileText, KeyRound,
  History, Link2, LoaderCircle, LockKeyhole, MoreHorizontal, Network, Play, Plus,
  Pause, Radio, RefreshCw, RotateCcw, Search, ShieldCheck, Sparkles, StepForward, Terminal,
  Unplug, UploadCloud, X as LucideX, Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SiGithub, SiGmail, SiLinear, SiSlack } from "react-icons/si";
import { ComponentProps, FormEvent, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import type { WorkspaceView } from "../lib/server/workspace-state";
import type { EvidenceGraph as EvidenceGraphData } from "../packages/graph/src";
import type { LiveProofState } from "../packages/contracts/src";
import EvidenceGraphView from "./components/EvidenceGraph";
import { EvidenceOrb } from "./components/EvidenceOrb";
import { QueueProofLogo, QueueProofSymbol } from "./components/QueueProofLogo";

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
type RecentInvestigation = {
  id: string;
  question: string;
  createdAt: string;
  status: AskData["validation"]["status"];
  providers: string[];
};
export type ActiveTab = "command" | "ask" | "sources" | "lab" | "replay" | "approvals" | "agent";

/** The only view in which the main application shell renders. */
type ReadyView = Extract<WorkspaceView, { kind: "ready" }>;

const workspaceNav = [
  { id: "ask", label: "Ask", mobileLabel: "Ask", icon: Search },
  { id: "command", label: "Today", mobileLabel: "Today", icon: Command },
  { id: "sources", label: "Sources", mobileLabel: "Sources", icon: Link2 },
  { id: "replay", label: "History", mobileLabel: "History", icon: History },
  { id: "approvals", label: "Review changes", mobileLabel: "Review", icon: ShieldCheck },
] as const;

const trustNav = [
  { id: "lab", label: "Benchmarks", icon: Activity },
] as const;

const useAnywhereNav = [
  { id: "agent", label: "Use with AI", mobileLabel: "AI setup", icon: Bot },
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

const allNav = [...workspaceNav, ...useAnywhereNav, ...trustNav] as const;
const mobileNav = workspaceNav.filter(({ id }) => id !== "approvals");
const RECENT_INVESTIGATIONS_KEY = "queueproof.recent-investigations.v1";

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
  // `text` is "" for an empty body, which is not nullish, so ?? would hand the UI a
  // blank error banner on any bodyless failure (gateway 502, 504, dropped upstream).
  if (!response.ok) throw new Error(data?.error?.trim() || text.trim() || `Request failed (${response.status}).`);
  if (!data) throw new Error("QueueProof returned an empty response.");
  return data;
}

function dateLabel(value?: string | null) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(parsed)
    : value;
}

function band(score: number) {
  return score >= 80 ? "Critical" : score >= 60 ? "High" : score >= 35 ? "Normal" : "Low";
}

function compactScore(value: number) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);
}

/**
 * The command palette and the composer both accept Meta *or* Control, so the hint
 * must name the key the visitor actually has. A hard-coded ⌘ told every Windows and
 * Linux judge to press a key that is not on their keyboard.
 *
 * Rendered as "Ctrl" first so server and client markup agree, then upgraded after
 * mount on Apple platforms.
 *
 * The platform never changes for the lifetime of the page, so the store never emits.
 * These three callbacks are module-level constants because useSyncExternalStore
 * resubscribes whenever the subscribe identity changes.
 */
const subscribeToNothing = () => () => {};
const readApplePlatform = () => /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
const readServerPlatform = () => false;

/** @see subscribeToNothing */
function useShortcutModifier(): { symbol: string; spoken: string } {
  const apple = useSyncExternalStore(subscribeToNothing, readApplePlatform, readServerPlatform);
  return apple ? { symbol: "⌘", spoken: "Command" } : { symbol: "Ctrl", spoken: "Control" };
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

    const focusInitial = () => {
      const target = dialog.querySelector<HTMLElement>("[data-dialog-initial]") ?? focusable()[0] ?? dialog;
      target.focus({ preventScroll: true });
    };
    // Focus once immediately and once on the next frame. Async dialogs can mount while
    // their invoking row is still re-rendering; the second pass keeps that update from
    // dropping keyboard focus back onto <body>.
    focusInitial();
    const recoverFocus = () => {
      if (openDialogIds.at(-1) === dialogId && !dialog.contains(document.activeElement)) {
        focusInitial();
      }
    };
    const frame = window.requestAnimationFrame(recoverFocus);
    const recoveryTimers = [250, 750].map((delay) => window.setTimeout(recoverFocus, delay));
    const onFocusIn = (event: FocusEvent) => {
      if (openDialogIds.at(-1) !== dialogId) return;
      if (event.target instanceof Node && !dialog.contains(event.target)) recoverFocus();
    };
    // React can replace the currently focused control while an async proof payload
    // resolves. Browsers then fall back to <body> without emitting a new focusin event.
    // Observe only the open dialog so that replacement is repaired without polling.
    const focusObserver = new MutationObserver(recoverFocus);
    focusObserver.observe(dialog, { childList: true, subtree: true });
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
      focusObserver.disconnect();
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
  // Server evidence is the initial truth. A later refresh may update it, but a failed
  // refresh must never make verified sources briefly disappear from the interface.
  const [connectors, setConnectors] = useState<Connector[]>(() =>
    initialView?.kind === "ready" ? initialView.evidence.connectors : [],
  );
  const [connectorsLoaded, setConnectorsLoaded] = useState(() => initialView?.kind === "ready");
  const [queue, setQueue] = useState<QueueData>(() =>
    initialView?.kind === "ready"
      ? (initialView.queue as unknown as QueueData)
      : { generatedAt: null, items: [] },
  );
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const [proposalPacket, setProposalPacket] = useState<Packet | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const workspaceId = view?.kind === "ready" ? view.workspace.id : null;
  const shortcut = useShortcutModifier();

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
    if (payload.view.kind === "ready") setQueue(payload.view.queue as unknown as QueueData);
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
    void api<{ connectors: Connector[] }>("/api/connectors")
      .then((connectorData) => { if (!active) return; setConnectors(connectorData.connectors); setConnectorsLoaded(true); })
      .catch((reason: Error) => { if (active) { setConnectorsLoaded(true); setError(reason instanceof Error ? reason.message : "Connectors failed to load."); } });
    void api<QueueData>("/api/queue")
      .then((queueData) => { if (active) setQueue(queueData); })
      .catch(() => { /* server-rendered queue already present; keep it */ });
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
      setNotice(`Built ${data.items.length} cited task brief${data.items.length === 1 ? "" : "s"} from your sources.`);
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
    <div className="qp-app" data-active-tab={tab} data-design-system="ember-assistant-v1">
      <aside className="app-header app-sidebar" aria-label="QueueProof workspace">
        <Link className="brand" href="/" aria-label="QueueProof home">
          <QueueProofLogo className="queueproof-logo" />
        </Link>
        <Link className="new-investigation" href="/">
          <Plus size={16} /><span>New investigation</span>
        </Link>
        <nav aria-label="Primary navigation">
          <span className="sidebar-label">Workspace</span>
          {workspaceNav.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return <Link key={id} href={routeForTab[id]} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              {active && <motion.span className="nav-lamp" layoutId="desktop-nav-lamp" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <Icon size={15} /><span>{label}</span>
            </Link>;
          })}
          <span className="sidebar-label sidebar-label-spaced">Use anywhere</span>
          {useAnywhereNav.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return <Link key={id} href={routeForTab[id]} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              {active && <motion.span className="nav-lamp" layoutId="desktop-nav-lamp" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <Icon size={15} /><span>{label}</span>
            </Link>;
          })}
          <span className="sidebar-label sidebar-label-spaced">Trust</span>
          {trustNav.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return <Link key={id} href={routeForTab[id]} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              {active && <motion.span className="nav-lamp" layoutId="desktop-nav-lamp" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <Icon size={15} /><span>{label}</span>
            </Link>;
          })}
        </nav>
        <div className="header-status sidebar-bottom">
          <button className="command-trigger" onClick={() => setCommandOpen(true)} aria-label={`Open command palette (${shortcut.spoken} K)`}><Search size={14} /><kbd>{shortcut.symbol}K</kbd></button>
          <span className="demo-badge"><span className={verified.length ? "status-orb live" : "status-orb"} />{verified.length} verified</span>
          <details className="nav-menu utility-menu"><summary aria-label="Open help and developer menu"><MoreHorizontal size={17} /><span>More</span></summary><div className="nav-popover nav-popover-right"><Link href="/developer"><Bot size={15} />Use with AI</Link><Link href="/method"><Braces size={15} />How it works</Link></div></details>
        </div>
      </aside>
      <header className="mobile-header">
        <Link className="mobile-brand" href="/" aria-label="QueueProof home"><QueueProofSymbol /><span>QueueProof</span></Link>
        <span className="mobile-ready"><i className={verified.length ? "status-orb live" : "status-orb"} />{verified.length} verified</span>
      </header>
      <nav className="mobile-dock" aria-label="Mobile navigation">
        {mobileNav.map(({ id, label, mobileLabel, icon: Icon }) => (
          <Link key={`dock-${id}`} href={routeForTab[id]} className={tab === id ? "active" : ""} aria-label={label} aria-current={tab === id ? "page" : undefined}>
            <Icon size={17} aria-hidden="true" /><span>{mobileLabel}</span>
          </Link>
        ))}
        <button type="button" aria-label="Open all product pages" onClick={() => { setCommandQuery(""); setCommandOpen(true); }}><MoreHorizontal size={18} aria-hidden="true" /><span>More</span></button>
      </nav>

      <div className="app-workspace">
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
        {tab === "ask" && <AskScreen verified={verified} connectorsLoaded={connectorsLoaded} onOpenSources={() => navigateTab("sources")} onOpenLab={() => navigateTab("lab")} onOpenApprovals={() => navigateTab("approvals")} setError={setError} />}
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
      </div>
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
  const normalizedQuery = query.trim().toLowerCase();
  const groups = [
    { label: "Workspace", entries: workspaceNav },
    { label: "Use anywhere", entries: useAnywhereNav },
    { label: "Trust", entries: trustNav },
  ].map((group) => ({
    ...group,
    entries: group.entries.filter((entry) => entry.label.toLowerCase().includes(normalizedQuery)),
  })).filter((group) => group.entries.length > 0);
  const dialogRef = useDialogBehavior<HTMLDivElement>(true, onClose);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const mobileLayout = window.matchMedia("(max-width: 680px)").matches;
    if (!mobileLayout) inputRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      className="modal-layer command-layer"
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Navigate QueueProof"
        tabIndex={-1}
      >
        <div className="command-search">
          <Search size={17} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Go to a page…"
            aria-label="Search QueueProof pages"
          />
          <button
            type="button"
            className="command-close"
            data-dialog-initial
            onClick={onClose}
            aria-label="Close navigation menu"
          >
            <LucideX size={17} />
          </button>
        </div>
        <div className="command-results">
          {groups.map((group) => <section className="command-group" aria-label={group.label} key={group.label}>
            <h2>{group.label}</h2>
            {group.entries.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => onNavigate(id)}>
                <Icon size={16} />
                <span>{label}</span>
                <ArrowRight size={13} />
              </button>
            ))}
          </section>)}
          {!normalizedQuery && <section className="command-group" aria-label="Help">
            <h2>Help</h2>
            <Link href="/method" onClick={onClose}><Braces size={16} /><span>How it works</span><ArrowRight size={13} /></Link>
          </section>}
        </div>
      </div>
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
        <h1>Open your workspace.</h1>
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
        <h1>Create your workspace.</h1>
        <p>One private place for your connected sources, daily priorities, answer history, and AI access.</p>
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
        <div><span className="eyebrow"><Sparkles size={13} /> Your day</span>
          <h1>What matters<br /><em>today.</em></h1>
          <p>A short, evidence-backed list of incidents, promises, deadlines, and work that needs a human decision.</p>
        </div>
        <div className="heading-actions">
          <span className="source-proof"><span className={verified.length ? "status-orb live" : "status-orb"} />{verified.length} verified</span>
          <button className="primary-button" onClick={verified.length ? onGenerate : onOpenSources} disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={15} /> : verified.length ? <RefreshCw size={15} /> : <Plus size={15} />}
            {verified.length ? (queue.items.length ? "Refresh today" : "Build my day") : "Connect a source"}
          </button>
        </div>
      </div>

      {!queue.items.length ? (
        <div className="empty-command">
          <div className="radar"><Search size={28} /><i /><i /><i /></div>
          <div><span className="eyebrow">Nothing invented</span>
            <h2>{verified.length ? "Your sources are verified." : "Connect a source to build your day."}</h2>
            <p>{verified.length ? "Build a focused list from real promises, blockers, deadlines, incidents, and customer risk." : "QueueProof needs Slack, Gmail, Linear, or another work source before it can tell you what matters."}</p>
          </div>
        </div>
      ) : (
        <div className="command-grid">
          <button className="hero-packet" onClick={() => onSelectPacket(first.packet)}>
            <span className="packet-serial">FIRST UP / {first.packetId.slice(-8).toUpperCase()}</span>
            <span className={`priority-band band-${band(first.finalScore).toLowerCase()}`}>{band(first.finalScore)}</span>
            <strong className="hero-score">{first.finalScore}<small>/100</small></strong>
            <h2>{first.title}</h2>
            <p>{first.packet.task?.objective ?? first.title}</p>
            <div className="packet-facts"><span><small>OWNER</small>{first.owner || "Needs assignment"}</span><span><small>DEADLINE</small>{dateLabel(first.deadline)}</span><span><small>CONFIDENCE</small>{Math.round((first.packet.task?.confidence ?? first.confidence) * 100)}%</span></div>
            <span className="open-proof">Open action plan <ArrowRight size={14} /></span>
          </button>
          <div className="queue-list">
            <div className="list-title queue-toolbar"><span><Command size={14} /> What comes next</span><label>Sort<select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)} aria-label="Sort priority queue"><option value="score">Priority</option><option value="confidence">Confidence</option><option value="deadline">Deadline</option><option value="newest">Newest</option></select></label></div>
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
      <div className="method-strip"><span><ShieldCheck size={14} /> Ready sources only</span><span><Braces size={14} /> Clear ranking rules</span><span><FileCheck2 size={14} /> Same action plan in web and MCP</span></div>
    </section>
  );
}

const FLAGSHIP_QUESTION = "Who escalated the AuthShield outage, what did engineering commit to, and is the fix already merged?";
const starterPrompts = [
  { label: "Start my day", prompt: "What needs my attention today, and why?" },
  { label: "Rebuild an incident", prompt: FLAGSHIP_QUESTION },
  { label: "Check a promise", prompt: "Which promise to Northwind has no issue tracking it?" },
  { label: "Find a disagreement", prompt: "Which sources disagree about the billing migration deadline?" },
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

function AskScreen({ verified, connectorsLoaded, onOpenSources, onOpenLab, onOpenApprovals, setError }: {
  verified: Connector[]; connectorsLoaded: boolean; onOpenSources: () => void; onOpenLab: () => void; onOpenApprovals: () => void; setError: (value: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [mode, setMode] = useState<"auto" | "fast" | "thinking">("auto");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AskData | null>(null);
  const [turns, setTurns] = useState<Array<{ question: string; result: AskData }>>([]);
  const [citationPreview, setCitationPreview] = useState<{ evidence: Evidence; index: number } | null>(null);
  const shortcut = useShortcutModifier();
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
  const questionRef = useRef<HTMLTextAreaElement>(null);
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
        const restoredQuestion = storedResult.question ?? "Saved investigation";
        setSubmittedQuestion(restoredQuestion);
        setTurns([{ question: restoredQuestion, result: storedResult }]);
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
      setTurns((current) => [...current.filter((turn) => turn.result.retrieval_receipt.query_id !== data.retrieval_receipt.query_id), { question: nextQuestion, result: data }].slice(-8));
      rememberInvestigation(data, nextQuestion);
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
  const currentRunId = result?.retrieval_receipt.query_id;
  const priorTurns = turns
    .filter((turn) => turn.result.retrieval_receipt.query_id !== currentRunId)
    .slice(-4);

  return (
    <section className="screen ask-screen proof-screen">
      <header className="ask-intro">
        <EvidenceOrb state={busy ? "searching" : result ? resultTone === "grounded" ? "answered" : "partial" : verifiedCount ? "ready" : "idle"} size={result ? "compact" : "hero"} />
        <div className="ask-copy">
          <span className="eyebrow"><Sparkles size={13} /> Evidence for your work</span>
          <h1>Ask your work.<br /><em>Get the proof.</em></h1>
          <p>Ask across your work. Every supported claim links to the exact proof.</p>
        </div>
      </header>
      <div className="proof-hero">
        <div className="proof-copy">
          <span className="eyebrow"><Radio size={13} /> Live · HydraDB evidence control plane</span>
          <h2><span>One answer.</span><br /><em>Every system.</em><br /><span className="outline-word">Proven.</span></h2>
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
              <button type="button" className="primary-button proof-hero-cta" onClick={() => questionRef.current?.focus()}><Play size={14} fill="currentColor" /> Prove it live <ArrowRight size={13} /></button>
              <button type="button" className="secondary-button" onClick={onOpenLab}>See measured results</button>
            </div>
          </div>
        </div>
      </div>
      <form className="ask-console premium-console" onSubmit={submit}>
        <div className="console-line">
          <button type="button" className="console-source-status" onClick={onOpenSources} aria-label={connectorsLoaded ? `Open ${verifiedCount} verified sources` : "Open sources"}>
            <span className={verifiedCount ? "status-orb live" : connectorsLoaded ? "status-orb" : "status-orb indexing"} />
            {connectorsLoaded ? `${verifiedCount} verified sources` : "Checking your sources"}
            <ArrowRight size={12} aria-hidden="true" />
          </button>
          <div className="mode-control">
            {(["fast", "auto", "thinking"] as const).map((value) => {
              const label = value === "auto" ? "Best" : value === "thinking" ? "Investigate" : "Quick";
              const description = value === "auto" ? "Best chooses the smallest sufficient search" : value === "thinking" ? "Investigate adds one bounded evidence follow-up" : "Quick checks direct facts";
              return <button key={value} type="button" className={mode === value ? "mode active" : "mode"} aria-label={`${label}: ${description}`} title={description} aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>;
            })}
          </div>
        </div>
        <p className="mode-explainer">{mode === "auto" ? "Best chooses the smallest search that can prove the answer." : mode === "thinking" ? "Investigate keeps a quick baseline, then follows the strongest evidence once." : "Quick checks direct facts with the lowest retrieval cost."}</p>
        <div className="typing-cue"><Sparkles size={13} /><span>Ask what happened, what changed, or what to do next.</span></div>
        <label className="sr-only" htmlFor="proof-question">Cross-source proof question</label>
        <textarea ref={questionRef} id="proof-question" value={question} onChange={(event) => setQuestion(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void run(); } }} placeholder="Ask what happened, what changed, or what to do next…" required maxLength={4000} />
        <div className="prompt-actions">
          <span>{shortcut.symbol} Enter</span>
          <button
            type={verifiedCount ? "submit" : "button"}
            className="primary-button proof-button"
            disabled={!connectorsLoaded || busy || (verifiedCount > 0 && !question.trim())}
            onClick={verifiedCount || !connectorsLoaded ? undefined : onOpenSources}
          >
            {busy || !connectorsLoaded ? <LoaderCircle className="spin" size={15} /> : verifiedCount ? <ArrowRight size={15} /> : <Link2 size={15} />}
            {!connectorsLoaded ? "Checking sources" : !verifiedCount ? "Connect a source" : busy ? "Finding the answer" : "Ask QueueProof"}
          </button>
        </div>
      </form>

      {!result && !busy && <>
        {verifiedCount > 0 && <div className="prompt-shelf" aria-label="Start an investigation">
          {starterPrompts.map(({ label, prompt }) => <button key={label} disabled={!connectorsLoaded || !verifiedCount} onClick={() => { setQuestion(prompt); void run(prompt); }} aria-label={`${label}: ${prompt}`}><span>{label}</span><small>{prompt}</small><ArrowRight size={13} /></button>)}
        </div>}
        <div className="proof-trustline" aria-label="QueueProof safeguards">
          <span><CircleCheck size={14} /> Open the source behind every claim</span>
          <span><CircleAlert size={14} /> See where your tools disagree</span>
          <span><LockKeyhole size={14} /> You approve every change</span>
        </div>
      </>}

      {!result && !busy && turns.length === 0 && <section className="landing-proof-sections" aria-label="QueueProof product overview">
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
            <button type="button" className="secondary-button" onClick={() => { setQuestion("Who escalated the AuthShield outage, what did engineering commit to, and is the fix already merged?"); questionRef.current?.focus(); }}>Load this investigation</button>
          </article>
          <article className="difficult-questions-card">
            <span className="eyebrow">Built for difficult questions</span>
            <ul><li>Timeline reasoning</li><li>Cross-source identity</li><li>Updated information</li><li>Thread understanding</li><li>Multi-hop retrieval</li></ul>
            <p>Quick handles direct facts. Investigate keeps that grounded baseline, then adds one bounded evidence follow-up when the question requires it.</p>
          </article>
        </div>
        <div className="measured-cta">
          <div><span className="eyebrow">Measured, not claimed</span><h2>Failures stay visible.</h2><p>Expected facts, observed answers, citation support, latency, HydraDB calls, mode, and relative cost live together in the benchmark receipt.</p></div>
          <div><a className="primary-button" href="/demo">Ask QueueProof <ArrowRight size={13} /></a><a className="secondary-button" href="/benchmarks">Inspect the benchmark</a><a className="text-link" href="/method">How proof works</a></div>
        </div>
      </section>}

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

      {priorTurns.length > 0 && <section className="investigation-thread" aria-labelledby="investigation-thread-title">
        <div className="thread-heading">
          <div><span className="eyebrow">This investigation</span><h2 id="investigation-thread-title">Earlier answers</h2></div>
          <span>{priorTurns.length} previous</span>
        </div>
        <ol>
          {priorTurns.map((turn) => <li key={turn.result.retrieval_receipt.query_id}>
            <p><small>YOU</small>{turn.question}</p>
            <div><small>QUEUEPROOF</small><CitedAnswer text={turn.result.answer} citations={turn.result.citations} onOpen={(evidence, index) => setCitationPreview({ evidence, index })} /></div>
            <span className={turn.result.validation.status}><ShieldCheck size={12} />{turn.result.validation.citedClaimCount}/{turn.result.validation.claimCount} claims cited</span>
          </li>)}
        </ol>
      </section>}

      {busy && <div ref={stageRef} className="retrieval-stage" role="status" aria-live="polite" tabIndex={-1}>
        <div className="stage-track"><i /><i /><i /><i /></div>
        <div><strong>Looking across your work.</strong><span>{mode === "thinking" ? "Investigating deeply" : mode === "fast" ? "Running a quick check" : "Choosing the best route"} · checking {verified.map((connector) => connector.provider).join(", ")} · unsupported claims stay out</span></div>
        <button type="button" className="secondary-button retrieval-cancel" onClick={cancelRun}>Stop</button>
      </div>}

      {result && <p className="sr-only" role="status" aria-live="polite">Answer ready with {result.validation.citedClaimCount} cited claim{result.validation.citedClaimCount === 1 ? "" : "s"}.</p>}
      {result && <div ref={resultRef} className={`ask-results premium-results ${resultTone}`} tabIndex={-1}>
        <div className="result-telemetry">
          <span>{resultTone === "grounded" ? <ShieldCheck size={14} /> : <CircleAlert size={14} />}{resultTone === "grounded" ? "Answer proven" : resultTone === "partial" ? "Needs more evidence" : "Answer withheld"}</span>
          <span><Network size={14} />{result.validation.providerCoverage.length} provider{result.validation.providerCoverage.length === 1 ? "" : "s"} cited</span>
          <span><Clock3 size={14} />{(result.trace.latencyMs / 1000).toFixed(2)}s</span>
          <span><Zap size={14} />{result.trace.mode === "thinking" ? "Investigate" : result.trace.mode}</span>
        </div>
        <article className={`answer-surface ${resultTone}`}>
          <div className="answer-kicker"><span>{resultTone === "abstained" ? "INSUFFICIENT EVIDENCE" : resultTone === "partial" ? "PARTIAL EVIDENCE" : "GROUNDED ANSWER"}</span><button className="copy-id" onClick={() => void navigator.clipboard.writeText(result.retrieval_receipt.query_id)} title="Copy query receipt ID" aria-label="Copy query receipt ID"><code>{result.retrieval_receipt.query_id.slice(-8)}</code><Clipboard size={12} /></button></div>
          <p className="result-question"><small>QUESTION</small>{result.question ?? submittedQuestion}</p>
          <h2><CitedAnswer text={result.answer} citations={result.citations} onOpen={(evidence, index) => setCitationPreview({ evidence, index })} /></h2>
          <div className="answer-verdict">{resultTone === "grounded" ? <CircleCheck size={17} /> : <CircleAlert size={17} />}<span><strong>{result.validation.citedClaimCount}/{result.validation.claimCount} claims cited</strong> · {resultTone === "abstained" ? "no unsupported answer was generated" : resultTone === "partial" ? "supported claims are shown, but evidence gaps remain" : "unsupported prose is blocked"}</span></div>
          <div className="answer-actions" aria-label="Continue this investigation">
            <button type="button" className="primary-button" onClick={() => { setQuestion(""); window.requestAnimationFrame(() => { questionRef.current?.focus(); questionRef.current?.scrollIntoView({ block: "center", behavior: "smooth" }); }); }}><Search size={14} /> Ask a follow-up</button>
            <button type="button" className="secondary-button" onClick={() => document.getElementById("answer-sources")?.scrollIntoView({ block: "start", behavior: "smooth" })}><Eye size={14} /> Open receipts</button>
            <button type="button" className="secondary-button" onClick={onOpenApprovals}><ShieldCheck size={14} /> Prepare a change</button>
          </div>
        </article>

        {result.contradictions.length > 0 && <div className="contradiction-stack">
          {result.contradictions.map((item, index) => {
            const crossSource = new Set(item.providers.filter(Boolean)).size > 1;
            return <article key={`${item.summary}-${index}`}><CircleAlert size={18} /><div><span>{crossSource ? "SOURCES DISAGREE" : "TRACKING MISMATCH"}</span><strong>{item.summary}</strong><small>{item.providers.join(" ↔ ")} · source IDs {item.evidenceIds.map((id) => id.slice(0, 6)).join(", ")}</small></div></article>;
          })}
        </div>}

        {missingInformation.length > 0 && <section className={`missing-information ${resultTone}`} aria-labelledby="missing-information-title"><CircleAlert size={18} /><div><span>{resultTone === "abstained" ? "ANSWER WITHHELD" : "NOT ENOUGH PROOF YET"}</span><h3 id="missing-information-title">What is still missing</h3><ul>{missingInformation.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul></div></section>}

        <details className="technical-details">
          <summary><Activity size={14} /> Technical details <span>{result.trace.callCount} calls · {(result.trace.latencyMs / 1000).toFixed(2)}s</span></summary>
        <section className="evidence-strength" aria-labelledby="evidence-strength-title">
          <div className="result-heading"><div><span className="eyebrow">Proof checks</span><h3 id="evidence-strength-title">Five checks behind this answer.</h3></div></div>
          <div className="strength-grid">
            <span><small>PROVIDERS CITED</small><strong>{result.validation.providerCoverage.length} provider{result.validation.providerCoverage.length === 1 ? "" : "s"}</strong><em>{result.validation.providerCoverage.join(" · ") || "No providers cited"}</em></span>
            <span><small>FACTS WITH SOURCES</small><strong>{result.validation.citedClaimCount}/{result.validation.claimCount}</strong><em>claims linked to receipts</em></span>
            <span><small>TIMELINE</small><strong>{timelineEvidence.filter((item) => item.timestamp).length}/{timelineEvidence.length}</strong><em>receipts with timestamps</em></span>
            <span><small>NEXT STEP CONFIDENCE</small><strong>{result.priority_items[0] ? `${Math.round(result.priority_items[0].confidence * 100)}%` : "Not measured"}</strong><em>{result.priority_items[0]?.normalized_entity ?? "No proven next step"}</em></span>
            <span><small>DISAGREEMENTS</small><strong>{result.contradictions.length ? `${result.contradictions.length} to review` : "None found"}</strong><em>never hidden or merged</em></span>
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
          <span><small>CHECK USED</small><strong>{result.routing_reason}</strong></span>
          <span><small>LINKED RECORDS</small><strong>{result.retrieval_receipt.graph_usage ? "Used" : "Not needed"}</strong></span>
          <span><small>SOURCE RECEIPTS</small><strong>{result.retrieval_receipt.receipt_count}</strong></span>
          <span><small>RETRIEVAL UNITS</small><strong>{result.retrieval_receipt.estimated_cost_units}</strong></span>
        </div>
        <details className="trace-drawer"><summary><Terminal size={14} /> Raw run details <span>{result.trace.runId}</span></summary><pre>{JSON.stringify(result.trace, null, 2)}</pre></details>
        </details>

        {result.priority_items[0] && <article className="priority-result">
          <div className="priority-score"><small>NEXT SAFE ACTION</small><strong>{result.priority_items[0].score}</strong><span>/100</span></div>
          <div><span className="eyebrow"><Command size={12} /> Why this comes first</span><h3>{result.priority_items[0].title}</h3><p>{result.priority_items[0].recommended_next_safe_action}</p><div className="priority-meta"><span>{result.priority_items[0].provider_coverage.join(" · ")}</span><span>{Math.round(result.priority_items[0].confidence * 100)}% confidence</span><span>{result.priority_items[0].approval_required ? "You approve the change" : "Read only"}</span></div></div>
        </article>}

        <div className="result-heading" id="answer-sources"><div><span className="eyebrow">Open the proof</span><h3>Sources behind the answer.</h3></div><button className="secondary-button" onClick={onOpenLab}>Open benchmarks <ArrowRight size={13} /></button></div>
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
  const verifiedSourceCount = connectors.filter((item) => item.state === "data_verified").length;
  const attentionSourceCount = connectors.length - verifiedSourceCount;
  const indexedFileCount = workspace.evidence.documents.filter((item) => item.stage === "indexed").length;

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
    <div className="screen-heading"><div><span className="eyebrow"><Database size={13} /> Connected work</span><h1>Your sources.</h1><p>Search only verified records. Open a source to see its latest proof.</p></div>{workspace.hydradb.configured && !readOnly && <button className="primary-button" onClick={() => setSetupOpen(true)}><Plus size={15} /> Add source</button>}</div>
    {readOnly && <div className="inline-warning source-readonly"><Eye size={14} /><span>Every source and its proof is open here. Changing a connection is reserved to the workspace owner.</span></div>}
    {!workspace.hydradb.configured ? readOnly ? <div className="honest-empty"><LockKeyhole size={24} /><div><strong>Evidence configuration is owner-only.</strong><p>This public sandbox cannot accept credentials.</p></div></div> : <form className="hydra-setup" onSubmit={connectHydra}><div className="hydra-symbol"><Database size={29} /></div><div><span className="eyebrow">Step 1 · Evidence engine</span><h2>Attach your HydraDB account.</h2><p>Use a newly generated API key. QueueProof verifies it against the authenticated database endpoint, encrypts it with AES-GCM, and never returns it.</p><label>HydraDB API key<input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste new key" autoComplete="off" required minLength={12} /></label><button className="primary-button" disabled={busy === "hydra"}>{busy === "hydra" ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />} Verify and encrypt</button></div></form> : <>
      <div className="source-summary" aria-label="Source readiness summary">
        <span className="verified"><CircleCheck size={14} /><strong>{verifiedSourceCount}</strong> verified</span>
        <span className={attentionSourceCount ? "attention" : "clear"}><CircleAlert size={14} /><strong>{attentionSourceCount}</strong> attention</span>
        <span><FileCheck2 size={14} /><strong>{indexedFileCount}</strong> files</span>
        <small>Only verified sources support answers.</small>
      </div>
      {connectors.length ? <div className="connector-list">{[...connectors].sort((a, b) => Number(b.state === "data_verified") - Number(a.state === "data_verified")).map((connector) => <article className={`connector-row ${connector.state === "data_verified" ? "ready" : "needs-attention"}`} data-provider={connector.provider} key={connector.id}><span className="provider-glyph large"><ProviderIcon provider={connector.provider} size={19} /></span><div className="connector-identity"><strong>{connector.name}</strong><span>{connector.provider} · {connector.database}{connector.collection ? ` / ${connector.collection}` : ""}</span></div><div className="connector-state"><span className={connector.state === "data_verified" ? "status-orb live" : connector.state.includes("sync") ? "status-orb indexing" : "status-orb"} /><strong>{connector.state === "data_verified" ? "Verified" : "Needs reconnecting"}</strong><small>{connector.state === "data_verified" ? `${connector.canaryResultCount ?? 0} ${connector.canaryResultCount === 1 ? "item" : "items"} · proven ${dateLabel(connector.verifiedAt ?? connector.lastSuccessfulSyncAt)}` : "Kept out of answers until it works"}</small></div>{connector.state === "data_verified" ? <button className="secondary-button" onClick={(event) => void connectorAction(connector, event.currentTarget)} disabled={busy === connector.id}>{busy === connector.id ? <LoaderCircle className="spin" size={14} /> : <Eye size={14} />}Details</button> : readOnly ? <button className="secondary-button" type="button" disabled title="Reconnecting a source is reserved to the workspace owner."><LockKeyhole size={14} /> Owner action</button> : <button className="secondary-button" onClick={(event) => void connectorAction(connector, event.currentTarget)} disabled={busy === connector.id}>{busy === connector.id ? <LoaderCircle className="spin" size={14} /> : connector.state === "connector_created" || connector.state === "resources_discovered" ? <Search size={14} /> : <RefreshCw size={14} />}{connector.state === "connector_created" || connector.state === "resources_discovered" ? "Choose scope" : connector.state === "resources_selected" ? "Start sync" : "Reconnect"}</button>}</article>)}</div> : <div className="empty-source"><Unplug size={28} /><div><h2>No source connected yet.</h2><p>Add Slack, Gmail, Linear, or another source from the live catalogue.</p></div>{!readOnly && <button className="primary-button" onClick={() => setSetupOpen(true)}><Plus size={15} /> Add first source</button>}</div>}
      <DocumentsPanel initialDocuments={workspace.evidence.documents} databases={[...new Set(connectors.map((item) => item.database).filter(Boolean))]}
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

function DocumentsPanel({ initialDocuments, databases, setError, setNotice, readOnly }: {
  initialDocuments: DocumentRecord[]; databases: string[]; setError: (value: string) => void; setNotice: (value: string) => void;
  readOnly: boolean;
}) {
  const [documents, setDocuments] = useState<DocumentRecord[]>(initialDocuments);
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
    <div className="section-kicker"><span><FileText size={14} /> Files</span><small>PDF · Markdown · text · up to 25 MB</small></div>
    {readOnly && <div className="inline-warning"><LockKeyhole size={14} />Uploads are disabled in the public sandbox; the indexed document ledger remains readable.</div>}
    <div className="document-grid">
      <form className="upload-card" onSubmit={upload} onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); if (!readOnly) setFile(event.dataTransfer.files[0] ?? null); }}>
        <UploadCloud size={30} />
        <h2>Add a file to your answers.</h2>
        <p>QueueProof checks the file, skips exact duplicates, and shows when it is ready to search.</p>
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
        <div className="list-title"><span><ShieldCheck size={14} /> Uploaded files</span><button onClick={() => void load()}><RefreshCw size={12} /> Refresh</button></div>
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

  return <details className="document-panel relationship-disclosure">
    <summary><span><Network size={14} /> See relationship map</span><small>How sources connect to people, work, and decisions</small><ChevronRight size={15} /></summary>
    <div className="relationship-panel-body">
    {loading
      ? <div className="modal-loading" role="status"><LoaderCircle className="spin" /> Deriving evidence graph…</div>
      : graph
        ? <EvidenceGraphView graph={graph} />
        : <div className="honest-empty"><Network size={24} /><div><strong>No relationships yet.</strong><p>Ask QueueProof a question first, then check back here.</p></div></div>}
    </div>
  </details>;
}

function rememberInvestigation(result: AskData, fallbackQuestion: string) {
  try {
    const current = parseJson<RecentInvestigation[]>(window.localStorage.getItem(RECENT_INVESTIGATIONS_KEY) ?? "[]", []);
    const entry: RecentInvestigation = {
      id: result.retrieval_receipt.query_id,
      question: result.question ?? fallbackQuestion,
      createdAt: result.retrieval_receipt.timestamp ?? new Date().toISOString(),
      status: result.validation.status,
      providers: result.validation.providerCoverage,
    };
    const next = [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 24);
    window.localStorage.setItem(RECENT_INVESTIGATIONS_KEY, JSON.stringify(next));
  } catch {
    // History is a convenience layer; a disabled browser store never blocks the answer.
  }
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
  return (
    <div className="modal-layer source-proof-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside ref={dialogRef} className="modal-card proof-modal source-proof-sheet" role="dialog" aria-modal="true" aria-labelledby="connection-proof-title" tabIndex={-1}>
        <button type="button" className="modal-close" data-dialog-initial aria-label="Close connection details" onClick={onClose}><X size={17} /></button>
        <span className="provider-glyph proof-provider"><ProviderIcon provider={connector?.provider ?? "file"} size={20} /></span>
        <span className="eyebrow">Connection details</span>
        <h2 id="connection-proof-title">{connector?.name ?? "Connected source"}</h2>
        {verification ? <>
          <div className="proof-seal"><CircleCheck size={24} /><div><strong>Verified</strong><span>This source can be used in answers.</span></div></div>
          <dl className="connection-facts">
            <div><dt>Records proven</dt><dd>{String(verification.canaryResultCount ?? 0)}</dd></div>
            <div><dt>Last checked</dt><dd>{dateLabel(String(verification.verifiedAt ?? ""))}</dd></div>
            <div><dt>Provider</dt><dd>{connector?.provider ?? "Connected source"}</dd></div>
            <div><dt>Database</dt><dd>{connector?.database ?? "Not available"}</dd></div>
          </dl>
          <details className="trace-drawer connection-technical"><summary><Terminal size={14} /> Technical details <ChevronRight size={14} /></summary><div className="proof-grid"><div><small>Receipt fingerprint</small><code>{String(verification.cursorEvidenceHash ?? "Not available").slice(0, 24)}</code></div><div><small>Last successful sync</small><strong>{dateLabel(String(verification.lastSuccessfulSync ?? ""))}</strong></div><div><small>Reported problem</small><strong>{String(verification.failureReason ?? "None")}</strong></div></div><pre>{JSON.stringify(verification, null, 2)}</pre></details>
        </> : <>
          <p>Select only the spaces QueueProof should search. Sync starts after you save.</p>
          <div className="resource-picker">{resources.map((resource) => <label key={resource.id}><input type="checkbox" checked={selected.includes(resource.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, resource.id] : current.filter((id) => id !== resource.id))} /><span><strong>{resource.name}</strong><small>{resource.resourceType}</small></span><Check size={14} /></label>)}</div>
          <button type="button" className="primary-button" disabled={!selected.length || busy} onClick={() => void configure()}>{busy ? <LoaderCircle className="spin" size={15} /> : <Zap size={15} />} Save and start sync</button>
        </>}
      </aside>
    </div>
  );
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
  const [composerOpen, setComposerOpen] = useState(Boolean(seedPacket) && !readOnly);
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
    <div className="screen-heading"><div><span className="eyebrow"><ShieldCheck size={13} /> Review changes</span><h1>Nothing changes<br /><em>without your approval.</em></h1><p>QueueProof can prepare a Linear update from the evidence. You see the exact change and its sources before anything is sent.</p></div>{readOnly ? <button className="primary-button" type="button" disabled title="Preparing a change is reserved to the workspace owner."><Plus size={15} /> Prepare a change</button> : <button className="primary-button" onClick={() => setComposerOpen(true)}><Plus size={15} /> Prepare a change</button>}</div>
    {readOnly && <div className="inline-warning"><LockKeyhole size={14} /><span>Every proposed change and its exact payload is open here. Preparing, approving, and sending are reserved to the workspace owner.</span></div>}
    <div className="approval-stats"><div><small>WAITING FOR REVIEW</small><strong>{pending}</strong><span>nothing is sent automatically</span></div><div><small>COMPLETED</small><strong>{executed}</strong><span>confirmed by Linear</span></div><div><small>SAFETY</small><strong>Runs once</strong><span>repeats are blocked</span></div></div>
    <div className="approval-list">
      <div className="list-title"><span><LockKeyhole size={14} /> Proposed changes</span><button onClick={() => void load()}><RefreshCw size={12} /> Refresh</button></div>
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
      }) : <div className="honest-empty"><ShieldCheck size={24} /><div><strong>Nothing needs approval.</strong><p>Prepare a change here, or send one from a task brief.</p></div></div>}
    </div>

    {composerOpen && <div className="modal-layer" role="presentation"><form ref={composerDialogRef} className="modal-card action-composer" role="dialog" aria-modal="true" aria-labelledby="proposal-composer-title" tabIndex={-1} onSubmit={createProposal}><button type="button" className="modal-close" data-dialog-initial onClick={closeComposer} aria-label="Close proposal"><X size={16} /></button><span className="eyebrow"><Plus size={13} /> Linear issue draft</span><h2 id="proposal-composer-title">Prepare a Linear issue.</h2><p>This saves a draft for review. Nothing is sent to Linear until the owner approves the exact change.</p><div className="setup-form"><label>What should change?<textarea value={summary} onChange={(event) => setSummary(event.target.value)} required maxLength={4000} /></label><div className="two-cols"><label>Owner <small>optional</small><input value={owner} onChange={(event) => setOwner(event.target.value)} /></label><label>Deadline <small>optional</small><input value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label></div><label>Evidence receipt IDs<textarea value={evidenceIds} onChange={(event) => setEvidenceIds(event.target.value)} placeholder="One source ID per line" required /></label><div className="two-cols"><label>Linear team ID<input value={teamId} onChange={(event) => setTeamId(event.target.value)} placeholder="Required provider team UUID" required /></label><label>Linear project ID <small>optional</small><input value={projectId} onChange={(event) => setProjectId(event.target.value)} /></label></div><button className="primary-button" disabled={busy === "create" || !summary.trim() || !evidenceIds.trim() || !teamId.trim()}>{busy === "create" ? <LoaderCircle className="spin" size={14} /> : <ShieldCheck size={14} />} Save for review</button></div></form></div>}

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
  const load = useCallback(() => {
    if (readOnly) return Promise.resolve();
    return api<{ tokens: McpToken[] }>("/api/mcp-tokens").then((data) => setTokens(data.tokens));
  }, [readOnly]);
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
  const clientGuide = useMemo(() => {
    const environment = `PowerShell:  $env:QUEUEPROOF_MCP_TOKEN="<paste connection key>"\nmacOS/Linux: export QUEUEPROOF_MCP_TOKEN="<paste connection key>"`;
    const guides: Record<string, { name: string; file: string; note: string; config: string; environment?: string }> = {
      codex: {
        name: "Codex",
        file: "~/.codex/config.toml",
        environment,
        note: "Restart Codex, then open /mcp to confirm QueueProof is connected.",
        config: `[mcp_servers.queueproof]\nurl = "${endpoint}"\nbearer_token_env_var = "QUEUEPROOF_MCP_TOKEN"\ntool_timeout_sec = 60`,
      },
      claude: {
        name: "Claude Code",
        file: ".mcp.json",
        environment,
        note: "Run claude mcp list, then use /mcp inside Claude Code.",
        config: JSON.stringify({ mcpServers: { queueproof: { type: "http", url: endpoint, headers: { Authorization: "Bearer ${QUEUEPROOF_MCP_TOKEN}" }, timeout: 60000 } } }, null, 2),
      },
      kilo: {
        name: "Kilo Code",
        file: ".kilocode/mcp.json",
        environment,
        note: "Kilo reads the token from your environment and connects as a remote MCP server.",
        config: JSON.stringify({ mcp: { queueproof: { type: "remote", url: endpoint, headers: { Authorization: "Bearer {env:QUEUEPROOF_MCP_TOKEN}" }, enabled: true, timeout: 60000 } } }, null, 2),
      },
      generic: {
        name: "Any HTTP MCP client",
        file: "Client settings",
        note: "Use Streamable HTTP and send your QueueProof token as a Bearer authorization header.",
        config: JSON.stringify({ url: endpoint, transport: "streamable-http", headers: { Authorization: "Bearer <QUEUEPROOF_MCP_TOKEN>" } }, null, 2),
      },
    };
    return guides[clientType] ?? guides.generic;
  }, [clientType, endpoint]);

  return <section className="screen agent-screen connect-ai-screen">
    <div className="screen-heading"><div><span className="eyebrow"><Bot size={13} /> Works where you work</span><h1>Connect QueueProof<br /><em>to your AI.</em></h1><p>Ask QueueProof from Codex, Claude Code, Kilo Code, or any compatible MCP client. Read-only access is the default. You still approve every external change.</p></div></div>
    <div className="integration-promise"><span><Search size={17} /><strong>Ask across your work</strong></span><ChevronRight size={14} /><span><FileCheck2 size={17} /><strong>Get sources and next actions</strong></span><ChevronRight size={14} /><span><ShieldCheck size={17} /><strong>Approve any change</strong></span></div>
    {readOnly && <div className="inline-warning"><LockKeyhole size={14} />Connection keys are owner-only. You can still inspect the exact setup for every supported client.</div>}
    <div className="client-tabs" role="tablist" aria-label="AI client">
      {[['codex', 'Codex'], ['claude', 'Claude Code'], ['kilo', 'Kilo Code'], ['generic', 'Generic MCP']].map(([value, label]) => <button type="button" role="tab" aria-selected={clientType === value} className={clientType === value ? "active" : ""} key={value} onClick={() => setClientType(value)}>{label}</button>)}
    </div>
    <div className="agent-grid">
      <div className="token-console">
        <div className="console-line"><span><KeyRound size={14} /> 1. Create a connection key</span><span className="secure-chip"><LockKeyhole size={12} /> stored as a hash</span></div>
        <label className="scope-choice"><input type="checkbox" checked={writeScopes} onChange={(event) => setWriteScopes(event.target.checked)} disabled={readOnly} /><span><strong>Let this client prepare actions and sync</strong><small>It still cannot execute a provider change without your approval.</small></span></label>
        {readOnly ? <button className="primary-button" type="button" disabled title="Minting a connection key is reserved to the workspace owner."><LockKeyhole size={15} /> Owner action</button> : <button className="primary-button" onClick={() => void createToken()} disabled={busy}>{busy ? <LoaderCircle className="spin" size={15} /> : <KeyRound size={15} />}Create connection</button>}
        {freshToken && <div className="token-reveal"><span><CircleAlert size={13} /> Copy this now. It is shown only once.</span><code>{freshToken}</code><button onClick={() => void navigator.clipboard.writeText(freshToken)}><Clipboard size={13} /> Copy key</button></div>}
      </div>
      <div className="config-card">
        {clientGuide.environment && <div className="config-environment"><div><small>2. SET THE CONNECTION KEY</small><button onClick={() => void navigator.clipboard.writeText(clientGuide.environment!)}><Clipboard size={13} /> Copy</button></div><pre>{clientGuide.environment}</pre></div>}
        <div className="list-title"><span><Braces size={14} /> {clientGuide.environment ? "3." : "2."} Add to {clientGuide.name}</span><button onClick={() => void navigator.clipboard.writeText(clientGuide.config)}><Clipboard size={13} /> Copy</button></div>
        <div className="config-file"><small>PUT THIS IN</small><code>{clientGuide.file}</code></div>
        <pre>{clientGuide.config}</pre>
        <p className="client-note">{clientGuide.note}</p>
      </div>
    </div>
    <div className="mcp-truth-note"><Sparkles size={16} /><div><strong>Using OmniRoute too?</strong><p>Add QueueProof beside it as a separate MCP server in the same client. QueueProof supplies evidence from your work; OmniRoute keeps its own routing role.</p></div></div>
    <div className="token-list"><div className="list-title"><span><ShieldCheck size={14} /> Connected clients</span><small>{workspace.workspace?.name}</small></div>{tokens.length ? tokens.map((token) => <div className="token-row" key={token.id}><span className={token.revokedAt ? "status-orb" : token.lastHandshakeAt ? "status-orb live" : "status-orb indexing"} /><div><strong>{token.clientType}</strong><small>{token.scopes.join(" · ")} · expires {dateLabel(token.expiresAt)}</small></div><span>{token.revokedAt ? "Revoked" : token.lastHandshakeAt ? `Connected ${dateLabel(token.lastHandshakeAt)}` : "Waiting for first connection"}</span>{!token.revokedAt && !readOnly && <button onClick={() => void revoke(token.id)}>Revoke</button>}</div>) : <div className="honest-empty"><Bot size={24} /><div><strong>No client connected yet.</strong><p>Create a key when you are ready to use QueueProof from another AI tool.</p></div></div>}</div>
  </section>;
}

type BenchmarkReplayRow = {
  id?: string; runId?: string; label: string; question: string; expected?: string; actual?: string;
  pass?: boolean; mode: string; latencyMs: number; callCount?: number; sources: number;
  providers: string[]; costUnits?: number;
};

type LabResults = {
  generatedAt?: string;
  currentRelease?: { commitSha?: string | null; commitRef?: string | null };
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
    release?: { commitSha?: string | null; commitRef?: string | null; deploymentUrl?: string | null };
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
  pdf?: {
    generatedAt?: string;
    target?: string;
    document?: { filename?: string; pages?: number; sha256?: string };
    cases?: number;
    passed?: number;
    canaries?: { beginning?: boolean; middle?: boolean; end?: boolean };
    latencyMs?: { p50?: number; p95?: number; min?: number; max?: number };
    calls?: { median?: number; mean?: number; min?: number; max?: number };
    quality?: {
      requiredFactAccuracy?: number;
      citationPrecision?: number;
      citationCompleteness?: number;
      unsupportedClaimRate?: number;
    };
    release?: { commitSha?: string | null; commitRef?: string | null; deploymentUrl?: string | null };
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
  const [recent, setRecent] = useState<RecentInvestigation[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setRecent(parseJson<RecentInvestigation[]>(window.localStorage.getItem(RECENT_INVESTIGATIONS_KEY) ?? "[]", []));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
    { label: "Router decision", value: `${selected.mode === "thinking" ? "Investigate" : "Quick"} mode selected` },
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

  function removeRecent(id: string) {
    const next = recent.filter((item) => item.id !== id);
    setRecent(next);
    window.localStorage.setItem(RECENT_INVESTIGATIONS_KEY, JSON.stringify(next));
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
    <div className="screen-heading"><div><span className="eyebrow"><History size={13} /> Saved on this device</span><h1>Your history.</h1><p>Open a past answer with its original receipt link, continue investigating, or share the exact run with a teammate.</p></div><Link className="primary-button" href="/"><Plus size={14} /> New investigation</Link></div>
    <section className="recent-investigations" aria-labelledby="recent-investigations-title">
      <div className="list-title"><span id="recent-investigations-title"><History size={14} /> Recent questions</span><small>{recent.length}</small></div>
      {recent.length ? recent.map((item) => <article key={item.id}>
        <Link href={`/?run=${encodeURIComponent(item.id)}`}><span><strong>{item.question}</strong><small>{dateLabel(item.createdAt)} · {item.providers.join(" · ") || "No source coverage"}</small></span><span className={`history-status ${item.status}`}>{item.status}</span><ArrowRight size={14} /></Link>
        <button type="button" aria-label={`Copy link for ${item.question}`} onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/?run=${encodeURIComponent(item.id)}`)}><Link2 size={13} /></button>
        <button type="button" aria-label={`Remove ${item.question} from history`} onClick={() => removeRecent(item.id)}><X size={13} /></button>
      </article>) : <div className="honest-empty compact-empty"><History size={22} /><div><strong>No questions here yet.</strong><p>Ask QueueProof once and the receipt link will appear here.</p></div></div>}
    </section>
    <details className="benchmark-replays">
      <summary><span><FileCheck2 size={14} /> Recorded proof-test replays</span><small>Judge and engineering evidence</small><ChevronRight size={14} /></summary>
      <div className="benchmark-replay-body">
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
      </div>
    </details>
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
  const pdf = data?.pdf;
  const rows = live?.rows ?? [];
  const filteredRows = modeFilter === "all" ? rows : rows.filter((row) => row.mode === modeFilter);
  const passed = rows.filter((row) => row.pass === true).length;
  const graded = rows.filter((row) => typeof row.pass === "boolean").length;
  const averageCalls = rows.some((row) => typeof row.callCount === "number")
    ? rows.reduce((total, row) => total + (row.callCount ?? 0), 0) / Math.max(rows.length, 1)
    : null;
  const measuredReleaseSha = live?.release?.commitSha ?? comparison?.fast.release.commitSha ?? null;
  const currentReleaseSha = data?.currentRelease?.commitSha ?? null;
  const artifactMatchesRelease = Boolean(measuredReleaseSha && currentReleaseSha && measuredReleaseSha === currentReleaseSha);
  const benchmarkRunAt = live?.generatedAt ?? data?.generatedAt ?? null;
  const benchmarkRunState = artifactMatchesRelease ? "Current results" : measuredReleaseSha ? "Previous results" : "No current results";
  const benchmarkRunTitle = measuredReleaseSha ? `Benchmark run ${measuredReleaseSha.slice(0, 8)}` : "Run the live benchmark";
  const benchmarkRunSummary = artifactMatchesRelease
    ? "These results were recorded against this deployed release."
    : measuredReleaseSha
      ? "These results belong to a different release. Run the published command again to measure this deployment."
      : "Run the published command to measure this deployment. Until then, the live metrics stay empty.";
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

      {!loading && data && <div className="artifact-identity" role="status">
        <span className={artifactMatchesRelease ? "artifact-state current" : "artifact-state"}>{artifactMatchesRelease ? <CircleCheck size={13} /> : <History size={13} />}{benchmarkRunState}</span>
        <div><strong>{benchmarkRunTitle}</strong><small>{benchmarkRunAt ? `Run ${dateLabel(benchmarkRunAt)}` : "No live run recorded yet"}{currentReleaseSha && measuredReleaseSha && !artifactMatchesRelease ? ` · deployed release ${currentReleaseSha.slice(0, 8)}` : ""}</small></div>
        <p>{benchmarkRunSummary}</p>
      </div>}

      {loading && <p className="muted">Loading evaluation results…</p>}
      {!loading && live?.status !== "measured" && <div className="inline-warning"><CircleAlert size={14} />{live?.note ?? "Strict production benchmark evidence is not available yet."}</div>}

      <div className="lab-summary premium-metrics">
        <div className="lab-metric primary"><small>LIVE CASES</small><strong>{rows.length || live?.cases || "—"}</strong><span>{graded ? `${passed}/${graded} strict source checks passed` : "production cross-source runs"}</span></div>
        <div className="lab-metric"><small>P50 LATENCY</small><strong>{live?.latencyMs?.p50 ? `${(live.latencyMs.p50 / 1000).toFixed(2)}s` : "—"}</strong><span>p95 {live?.latencyMs?.p95 ? `${(live.latencyMs.p95 / 1000).toFixed(2)}s` : "not recorded"}</span></div>
        <div className="lab-metric"><small>PROVIDER PROOF</small><strong>{live?.connectors?.length ?? "—"}</strong><span>{live?.connectors?.join(" · ") || "not recorded"}</span></div>
        <div className="lab-metric"><small>CALL EFFICIENCY</small><strong>{averageCalls === null ? "—" : averageCalls.toFixed(1)}</strong><span>average HydraDB calls per answer</span></div>
      </div>

      <section className="mode-comparison" aria-labelledby="mode-comparison-title">
        <div className="mode-comparison-heading">
          <div><span className="eyebrow"><Zap size={13} /> Quick versus Investigate</span><h2 id="mode-comparison-title">Use more reasoning only when it earns its cost.</h2></div>
          <span className={comparison?.comparable ? "comparison-status measured" : "comparison-status"}>{comparison?.comparable ? <CircleCheck size={14} /> : <CircleAlert size={14} />}{comparison?.comparable ? "Measured" : "Not yet comparable"}</span>
        </div>
        {comparison?.comparable ? <>
          <div className="mode-comparison-grid">
            {(["fast", "thinking"] as const).map((key) => {
              const summary = comparison[key];
              return <article key={key}><span>{key === "fast" ? "QUICK" : "INVESTIGATE"}</span><strong>{summary.passed}/{summary.cases} passed</strong><div><small>P50</small><b>{summary.p50LatencyMs === null ? "—" : `${(summary.p50LatencyMs / 1000).toFixed(2)}s`}</b></div><div><small>AVG CALLS</small><b>{summary.meanCalls === null ? "—" : summary.meanCalls.toFixed(1)}</b></div><div><small>COST UNITS</small><b>{summary.totalCostUnits ?? "—"}</b></div></article>;
            })}
          </div>
          <p className="comparison-note">{comparison.note}{comparison.deltas?.thinkingToFastP50LatencyRatio ? ` Investigate used ${comparison.deltas.thinkingToFastP50LatencyRatio.toFixed(1)}× the Quick p50 latency on this frozen set.` : ""}</p>
          {comparison.rows.length > 0 && <details className="comparison-cases"><summary>Compare all {comparison.rows.length} matched cases</summary><div>{comparison.rows.map((row) => <span key={row.id}><strong>{row.label}</strong><small>Quick {row.fast.pass ? "pass" : "review"} · {row.fast.latencyMs === null ? "—" : `${(row.fast.latencyMs / 1000).toFixed(2)}s`}</small><small>Investigate {row.thinking.pass ? "pass" : "review"} · {row.thinking.latencyMs === null ? "—" : `${(row.thinking.latencyMs / 1000).toFixed(2)}s`}</small></span>)}</div></details>}
        </> : <div className="comparison-empty"><div><strong>The comparison has not been claimed.</strong><p>{comparison?.note ?? "Run the same frozen questions in both modes against one verified release."}</p></div><code>npm run benchmark:live -- --mode fast</code><code>npm run benchmark:live -- --mode thinking</code></div>}
      </section>

      {pdf?.document?.pages && <section className="pdf-proof" aria-labelledby="pdf-proof-title">
        <div className="pdf-proof-heading">
          <div><span className="eyebrow"><FileCheck2 size={13} /> Large-document proof</span><h2 id="pdf-proof-title">{pdf.document.pages} pages. Facts tested from beginning to end.</h2><p>A fixed, SHA-256 identified handbook is queried with the same strict grader. Failures remain REVIEW, never silently converted to passes.</p></div>
          <span className={(pdf.passed ?? 0) === (pdf.cases ?? -1) ? "readiness-seal ready" : "readiness-seal"}>{pdf.passed ?? "—"}/{pdf.cases ?? "—"} passed</span>
        </div>
        <div className="pdf-proof-grid">
          <article><small>DOCUMENT</small><strong>{pdf.document.pages} pages</strong><span>{pdf.document.filename ?? "Measured PDF"}</span></article>
          <article><small>REQUIRED FACTS</small><strong>{typeof pdf.quality?.requiredFactAccuracy === "number" ? `${Math.round(pdf.quality.requiredFactAccuracy * 100)}%` : "—"}</strong><span>strict fact match</span></article>
          <article><small>CITATIONS</small><strong>{typeof pdf.quality?.citationCompleteness === "number" ? `${Math.round(pdf.quality.citationCompleteness * 100)}%` : "—"}</strong><span>{typeof pdf.quality?.unsupportedClaimRate === "number" ? `${Math.round(pdf.quality.unsupportedClaimRate * 100)}% unsupported` : "not recorded"}</span></article>
          <article><small>LATENCY</small><strong>{pdf.latencyMs?.p50 ? `${(pdf.latencyMs.p50 / 1000).toFixed(2)}s` : "—"}</strong><span>p95 {pdf.latencyMs?.p95 ? `${(pdf.latencyMs.p95 / 1000).toFixed(2)}s` : "not recorded"}</span></article>
        </div>
        <div className="pdf-proof-footer"><span><CircleCheck size={13} /> Position checks: {pdf.canaries?.beginning && pdf.canaries?.middle && pdf.canaries?.end ? "beginning · middle · end passed" : "incomplete"}</span><code>SHA-256 {pdf.document.sha256?.slice(0, 16) ?? "not recorded"}…</code><code>npm run benchmark:pdf -- --url https://queueproof.vercel.app</code></div>
      </section>}

      <section className="judge-lens" aria-label="Hackathon judging evidence">
        <div className="judge-lens-heading"><div><span className="eyebrow"><ShieldCheck size={13} /> Judge lens</span><h2>Every scoring claim has a receipt.</h2></div><span className={benchmarkGatesMet ? "readiness-seal ready" : "readiness-seal"}>{benchmarkGatesMet ? <CircleCheck size={15} /> : <Activity size={15} />} {benchmarkGatesMet ? "BENCHMARK GATES MET" : "EVIDENCE BUILDING"}</span></div>
        <div className="judge-proof-grid">
          <article><small>01 · REQUIRED FACTS</small><strong>{typeof live?.quality?.requiredFactRecall === "number" ? `${Math.round(live.quality.requiredFactRecall * 100)}%` : graded ? `${passed}/${graded}` : "—"}</strong><p>{typeof live?.quality?.unsupportedClaimRate === "number" ? `${Math.round((live.quality.citationCompleteness ?? 0) * 100)}% claims cited · ${Math.round(live.quality.unsupportedClaimRate * 100)}% unsupported` : "Required facts are stored beside observed production answers; this is not universal correctness."}</p></article>
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
  return <div className="drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside ref={dialogRef} className="packet-drawer" role="dialog" aria-modal="true" aria-labelledby="execution-packet-title" tabIndex={-1}><button type="button" className="modal-close" data-dialog-initial aria-label="Close task brief" onClick={onClose}><X size={16} /></button><div className="drawer-head"><span className="eyebrow"><FileCheck2 size={13} /> Task brief</span><code>{packet.packet_id}</code><h2 id="execution-packet-title">{packet.task.title}</h2><p>{packet.task.objective}</p></div><div className="drawer-score"><strong>{compactScore(packet.task.priority_score)}</strong><span>{band(packet.task.priority_score)} priority<br />{Math.round(packet.task.confidence * 100)}% confidence</span></div>{packet.score_breakdown && <div className="score-receipt"><div className="list-title"><span><Activity size={14} /> Why it ranks here</span><small>{packet.policy_version}</small></div>{Object.entries(packet.score_breakdown).map(([label, value]) => <span key={label}><small>{label.replace(/([A-Z])/g, " $1")}</small><i style={{ width: `${Math.min(value * 4, 100)}%` }} /><strong>+{compactScore(value)}</strong></span>)}{Object.entries(packet.penalties ?? {}).filter(([, value]) => value > 0).map(([label, value]) => <span className="penalty" key={label}><small>{label.replace(/([A-Z])/g, " $1")}</small><i style={{ width: `${Math.min(value * 4, 100)}%` }} /><strong>−{compactScore(value)}</strong></span>)}{packet.active_formula && <code>{packet.active_formula}</code>}</div>}<PacketSection title="Why now" items={packet.why_now} /><div className="packet-columns"><PacketSection title="Limits" items={packet.constraints} empty="None found" /><PacketSection title="Depends on" items={packet.dependencies} empty="Nothing found" /></div><PacketSection title="Done when" items={packet.acceptance_criteria} /><div className="packet-section"><h3>Source receipts <span>{packet.evidence.length}</span></h3>{packet.evidence.map((item, index) => <EvidenceCard key={item.sourceId ?? index} evidence={item} index={index} />)}</div><WhyAboveSection why={packet.why_above_next} /><PacketSection title="Still missing" items={packet.missing_information} empty="Nothing missing" /><ReceiptHashBlock hash={packet.receipt_hash} /><div className="permission-block"><LockKeyhole size={16} /><div><strong>Agent access</strong><span>Read: {packet.permissions.read.join(", ") || "none"} · Write: {packet.permissions.write.join(", ") || "none"} · Your approval {packet.permissions.approval_required ? "required" : "not required"}</span></div></div><div className="drawer-actions"><button type="button" className="primary-button" onClick={onPropose}><ShieldCheck size={14} /> Send for review</button><button type="button" className="secondary-button" onClick={() => void navigator.clipboard.writeText(JSON.stringify(packet, null, 2))}><Clipboard size={14} /> Copy JSON</button></div></aside></div>;
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
      <h3>Why above #2<span>{why.scoreDelta > 0 ? `+${compactScore(why.scoreDelta)}` : compactScore(why.scoreDelta)}</span></h3>
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
