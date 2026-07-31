"use client";

import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  Check,
  ChevronRight,
  CircleCheck,
  Clipboard,
  Command,
  Database,
  ExternalLink,
  FileCheck2,
  Gauge,
  GitBranch,
  KeyRound,
  Layers3,
  Link2,
  Network,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal,
  TriangleAlert,
  X,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const FULL_APP_URL = "https://queueproof-control-plane.vaibhav09908.chatgpt.site";

type WorkspaceState = {
  actor: { displayName: string; localDevelopment: boolean };
  workspace: null | { id: string; name: string; slug: string; mode: string };
  hydradb: { configured: boolean; verifiedAt?: string | null; fingerprint?: string | null };
  platform?: { runtime: string; storageAvailable: boolean };
};

type CredentialField = {
  name: string;
  required?: boolean;
  title?: string;
  description?: string;
  type?: string;
  format?: string;
};

type Provider = {
  id: string;
  name: string;
  available: boolean;
  maturity: string | null;
  category: string | null;
  supportClass: string;
  credentialFields: CredentialField[];
  indexedObjectTypes: unknown[];
  contractHash: string;
};

type Connector = {
  id: string;
  hydradbConnectorId: string;
  provider: string;
  name: string;
  state: string;
  database: string;
  collection: string | null;
  verificationStage?: string | null;
  canaryResultCount?: number | null;
  verifiedAt?: string | null;
  lastSuccessfulSyncAt?: string | null;
  lastError?: string | null;
};

type Resource = { id: string; name: string; resourceType: string };

type QueryResult = {
  result: {
    sources: Array<{
      id: string;
      provider: string | null;
      title: string;
      timestamp: string | null;
      url: string | null;
    }>;
    chunks: Array<{
      sourceId: string;
      excerpt: string;
      relevancyScore: number;
      untrustedInstructionDetected: boolean;
      sourceTimestamp: string | null;
    }>;
  };
  trace: {
    runId: string;
    classification: string;
    plannedSteps: string[];
    actualSteps: string[];
    queryMode: string;
    resultCount: number;
    providerCoverage: string[];
    callCount: number;
    hydradbLatencyMs: number;
    endToEndLatencyMs: number;
    requestId: string | null;
  };
};

type MissionDraft = {
  mission: string;
  owner: string;
  outcome: string;
  impact: "contained" | "important" | "material" | "critical";
  urgency: "today" | "week" | "month" | "open";
  blockers: string;
  evidence: string;
};

type Contribution = { label: string; value: number; reason: string };

type RankedAction = {
  id: string;
  title: string;
  score: number;
  band: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  confidence: "HIGH" | "MEDIUM" | "LOW";
  contributions: Contribution[];
};

type MissionPlan = {
  actions: RankedAction[];
  generatedAt: string;
  inputs: MissionDraft;
  sources: QueryResult["result"]["sources"];
  trace: QueryResult["trace"] | null;
};

type ActiveTab = "command" | "sources" | "skills" | "system";

const initialMission: MissionDraft = {
  mission: "",
  owner: "",
  outcome: "",
  impact: "material",
  urgency: "today",
  blockers: "",
  evidence: "",
};

const impactScores: Record<MissionDraft["impact"], number> = {
  contained: 14,
  important: 24,
  material: 34,
  critical: 44,
};

const urgencyScores: Record<MissionDraft["urgency"], number> = {
  today: 26,
  week: 18,
  month: 9,
  open: 3,
};

const statusLabels: Record<string, string> = {
  connector_created: "Ready to discover",
  resources_discovered: "Resources found",
  resources_selected: "Ready to sync",
  initial_sync_requested: "Sync requested",
  sync_in_progress: "Syncing",
  data_verified: "Evidence verified",
  degraded: "Needs attention",
  failed: "Failed",
};

const tabs = [
  { id: "command", label: "Command", icon: Command },
  { id: "sources", label: "Sources", icon: Link2 },
  { id: "skills", label: "Skills", icon: Zap },
  { id: "system", label: "System", icon: Activity },
] as const;

const skillCards = [
  {
    title: "Priority adjudication",
    detail: "Scores impact, urgency, clarity, ownership, and dependencies with a visible formula.",
    icon: Gauge,
  },
  {
    title: "Evidence retrieval",
    detail: "Queries verified HydraDB sources when a durable workspace and connector are available.",
    icon: Search,
  },
  {
    title: "Dependency mapping",
    detail: "Turns explicit blockers into an execution sequence without inventing hidden context.",
    icon: GitBranch,
  },
  {
    title: "Execution packet",
    detail: "Produces a copyable next move, acceptance condition, ownership signal, and receipts.",
    icon: FileCheck2,
  },
] as const;

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed with status ${response.status}.`);
  return data;
}

const pause = (duration: number) => new Promise((resolve) => window.setTimeout(resolve, duration));

function buildMissionPlan(inputs: MissionDraft, sources: QueryResult["result"]["sources"] = [], trace: QueryResult["trace"] | null = null): MissionPlan {
  const rawActions = inputs.mission
    .split("\n")
    .map((value) => value.replace(/^[-*\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 8);

  const actions = rawActions.map((title, index) => {
    const blockerCount = inputs.blockers.split("\n").filter((value) => value.trim()).length;
    const clarity = title.length >= 28 ? 8 : title.length >= 14 ? 5 : 1;
    const contributions: Contribution[] = [
      { label: "Business impact", value: impactScores[inputs.impact], reason: `Marked ${inputs.impact} by you.` },
      { label: "Time pressure", value: urgencyScores[inputs.urgency], reason: `Horizon set to ${inputs.urgency}.` },
      { label: "Action clarity", value: clarity, reason: clarity >= 5 ? "The action is concrete enough to execute." : "The action is still terse." },
      { label: "Named owner", value: inputs.owner ? 7 : 0, reason: inputs.owner ? `Owner supplied: ${inputs.owner}.` : "No owner supplied." },
      { label: "Acceptance condition", value: inputs.outcome ? 8 : 0, reason: inputs.outcome ? "A successful outcome was supplied." : "No outcome supplied." },
      { label: "Dependency visibility", value: Math.min(7, blockerCount * 3), reason: blockerCount ? `${blockerCount} explicit blocker${blockerCount === 1 ? "" : "s"} supplied.` : "No blockers supplied." },
      { label: "Evidence note", value: inputs.evidence ? 6 : 0, reason: inputs.evidence ? "A direct evidence note was supplied." : "No direct evidence note supplied." },
      { label: "Queue order", value: -index * 3, reason: index ? "Later lines receive a small sequence penalty." : "First declared action receives no sequence penalty." },
    ];
    const score = Math.max(0, Math.min(100, contributions.reduce((sum, item) => sum + item.value, 0)));
    const filledSignals = [inputs.owner, inputs.outcome, inputs.blockers, inputs.evidence].filter(Boolean).length;
    return {
      id: `action-${index + 1}`,
      title,
      score,
      band: score >= 80 ? "CRITICAL" : score >= 60 ? "HIGH" : score >= 38 ? "NORMAL" : "LOW",
      confidence: filledSignals >= 3 ? "HIGH" : filledSignals >= 1 ? "MEDIUM" : "LOW",
      contributions,
    } satisfies RankedAction;
  });

  return {
    actions: actions.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)),
    generatedAt: new Date().toISOString(),
    inputs,
    sources,
    trace,
  };
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "QP";
}

function formatTime(value?: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function QueueProofApp({ testMode }: { testMode: boolean }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("command");
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [draft, setDraft] = useState<MissionDraft>(initialMission);
  const [plan, setPlan] = useState<MissionPlan | null>(null);
  const [phase, setPhase] = useState("");
  const [loading, setLoading] = useState("workspace");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showWorkspaceSetup, setShowWorkspaceSetup] = useState(false);
  const [showSourceSetup, setShowSourceSetup] = useState(false);
  const [showReceipt, setShowReceipt] = useState(true);
  const [copied, setCopied] = useState(false);

  const refreshWorkspace = useCallback(async () => {
    setLoading("workspace");
    setError(null);
    try {
      const state = await api<WorkspaceState>("/api/workspace");
      setWorkspaceState(state);
      if (state.workspace) {
        const result = await api<{ connectors: Connector[] }>("/api/connectors");
        setConnectors(result.connectors);
      }
      if (state.hydradb.configured) {
        const result = await api<{ providers: Provider[] }>("/api/providers");
        setProviders(result.providers);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "QueueProof could not load its control plane.");
    } finally {
      setLoading("");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshWorkspace]);

  const verifiedConnectors = useMemo(
    () => connectors.filter((connector) => connector.state === "data_verified"),
    [connectors],
  );
  const storageAvailable = workspaceState?.platform?.storageAvailable !== false;
  const agentMode = verifiedConnectors.length ? "EVIDENCE LINKED" : "LOCAL SESSION";

  const openTab = (tab: ActiveTab) => {
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const runMission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.mission.trim()) return;
    setError(null);
    setNotice(null);
    setPlan(null);
    setPhase("Reading the mission");
    await pause(220);
    setPhase("Mapping explicit dependencies");
    await pause(240);

    let queryResult: QueryResult | null = null;
    const connector = verifiedConnectors[0];
    if (connector) {
      setPhase("Retrieving verified evidence");
      try {
        queryResult = await api<QueryResult>("/api/query", {
          method: "POST",
          body: JSON.stringify({
            query: `Find current commitments, blockers, owners, and deadlines relevant to: ${draft.mission}`,
            database: connector.database,
            collections: connector.collection ? [connector.collection] : undefined,
            mode: "auto",
          }),
        });
      } catch (caught) {
        setNotice(`The packet was built from your explicit inputs. Connected retrieval was unavailable: ${caught instanceof Error ? caught.message : "unknown error"}`);
      }
    }

    setPhase("Applying visible priority policy");
    await pause(260);
    setPlan(buildMissionPlan(draft, queryResult?.result.sources ?? [], queryResult?.trace ?? null));
    setPhase("");
    setShowReceipt(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const copyPacket = async () => {
    if (!plan?.actions[0]) return;
    const top = plan.actions[0];
    const text = [
      `QUEUEPROOF EXECUTION PACKET`,
      `Next move: ${top.title}`,
      `Priority: ${top.band} (${top.score}/100)`,
      `Owner: ${plan.inputs.owner || "Unassigned"}`,
      `Success: ${plan.inputs.outcome || "Not supplied"}`,
      `Blockers: ${plan.inputs.blockers || "None supplied"}`,
      `Evidence: ${plan.inputs.evidence || "No direct note supplied"}`,
      `Source receipts: ${plan.sources.length}`,
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const execute = async (label: string, task: () => Promise<void>) => {
    setLoading(label);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The operation failed.");
    } finally {
      setLoading("");
    }
  };

  if (loading === "workspace" && !workspaceState) {
    return <BootScreen />;
  }

  return (
    <main className="qp-shell">
      {testMode && <div className="test-ribbon">TEST MODE — SYNTHETIC FIXTURES MAY BE PRESENT</div>}
      <div className="grain" aria-hidden="true" />
      <header className="topbar">
        <button className="wordmark" onClick={() => openTab("command")} aria-label="Open QueueProof command">
          <span className="wordmark-sigil"><ShieldCheck size={16} /></span>
          <span><strong>QUEUE</strong><em>PROOF</em></span>
        </button>
        <nav aria-label="Primary navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} className={activeTab === tab.id ? "topnav-item active" : "topnav-item"} onClick={() => openTab(tab.id)}>
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="topbar-status">
          <span className={verifiedConnectors.length ? "live-dot linked" : "live-dot"} />
          <span>{agentMode}</span>
          <span className="avatar">{initials(workspaceState?.actor.displayName ?? "QueueProof")}</span>
        </div>
      </header>

      {error && (
        <div className="message-strip error-message" role="alert">
          <TriangleAlert size={15} /><span>{error}</span><button onClick={() => setError(null)} aria-label="Dismiss error"><X size={14} /></button>
        </div>
      )}
      {notice && (
        <div className="message-strip notice-message">
          <Sparkles size={15} /><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss notice"><X size={14} /></button>
        </div>
      )}

      {activeTab === "command" && (
        <CommandView
          draft={draft}
          setDraft={setDraft}
          onSubmit={runMission}
          plan={plan}
          phase={phase}
          onReset={() => { setPlan(null); setDraft(initialMission); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          onCopy={copyPacket}
          copied={copied}
          showReceipt={showReceipt}
          setShowReceipt={setShowReceipt}
          linked={verifiedConnectors.length > 0}
          storageAvailable={storageAvailable}
          onSetup={() => storageAvailable ? setShowWorkspaceSetup(true) : undefined}
        />
      )}

      {activeTab === "sources" && (
        <SourcesView
          workspaceState={workspaceState}
          connectors={connectors}
          providers={providers}
          loading={loading}
          storageAvailable={storageAvailable}
          onWorkspaceSetup={() => setShowWorkspaceSetup(true)}
          onSourceSetup={() => setShowSourceSetup(true)}
          onRefresh={() => void refreshWorkspace()}
          execute={execute}
          setConnectors={setConnectors}
          setNotice={setNotice}
        />
      )}

      {activeTab === "skills" && <SkillsView linked={verifiedConnectors.length > 0} />}
      {activeTab === "system" && <SystemView workspaceState={workspaceState} connectors={connectors} onRefresh={() => void refreshWorkspace()} loading={loading} />}

      <footer className="site-footer">
        <span>QUEUEPROOF / DETERMINISTIC AGENT CONTROL</span>
        <span>NO HIDDEN SCORE · NO FABRICATED SOURCES · EVERY DECISION INSPECTABLE</span>
      </footer>

      {showWorkspaceSetup && workspaceState && (
        <WorkspaceSetup
          state={workspaceState}
          onClose={() => setShowWorkspaceSetup(false)}
          execute={execute}
          onDone={async () => { await refreshWorkspace(); setShowWorkspaceSetup(false); }}
        />
      )}

      {showSourceSetup && providers.length > 0 && (
        <SourceSetup
          providers={providers}
          onClose={() => setShowSourceSetup(false)}
          execute={execute}
          onDone={async () => { await refreshWorkspace(); setShowSourceSetup(false); }}
        />
      )}
    </main>
  );
}

function BootScreen() {
  return (
    <main className="boot-screen">
      <div className="boot-orbit"><ShieldCheck size={28} /></div>
      <div>
        <span className="mono-label">QUEUEPROOF / BOOT SEQUENCE</span>
        <h1>Reconstructing the control plane.</h1>
        <p>Checking runtime, workspace, and evidence links.</p>
      </div>
      <div className="boot-line"><span /></div>
    </main>
  );
}

function CommandView({
  draft,
  setDraft,
  onSubmit,
  plan,
  phase,
  onReset,
  onCopy,
  copied,
  showReceipt,
  setShowReceipt,
  linked,
  storageAvailable,
  onSetup,
}: {
  draft: MissionDraft;
  setDraft: (draft: MissionDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  plan: MissionPlan | null;
  phase: string;
  onReset: () => void;
  onCopy: () => void;
  copied: boolean;
  showReceipt: boolean;
  setShowReceipt: (value: boolean) => void;
  linked: boolean;
  storageAvailable: boolean;
  onSetup: () => void;
}) {
  if (phase) return <AgentLoading phase={phase} />;
  if (plan?.actions[0]) {
    return (
      <section className="result-stage">
        <div className="result-header">
          <div>
            <span className="mono-label">EXECUTION PACKET / {linked ? "VERIFIED CONTEXT" : "EXPLICIT INPUTS"}</span>
            <h1>One move. Fully explained.</h1>
          </div>
          <div className="result-actions">
            <button className="ghost-button" onClick={onReset}><RotateCcw size={15} /> New mission</button>
            <button className="acid-button" onClick={onCopy}>{copied ? <Check size={15} /> : <Clipboard size={15} />}{copied ? "Copied" : "Copy packet"}</button>
          </div>
        </div>

        <div className="execution-grid">
          <article className="next-move-card">
            <div className="card-serial">01 / NEXT MOVE</div>
            <div className="priority-glyph" aria-label={`Priority score ${plan.actions[0].score} out of 100`}>
              <span>{plan.actions[0].score}</span><small>/100</small>
            </div>
            <span className={`band band-${plan.actions[0].band.toLowerCase()}`}>{plan.actions[0].band}</span>
            <h2>{plan.actions[0].title}</h2>
            <div className="packet-meta">
              <div><span>OWNER</span><strong>{plan.inputs.owner || "Unassigned"}</strong></div>
              <div><span>HORIZON</span><strong>{plan.inputs.urgency}</strong></div>
              <div><span>CONFIDENCE</span><strong>{plan.actions[0].confidence}</strong></div>
            </div>
            <div className="success-contract">
              <Target size={18} />
              <div><span>ACCEPTANCE CONDITION</span><p>{plan.inputs.outcome || "Add a success condition before delegating this action."}</p></div>
            </div>
            <button className="receipt-toggle" onClick={() => setShowReceipt(!showReceipt)}>
              <ShieldCheck size={16} /> {showReceipt ? "Hide decision receipt" : "Why this first?"}<ChevronRight size={15} />
            </button>
          </article>

          <aside className={showReceipt ? "receipt-panel open" : "receipt-panel"}>
            <div className="receipt-heading">
              <div><span className="mono-label">DECISION RECEIPT</span><h3>Visible policy, no mystery math.</h3></div>
              <span className="hash-chip">QP-1.0</span>
            </div>
            <div className="score-stack">
              {plan.actions[0].contributions.map((item) => (
                <div className="score-row" key={item.label}>
                  <div><strong>{item.label}</strong><small>{item.reason}</small></div>
                  <span className={item.value < 0 ? "negative" : ""}>{item.value > 0 ? "+" : ""}{item.value}</span>
                </div>
              ))}
            </div>
            <div className="receipt-total"><span>DETERMINISTIC TOTAL</span><strong>{plan.actions[0].score}</strong></div>
            <p className="receipt-note">This score is derived only from fields you supplied. Connected sources add receipts, never hidden weight.</p>
          </aside>
        </div>

        <div className="lower-grid">
          <article className="queue-panel">
            <div className="section-heading"><span><Layers3 size={16} /> Ranked queue</span><small>{plan.actions.length} action{plan.actions.length === 1 ? "" : "s"}</small></div>
            {plan.actions.map((action, index) => (
              <div className="queue-row" key={action.id}>
                <span className="queue-index">{String(index + 1).padStart(2, "0")}</span>
                <div><strong>{action.title}</strong><small>{action.band} · {action.confidence} confidence</small></div>
                <span className="queue-score">{action.score}</span>
              </div>
            ))}
          </article>

          <article className="evidence-panel">
            <div className="section-heading"><span><Network size={16} /> Evidence receipts</span><small>{plan.sources.length} verified</small></div>
            {plan.sources.length ? plan.sources.slice(0, 4).map((source) => (
              <a className="source-row" key={source.id} href={source.url ?? undefined} target={source.url ? "_blank" : undefined} rel="noreferrer">
                <span className="source-icon"><FileCheck2 size={15} /></span>
                <div><strong>{source.title}</strong><small>{source.provider ?? "Source"} · {formatTime(source.timestamp)}</small></div>
                {source.url && <ArrowUpRight size={14} />}
              </a>
            )) : (
              <div className="honest-empty">
                <ShieldCheck size={22} />
                <div><strong>No connected receipts used.</strong><p>This packet is based only on what you entered. Connect a verified source to retrieve live workplace evidence.</p></div>
              </div>
            )}
            {plan.trace && <div className="trace-line"><Terminal size={13} /> Run {plan.trace.runId} · {plan.trace.resultCount} results · {plan.trace.endToEndLatencyMs}ms</div>}
          </article>
        </div>
      </section>
    );
  }

  return (
    <section className="hero-stage">
      <div className="hero-art" aria-hidden="true">
        <Image src="/queueproof-sentinel.webp" alt="" fill priority sizes="100vw" unoptimized />
        <div className="art-scan" />
        <div className="art-caption"><span>QP / SENTINEL 01</span><span>EVIDENCE IS A CONTROL SURFACE</span></div>
      </div>
      <div className="hero-copy">
        <div className="hero-kicker"><span className="pulse-dot" /> AUTONOMOUS PRIORITY + EXECUTION CONTROL</div>
        <h1><span>KNOW WHAT</span><span>MOVES NEXT.</span><em>PROVE WHY.</em></h1>
        <p>QueueProof reconstructs the work, exposes the ranking policy, and returns one defensible next action—with receipts.</p>
      </div>
      <form className="mission-console" onSubmit={onSubmit}>
        <div className="console-topline">
          <span><Bot size={15} /> QUEUEPROOF AGENT</span>
          <span className={linked ? "mode-pill linked" : "mode-pill"}>{linked ? "LIVE EVIDENCE" : "LOCAL / NO FABRICATION"}</span>
        </div>
        <label className="mission-field">
          <span>WHAT MUST MOVE?</span>
          <textarea
            value={draft.mission}
            onChange={(event) => setDraft({ ...draft, mission: event.target.value })}
            placeholder={"Ship the security review before Friday\nUnblock the enterprise renewal"}
            rows={3}
            autoFocus
            required
          />
          <small>One action per line. QueueProof ranks only what you actually enter.</small>
        </label>
        <div className="mission-fields-grid">
          <label><span>OWNER</span><input value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} placeholder="Name or team" /></label>
          <label><span>SUCCESS LOOKS LIKE</span><input value={draft.outcome} onChange={(event) => setDraft({ ...draft, outcome: event.target.value })} placeholder="Concrete acceptance condition" /></label>
          <label><span>IMPACT</span><select value={draft.impact} onChange={(event) => setDraft({ ...draft, impact: event.target.value as MissionDraft["impact"] })}><option value="contained">Contained</option><option value="important">Important</option><option value="material">Material</option><option value="critical">Critical</option></select></label>
          <label><span>HORIZON</span><select value={draft.urgency} onChange={(event) => setDraft({ ...draft, urgency: event.target.value as MissionDraft["urgency"] })}><option value="today">Today</option><option value="week">This week</option><option value="month">This month</option><option value="open">Open</option></select></label>
        </div>
        <details className="context-details">
          <summary><Plus size={14} /> Add blockers or a direct evidence note</summary>
          <div className="context-grid">
            <label><span>KNOWN BLOCKERS</span><textarea rows={2} value={draft.blockers} onChange={(event) => setDraft({ ...draft, blockers: event.target.value })} placeholder="One blocker per line" /></label>
            <label><span>DIRECT EVIDENCE</span><textarea rows={2} value={draft.evidence} onChange={(event) => setDraft({ ...draft, evidence: event.target.value })} placeholder="Link, quote, ticket, or commitment" /></label>
          </div>
        </details>
        <div className="console-actions">
          <span><ShieldCheck size={14} /> {linked ? "Verified source retrieval is active." : "No source claims will be invented."}</span>
          <button className="launch-button" type="submit" disabled={!draft.mission.trim()}><span>BUILD EXECUTION PACKET</span><ArrowRight size={17} /></button>
        </div>
      </form>
      <div className="hero-proofbar">
        <span><Check size={13} /> VISIBLE SCORING</span><span><Check size={13} /> SOURCE-LEVEL RECEIPTS</span><span><Check size={13} /> REVERSIBLE ACTIONS</span>
        {!storageAvailable && <a href={FULL_APP_URL} target="_blank" rel="noreferrer">OPEN DURABLE CONTROL PLANE <ExternalLink size={13} /></a>}
        {storageAvailable && !linked && <button onClick={onSetup}>CONNECT WORKSPACE <ArrowUpRight size={13} /></button>}
      </div>
    </section>
  );
}

function AgentLoading({ phase }: { phase: string }) {
  const phases = ["Reading the mission", "Mapping explicit dependencies", "Retrieving verified evidence", "Applying visible priority policy"];
  const activeIndex = Math.max(0, phases.indexOf(phase));
  return (
    <section className="agent-loading" aria-live="polite">
      <div className="loading-visual">
        <div className="loading-rings"><Bot size={32} /></div>
        <div className="loading-rays" />
      </div>
      <div className="loading-copy">
        <span className="mono-label">QUEUEPROOF / ACTIVE REASONING</span>
        <h1>{phase}<span className="typing-dots">...</span></h1>
        <p>The agent is applying a deterministic policy to explicit inputs. It will not invent progress or sources.</p>
        <div className="phase-list">
          {phases.filter((item) => item !== "Retrieving verified evidence" || phase === item).map((item, index) => (
            <div key={item} className={index < activeIndex ? "done" : index === activeIndex ? "active" : ""}>
              <span>{index < activeIndex ? <Check size={13} /> : String(index + 1).padStart(2, "0")}</span>{item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SourcesView({
  workspaceState,
  connectors,
  providers,
  loading,
  storageAvailable,
  onWorkspaceSetup,
  onSourceSetup,
  onRefresh,
  execute,
  setConnectors,
  setNotice,
}: {
  workspaceState: WorkspaceState | null;
  connectors: Connector[];
  providers: Provider[];
  loading: string;
  storageAvailable: boolean;
  onWorkspaceSetup: () => void;
  onSourceSetup: () => void;
  onRefresh: () => void;
  execute: (label: string, task: () => Promise<void>) => Promise<void>;
  setConnectors: (connectors: Connector[]) => void;
  setNotice: (notice: string | null) => void;
}) {
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceConnector, setResourceConnector] = useState<Connector | null>(null);
  const [selectedResources, setSelectedResources] = useState<Set<string>>(new Set());

  const reloadConnectors = async () => {
    const result = await api<{ connectors: Connector[] }>("/api/connectors");
    setConnectors(result.connectors);
  };

  const discover = (connector: Connector) => execute(`discover-${connector.id}`, async () => {
    const result = await api<{ resources: Resource[] }>(`/api/connectors/${connector.id}/discover`, { method: "POST", body: "{}" });
    setResources(result.resources);
    setResourceConnector(connector);
    setSelectedResources(new Set(result.resources.map((resource) => resource.id)));
    await reloadConnectors();
  });

  if (!storageAvailable) {
    return (
      <section className="page-stage source-landing">
        <PageHeading kicker="SOURCES / DURABLE MODE" title="Receipts need a real evidence plane." description="The Vercel interface can build local execution packets, but it does not pretend browser state is an authoritative workplace database." />
        <div className="gateway-card">
          <div className="gateway-art"><Database size={52} /><span /></div>
          <div><span className="mono-label">FULL CLOUD CONTROL PLANE</span><h2>Connect GitHub, Slack, Notion, Drive, and more through HydraDB.</h2><p>The durable deployment stores workspace configuration in D1, verifies real connector objects, and retrieves source-level receipts. No seeded production data.</p><a className="acid-button link-button" href={FULL_APP_URL} target="_blank" rel="noreferrer">OPEN SECURE WORKSPACE <ArrowUpRight size={15} /></a></div>
        </div>
      </section>
    );
  }

  if (!workspaceState?.workspace || !workspaceState.hydradb.configured) {
    return (
      <section className="page-stage source-landing">
        <PageHeading kicker="SOURCES / SETUP" title="Make every answer traceable." description="Create the durable workspace, verify your HydraDB account, then choose exactly which resources may enter the evidence plane." />
        <div className="setup-path">
          <div className={workspaceState?.workspace ? "setup-step complete" : "setup-step active"}><span>{workspaceState?.workspace ? <Check size={17} /> : "01"}</span><div><strong>Create workspace</strong><p>Isolates policy, secrets, connectors, and audit history.</p></div></div>
          <div className={workspaceState?.hydradb.configured ? "setup-step complete" : workspaceState?.workspace ? "setup-step active" : "setup-step"}><span>{workspaceState?.hydradb.configured ? <Check size={17} /> : "02"}</span><div><strong>Verify HydraDB</strong><p>The API key is checked server-side before encrypted storage.</p></div></div>
          <div className="setup-step"><span>03</span><div><strong>Select evidence</strong><p>Discover resources, request sync, and pass a live canary query.</p></div></div>
        </div>
        <button className="acid-button" onClick={onWorkspaceSetup}><KeyRound size={15} /> {workspaceState?.workspace ? "VERIFY HYDRADB" : "CREATE WORKSPACE"}</button>
      </section>
    );
  }

  return (
    <section className="page-stage">
      <PageHeading kicker="SOURCES / VERIFIED INGESTION" title="Your evidence perimeter." description="Every connector advances through discovery, explicit resource selection, sync, and a live canary query before QueueProof treats it as evidence." actions={<><button className="ghost-button" onClick={onRefresh} disabled={Boolean(loading)}><RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh</button><button className="acid-button" onClick={onSourceSetup} disabled={!providers.length}><Plus size={15} /> ADD SOURCE</button></>} />
      <div className="source-summary"><div><span>HYDRADB</span><strong><CircleCheck size={15} /> Verified</strong></div><div><span>CONTRACTS</span><strong>{providers.length} live</strong></div><div><span>CONNECTORS</span><strong>{connectors.length}</strong></div><div><span>EVIDENCE READY</span><strong>{connectors.filter((item) => item.state === "data_verified").length}</strong></div></div>
      <div className="connector-grid">
        {connectors.length ? connectors.map((connector) => (
          <article className="connector-card" key={connector.id}>
            <div className="connector-head"><span className="source-icon"><Database size={16} /></span><div><strong>{connector.name}</strong><small>{connector.provider} / {connector.database}</small></div><span className={`connector-state state-${connector.state}`}>{statusLabels[connector.state] ?? connector.state.replaceAll("_", " ")}</span></div>
            <div className="connector-rail"><span className="complete" /><span className={["resources_discovered", "resources_selected", "initial_sync_requested", "sync_in_progress", "data_verified"].includes(connector.state) ? "complete" : ""} /><span className={["initial_sync_requested", "sync_in_progress", "data_verified"].includes(connector.state) ? "complete" : ""} /><span className={connector.state === "data_verified" ? "complete" : ""} /></div>
            <div className="connector-meta"><span>Last verified</span><strong>{formatTime(connector.verifiedAt)}</strong></div>
            {connector.lastError && <p className="connector-error"><TriangleAlert size={13} /> {connector.lastError}</p>}
            <div className="connector-actions">
              {["connector_created", "resources_discovered", "degraded"].includes(connector.state) && <button onClick={() => void discover(connector)} disabled={loading === `discover-${connector.id}`}><Search size={14} /> {connector.state === "resources_discovered" ? "Select resources" : "Discover"}</button>}
              {connector.state === "resources_selected" && <button onClick={() => void execute(`sync-${connector.id}`, async () => { await api(`/api/connectors/${connector.id}/sync`, { method: "POST", body: "{}" }); await reloadConnectors(); setNotice("Sync requested. Verify after HydraDB has produced cursor evidence."); })}><Play size={14} /> Request sync</button>}
              {["initial_sync_requested", "sync_in_progress", "degraded"].includes(connector.state) && <button onClick={() => void execute(`verify-${connector.id}`, async () => { await api(`/api/connectors/${connector.id}/verify`, { method: "POST", body: "{}" }); await reloadConnectors(); setNotice("Live resource cursor and canary retrieval verified."); })}><ShieldCheck size={14} /> Verify live data</button>}
            </div>
          </article>
        )) : <div className="empty-connectors"><Link2 size={26} /><h3>No sources connected.</h3><p>Add a provider contract to start the verified ingestion path.</p><button className="acid-button" onClick={onSourceSetup}><Plus size={14} /> ADD FIRST SOURCE</button></div>}
      </div>
      {resourceConnector && (
        <div className="resource-drawer">
          <div className="drawer-heading"><div><span className="mono-label">RESOURCE SELECTION</span><h3>{resourceConnector.name}</h3></div><button onClick={() => setResourceConnector(null)} aria-label="Close resource selector"><X size={17} /></button></div>
          <p>Only selected resources will be indexed. Nothing is selected invisibly.</p>
          <div className="resource-list">{resources.map((resource) => <label key={resource.id}><input type="checkbox" checked={selectedResources.has(resource.id)} onChange={(event) => { const next = new Set(selectedResources); if (event.target.checked) next.add(resource.id); else next.delete(resource.id); setSelectedResources(next); }} /><span><strong>{resource.name}</strong><small>{resource.resourceType}</small></span></label>)}</div>
          <button className="acid-button" disabled={!selectedResources.size} onClick={() => void execute(`configure-${resourceConnector.id}`, async () => { await api(`/api/connectors/${resourceConnector.id}/configure`, { method: "POST", body: JSON.stringify({ resourceIds: [...selectedResources], lookbackDays: 30 }) }); await reloadConnectors(); setResourceConnector(null); setNotice(`${selectedResources.size} resource${selectedResources.size === 1 ? "" : "s"} selected. The connector is ready to sync.`); })}>CONFIRM {selectedResources.size} RESOURCE{selectedResources.size === 1 ? "" : "S"} <ArrowRight size={15} /></button>
        </div>
      )}
    </section>
  );
}

function SkillsView({ linked }: { linked: boolean }) {
  return (
    <section className="page-stage">
      <PageHeading kicker="SKILLS / PROCEDURAL CONTROL" title="Small tools. Visible boundaries." description="QueueProof’s capabilities are deliberately narrow: retrieve evidence, map dependencies, rank actions, and package the result. Every skill says what it can and cannot know." />
      <div className="skills-grid">{skillCards.map((skill, index) => { const Icon = skill.icon; return <article className="skill-card" key={skill.title}><span className="card-number">0{index + 1}</span><Icon size={24} /><h2>{skill.title}</h2><p>{skill.detail}</p><div><span className={skill.title === "Evidence retrieval" && !linked ? "skill-status waiting" : "skill-status"}>{skill.title === "Evidence retrieval" && !linked ? "NEEDS VERIFIED SOURCE" : "READY"}</span><ChevronRight size={15} /></div></article>; })}</div>
      <div className="principles-panel"><BrainCircuit size={30} /><div><span className="mono-label">AGENT CONSTITUTION</span><h2>Never turn uncertainty into theatre.</h2><p>QueueProof separates explicit user input, verified source evidence, and deterministic policy. Missing context stays missing. A local session never impersonates a connected system.</p></div></div>
    </section>
  );
}

function SystemView({ workspaceState, connectors, onRefresh, loading }: { workspaceState: WorkspaceState | null; connectors: Connector[]; onRefresh: () => void; loading: string }) {
  const checks = [
    { label: "Interface runtime", value: workspaceState?.platform?.runtime ?? "cloudflare", okay: true },
    { label: "Durable storage", value: workspaceState?.platform?.storageAvailable === false ? "Unavailable on this deployment" : "Available", okay: workspaceState?.platform?.storageAvailable !== false },
    { label: "Workspace", value: workspaceState?.workspace?.name ?? "Not configured", okay: Boolean(workspaceState?.workspace) },
    { label: "HydraDB account", value: workspaceState?.hydradb.configured ? `Verified ${workspaceState.hydradb.fingerprint ?? ""}` : "Not configured", okay: workspaceState?.hydradb.configured ?? false },
    { label: "Verified connectors", value: String(connectors.filter((item) => item.state === "data_verified").length), okay: connectors.some((item) => item.state === "data_verified") },
  ];
  return (
    <section className="page-stage">
      <PageHeading kicker="SYSTEM / TRUTH SURFACE" title="Operational state, without theatre." description="These indicators come from the current deployment and workspace. A missing dependency is shown as missing, not painted green." actions={<button className="ghost-button" onClick={onRefresh}><RefreshCw size={14} className={loading ? "spin" : ""} /> Run checks</button>} />
      <div className="system-layout"><div className="health-stack">{checks.map((check) => <div className="health-row" key={check.label}><span className={check.okay ? "health-icon okay" : "health-icon"}>{check.okay ? <Check size={15} /> : <TriangleAlert size={15} />}</span><div><strong>{check.label}</strong><small>{check.value}</small></div><span>{check.okay ? "PASS" : "OPEN"}</span></div>)}</div><aside className="system-aside"><Terminal size={25} /><span className="mono-label">MACHINE CONTRACT</span><h2>Designed to fail honestly.</h2><p>Durable state is authoritative. Credentials remain server-side. Connector readiness requires real object retrieval. Prompt-injection screening runs before retrieved chunks enter an answer.</p><a href="/api/health/live" target="_blank">OPEN LIVENESS ENDPOINT <ArrowUpRight size={13} /></a></aside></div>
    </section>
  );
}

function PageHeading({ kicker, title, description, actions }: { kicker: string; title: string; description: string; actions?: React.ReactNode }) {
  return <div className="page-heading"><div><span className="mono-label">{kicker}</span><h1>{title}</h1><p>{description}</p></div>{actions && <div className="heading-actions">{actions}</div>}</div>;
}

function WorkspaceSetup({ state, onClose, execute, onDone }: { state: WorkspaceState; onClose: () => void; execute: (label: string, task: () => Promise<void>) => Promise<void>; onDone: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.hydradb.com");
  const needsWorkspace = !state.workspace;
  return (
    <div className="modal-backdrop" role="presentation"><section className="setup-modal" role="dialog" aria-modal="true" aria-labelledby="workspace-setup-title"><div className="modal-top"><div><span className="mono-label">DURABLE CONTROL PLANE</span><h2 id="workspace-setup-title">{needsWorkspace ? "Create the workspace." : "Verify HydraDB."}</h2></div><button onClick={onClose} aria-label="Close setup"><X size={18} /></button></div>{needsWorkspace ? <form onSubmit={(event) => { event.preventDefault(); void execute("create-workspace", async () => { await api("/api/workspace", { method: "POST", body: JSON.stringify({ name }) }); await onDone(); }); }}><label><span>WORKSPACE NAME</span><input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} placeholder="Acme execution control" required /></label><p>Creates isolated durable storage for policies, encrypted credentials, connector state, and audit records.</p><button className="acid-button" type="submit">CREATE WORKSPACE <ArrowRight size={15} /></button></form> : <form onSubmit={(event) => { event.preventDefault(); void execute("verify-hydradb", async () => { await api("/api/hydradb/configure", { method: "POST", body: JSON.stringify({ apiKey, baseUrl }) }); setApiKey(""); await onDone(); }); }}><label><span>HYDRADB API KEY</span><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} minLength={12} autoComplete="off" placeholder="Paste a newly generated key" required /></label><label><span>BASE URL</span><input type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} required /></label><p>The credential is verified against the live provider contract before encrypted storage. It is never returned to the browser.</p><button className="acid-button" type="submit"><KeyRound size={15} /> VERIFY + STORE</button></form>}</section></div>
  );
}

function SourceSetup({ providers, onClose, execute, onDone }: { providers: Provider[]; onClose: () => void; execute: (label: string, task: () => Promise<void>) => Promise<void>; onDone: () => Promise<void> }) {
  const available = providers.filter((provider) => provider.available);
  const [providerId, setProviderId] = useState(available[0]?.id ?? providers[0]?.id ?? "");
  const [name, setName] = useState("");
  const [database, setDatabase] = useState("");
  const [collection, setCollection] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const provider = providers.find((item) => item.id === providerId) ?? providers[0];
  if (!provider) return null;
  return (
    <div className="modal-backdrop" role="presentation"><section className="setup-modal source-modal" role="dialog" aria-modal="true" aria-labelledby="source-setup-title"><div className="modal-top"><div><span className="mono-label">PROVIDER CONTRACT</span><h2 id="source-setup-title">Add a real evidence source.</h2></div><button onClick={onClose} aria-label="Close source setup"><X size={18} /></button></div><form onSubmit={(event) => { event.preventDefault(); void execute("create-connector", async () => { await api("/api/connectors", { method: "POST", body: JSON.stringify({ provider: provider.id, name: name || provider.name, database, collection: collection || undefined, credentials }) }); await onDone(); }); }}><label><span>PROVIDER</span><select value={provider.id} onChange={(event) => { setProviderId(event.target.value); setCredentials({}); }}>{providers.map((item) => <option value={item.id} key={item.id} disabled={!item.available}>{item.name}{item.available ? "" : " — unavailable"}</option>)}</select></label><div className="two-fields"><label><span>DISPLAY NAME</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={provider.name} /></label><label><span>HYDRADB DATABASE</span><input value={database} onChange={(event) => setDatabase(event.target.value)} required placeholder="workspace-main" /></label></div><label><span>COLLECTION (OPTIONAL)</span><input value={collection} onChange={(event) => setCollection(event.target.value)} placeholder="Leave blank for provider default" /></label>{provider.credentialFields.map((field) => <label key={field.name}><span>{field.title ?? field.name.toUpperCase()}{field.required ? " *" : ""}</span><input type={field.format === "password" || /token|secret|key/i.test(field.name) ? "password" : "text"} value={credentials[field.name] ?? ""} onChange={(event) => setCredentials({ ...credentials, [field.name]: event.target.value })} required={field.required} autoComplete="off" /><small>{field.description}</small></label>)}<div className="contract-note"><ShieldCheck size={15} /><span>Live contract · {provider.supportClass} · hash {provider.contractHash.slice(0, 10)}</span></div><button className="acid-button" type="submit">CREATE CONNECTOR <ArrowRight size={15} /></button></form></section></div>
  );
}
