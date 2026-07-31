"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Blocks,
  Bot,
  Brain,
  Check,
  ChevronRight,
  CircleDot,
  Command,
  Database,
  FileCheck2,
  GitBranch,
  History,
  KeyRound,
  Layers3,
  Link2,
  LoaderCircle,
  Network,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  X,
  Zap,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type WorkspaceState = {
  actor: { displayName: string; localDevelopment: boolean };
  workspace: null | { id: string; name: string; slug: string; mode: string };
  hydradb: { configured: boolean; verifiedAt?: string | null; fingerprint?: string | null };
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

const navItems = [
  { id: "command", label: "Command", icon: Command },
  { id: "ask", label: "Ask", icon: Sparkles },
  { id: "changes", label: "Changes", icon: History },
  { id: "graph", label: "Graph", icon: Network },
  { id: "commitments", label: "Commitments", icon: FileCheck2 },
  { id: "skills", label: "Skills", icon: Zap },
  { id: "memory", label: "Memory", icon: Brain },
  { id: "connectors", label: "Connectors", icon: Link2 },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "evaluations", label: "Evaluations", icon: Radar },
  { id: "audit", label: "Audit", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

const connectorStateLabels: Record<string, string> = {
  not_configured: "Not configured",
  credentials_submitted: "Credentials submitted",
  connector_created: "Connector created",
  resources_discovered: "Resources discovered",
  resources_selected: "Resources selected",
  initial_sync_requested: "Initial sync requested",
  sync_in_progress: "Sync in progress",
  data_verified: "Data verified",
  degraded: "Degraded",
  authentication_expired: "Authentication expired",
  permission_insufficient: "Permission insufficient",
  rate_limited: "Rate limited",
  failed: "Failed",
  deleted: "Deleted",
};

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

function humanState(value: string) {
  return connectorStateLabels[value] ?? value.replaceAll("_", " ");
}

function relativeTime(value?: string | null) {
  if (!value) return "No verified sync";
  const delta = Date.now() - new Date(value).getTime();
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return new Date(value).toLocaleDateString();
}

export function QueueProofApp({ testMode }: { testMode: boolean }) {
  const [active, setActive] = useState<(typeof navItems)[number]["id"]>("command");
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState | null>(null);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [selectedConnector, setSelectedConnector] = useState<Connector | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState("workspace");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);

  const refreshConnectors = useCallback(async () => {
    if (!workspaceState?.workspace) return;
    const result = await api<{ connectors: Connector[] }>("/api/connectors");
    setConnectors(result.connectors);
    setSelectedConnector((current) =>
      current ? result.connectors.find((connector) => connector.id === current.id) ?? null : null,
    );
  }, [workspaceState?.workspace]);

  const refreshProviders = useCallback(async () => {
    if (!workspaceState?.hydradb.configured) return;
    setLoading("providers");
    try {
      const result = await api<{ providers: Provider[] }>("/api/providers");
      setProviders(result.providers);
    } finally {
      setLoading("");
    }
  }, [workspaceState?.hydradb.configured]);

  const refreshWorkspace = useCallback(async () => {
    setLoading("workspace");
    try {
      const state = await api<WorkspaceState>("/api/workspace");
      setWorkspaceState(state);
      if (state.workspace) {
        const result = await api<{ connectors: Connector[] }>("/api/connectors");
        setConnectors(result.connectors);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "QueueProof could not load.");
    } finally {
      setLoading("");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshWorkspace]);

  useEffect(() => {
    if (!workspaceState?.hydradb.configured) return;
    const timer = window.setTimeout(() => void refreshProviders(), 0);
    return () => window.clearTimeout(timer);
  }, [workspaceState?.hydradb.configured, refreshProviders]);

  const verifiedConnectors = useMemo(
    () => connectors.filter((connector) => connector.state === "data_verified"),
    [connectors],
  );

  const execute = async (label: string, task: () => Promise<void>) => {
    setError(null);
    setNotice(null);
    setLoading(label);
    try {
      await task();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The operation failed.");
    } finally {
      setLoading("");
    }
  };

  if (loading === "workspace" && !workspaceState) {
    return (
      <main className="boot-shell">
        <div className="brand-mark large"><span>QP</span></div>
        <div className="boot-copy">
          <span className="eyebrow">QUEUEPROOF / CONTROL PLANE</span>
          <h1>Establishing a trusted workspace</h1>
          <p>No fixture data is loaded. QueueProof is checking durable workspace state.</p>
        </div>
        <div className="signal-loader" aria-label="Loading workspace">
          <i /><i /><i /><i />
        </div>
      </main>
    );
  }

  return (
    <div className="app-frame">
      {testMode && (
        <div className="test-banner" role="alert">
          TEST FIXTURES — isolated developer mode is active
        </div>
      )}
      <header className="status-bar">
        <button className="brand-lockup" onClick={() => setActive("command")} aria-label="QueueProof command">
          <span className="brand-mark"><span>QP</span></span>
          <span>
            <strong>QUEUEPROOF</strong>
            <small>Execution control plane</small>
          </span>
        </button>
        <div className="workspace-chip">
          <span className={workspaceState?.workspace ? "status-orb live" : "status-orb"} />
          <span>{workspaceState?.workspace?.name ?? "Workspace not created"}</span>
        </div>
        <div className="status-actions">
          <span className="quiet-status">
            <Database size={14} />
            {workspaceState?.hydradb.configured ? "HydraDB secured" : "HydraDB disconnected"}
          </span>
          <button className="icon-button" aria-label="Search or command palette">
            <Search size={17} />
            <kbd>⌘ K</kbd>
          </button>
          <span className="avatar" title={workspaceState?.actor.displayName}>{
            workspaceState?.actor.displayName?.slice(0, 2).toUpperCase() ?? "QP"
          }</span>
        </div>
      </header>

      <aside className="nav-rail" aria-label="Primary navigation">
        <nav>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={active === item.id ? "nav-item active" : "nav-item"}
                onClick={() => setActive(item.id)}
                title={item.label}
                aria-label={item.label}
                aria-current={active === item.id ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.65} />
                <span>{item.label}</span>
                {active === item.id && <motion.i layoutId="active-nav" />}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="workspace-main">
        {error && (
          <div className="global-message error" role="alert">
            <AlertTriangle size={16} />
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error"><X size={15} /></button>
          </div>
        )}
        {notice && (
          <div className="global-message success" role="status">
            <Check size={16} />
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} aria-label="Dismiss message"><X size={15} /></button>
          </div>
        )}

        {!workspaceState?.workspace ? (
          <WorkspaceOnboarding
            loading={loading === "create-workspace"}
            onCreate={(name) =>
              execute("create-workspace", async () => {
                await api("/api/workspace", { method: "POST", body: JSON.stringify({ name }) });
                await refreshWorkspace();
                setNotice("Workspace created. Connect HydraDB to load the live provider catalogue.");
              })
            }
          />
        ) : !workspaceState.hydradb.configured ? (
          <HydraOnboarding
            loading={loading === "configure-hydra"}
            onConnect={(apiKey) =>
              execute("configure-hydra", async () => {
                await api("/api/hydradb/configure", {
                  method: "POST",
                  body: JSON.stringify({ apiKey }),
                });
                await refreshWorkspace();
                setNotice("HydraDB credential verified and encrypted. The provider catalogue is loading.");
              })
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.section
              key={active}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.16 }}
              className="view"
            >
              {active === "command" && (
                <CommandView
                  connectors={connectors}
                  verifiedConnectors={verifiedConnectors}
                  onOpenConnectors={() => setActive("connectors")}
                  onAsk={() => setActive("ask")}
                />
              )}
              {active === "connectors" && (
                <ConnectorsView
                  providers={providers}
                  connectors={connectors}
                  loading={loading}
                  selectedConnector={selectedConnector}
                  resources={resources}
                  selectedResourceIds={selectedResourceIds}
                  onRefresh={() => void execute("providers", refreshProviders)}
                  onSelectProvider={setSelectedProvider}
                  onSelectConnector={setSelectedConnector}
                  onToggleResource={(id) =>
                    setSelectedResourceIds((current) => {
                      const next = new Set(current);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  onDiscover={(connector) =>
                    execute(`discover-${connector.id}`, async () => {
                      const result = await api<{ resources: Resource[] }>(
                        `/api/connectors/${connector.id}/discover`,
                        { method: "POST", body: "{}" },
                      );
                      setSelectedConnector(connector);
                      setResources(result.resources);
                      setSelectedResourceIds(new Set());
                      await refreshConnectors();
                      setNotice(`Discovered ${result.resources.length} real resources from ${connector.provider}.`);
                    })
                  }
                  onConfigure={(connector) =>
                    execute(`configure-${connector.id}`, async () => {
                      await api(`/api/connectors/${connector.id}/configure`, {
                        method: "POST",
                        body: JSON.stringify({ resourceIds: [...selectedResourceIds], lookbackDays: 30 }),
                      });
                      await refreshConnectors();
                      setNotice("Selected resources were configured. Trigger the initial sync next.");
                    })
                  }
                  onSync={(connector) =>
                    execute(`sync-${connector.id}`, async () => {
                      await api(`/api/connectors/${connector.id}/sync`, { method: "POST", body: "{}" });
                      await refreshConnectors();
                      setNotice("HydraDB accepted the sync request. Verification will require cursor evidence.");
                    })
                  }
                  onVerify={(connector) =>
                    execute(`verify-${connector.id}`, async () => {
                      await api(`/api/connectors/${connector.id}/verify`, { method: "POST", body: "{}" });
                      await refreshConnectors();
                      setNotice("Connection proof passed: sync evidence and provider-matched canary sources were found.");
                    })
                  }
                />
              )}
              {active === "ask" && (
                <AskView
                  connectors={verifiedConnectors}
                  loading={loading === "query"}
                  result={queryResult}
                  onAsk={(query, database) =>
                    execute("query", async () => {
                      const result = await api<QueryResult>("/api/query", {
                        method: "POST",
                        body: JSON.stringify({ query, database, mode: "auto" }),
                      });
                      setQueryResult(result);
                    })
                  }
                />
              )}
              {["skills", "memory", "agents", "evaluations"].includes(active) && (
                <ControlPlaneView
                  active={active}
                  connectors={verifiedConnectors}
                  testMode={testMode}
                />
              )}
              {!["command", "connectors", "ask", "skills", "memory", "agents", "evaluations"].includes(active) && (
                <TruthfulEmptyView active={active} connectors={verifiedConnectors} />
              )}
            </motion.section>
          </AnimatePresence>
        )}
      </main>

      <AnimatePresence>
        {selectedProvider && (
          <ConnectorDialog
            provider={selectedProvider}
            loading={loading === `create-${selectedProvider.id}`}
            onClose={() => setSelectedProvider(null)}
            onSubmit={(payload) =>
              execute(`create-${selectedProvider.id}`, async () => {
                const result = await api<{ connector: Connector }>("/api/connectors", {
                  method: "POST",
                  body: JSON.stringify({ ...payload, provider: selectedProvider.id }),
                });
                setSelectedProvider(null);
                await refreshConnectors();
                setNotice(
                  `${selectedProvider.name} connector created. It is not connected yet—discover resources to continue proof.`,
                );
                setSelectedConnector(result.connector);
              })
            }
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function WorkspaceOnboarding({
  loading,
  onCreate,
}: {
  loading: boolean;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <section className="onboarding">
      <div className="onboarding-copy">
        <span className="eyebrow">01 / ESTABLISH SCOPE</span>
        <h1>Your agents know how.<br /><em>QueueProof proves what happens next.</em></h1>
        <p>
          Create an isolated workspace for connector contracts, evidence, ranking policy,
          approvals, and audit history. No synthetic business data will be added.
        </p>
        <div className="trust-row">
          <span><ShieldCheck size={16} /> Workspace isolation</span>
          <span><KeyRound size={16} /> Encrypted credentials</span>
          <span><FileCheck2 size={16} /> Evidence required</span>
        </div>
      </div>
      <form
        className="setup-card"
        onSubmit={(event) => {
          event.preventDefault();
          onCreate(name);
        }}
      >
        <span className="card-index">WORKSPACE / NEW</span>
        <h2>Name the decision boundary</h2>
        <label>
          Workspace name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Northstar Engineering"
            minLength={2}
            maxLength={80}
            autoFocus
            required
          />
        </label>
        <button className="primary-button" disabled={loading || name.trim().length < 2}>
          {loading ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}
          Create workspace
        </button>
        <small>Durable state is stored server-side. Local browser storage is not authoritative.</small>
      </form>
    </section>
  );
}

function HydraOnboarding({
  loading,
  onConnect,
}: {
  loading: boolean;
  onConnect: (apiKey: string) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  return (
    <section className="onboarding hydra-onboarding">
      <div className="onboarding-copy">
        <span className="eyebrow">02 / CONNECT KNOWLEDGE PLANE</span>
        <h1>Bring HydraDB.<br /><em>Keep the proof chain intact.</em></h1>
        <p>
          QueueProof verifies the key against the live provider catalogue, encrypts it
          with AES-GCM, and never returns it to the browser after submission.
        </p>
        <ol className="proof-steps">
          <li className="done"><Check size={14} /> Workspace isolated</li>
          <li className="current"><CircleDot size={14} /> Verify HydraDB</li>
          <li><span>03</span> Load provider contracts</li>
          <li><span>04</span> Prove real source data</li>
        </ol>
      </div>
      <form
        className="setup-card"
        onSubmit={(event) => {
          event.preventDefault();
          onConnect(apiKey);
        }}
      >
        <span className="card-index">HYDRADB / API V2</span>
        <h2>Secure credential handoff</h2>
        <div className="security-note">
          <KeyRound size={17} />
          <span>Use a newly generated key. Previously shared credentials are treated as compromised.</span>
        </div>
        <label>
          HydraDB API key
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Paste once — never displayed again"
            autoComplete="off"
            minLength={12}
            required
          />
        </label>
        <button className="primary-button" disabled={loading || apiKey.trim().length < 12}>
          {loading ? <LoaderCircle className="spin" size={17} /> : <ShieldCheck size={17} />}
          Verify and encrypt
        </button>
        <small>Sensitive responses use no-store. Credential material is redacted from logs and audits.</small>
      </form>
    </section>
  );
}

function ViewHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="view-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function CommandView({
  connectors,
  verifiedConnectors,
  onOpenConnectors,
  onAsk,
}: {
  connectors: Connector[];
  verifiedConnectors: Connector[];
  onOpenConnectors: () => void;
  onAsk: () => void;
}) {
  const priorityReady = ["slack", "gmail", "linear"].every((provider) =>
    verifiedConnectors.some((connector) => connector.provider === provider),
  );
  return (
    <>
      <ViewHeader
        eyebrow="COMMAND / LIVE WORKSPACE"
        title="What deserves execution?"
        description="The queue remains empty until real retrieved evidence can support every material claim."
        action={
          <button className="secondary-button" onClick={onAsk} disabled={verifiedConnectors.length === 0}>
            <Sparkles size={16} /> Ask QueueProof
          </button>
        }
      />
      <div className="command-grid">
        <section className="queue-panel panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">COMMAND QUEUE</span>
              <h2>Defensible next actions</h2>
            </div>
            <span className="count-chip">{priorityReady ? "Ready to generate" : "Evidence gated"}</span>
          </div>
          {!priorityReady ? (
            <div className="evidence-empty">
              <div className="empty-sigil"><GitBranch size={34} /></div>
              <span className="eyebrow">NO UNSUPPORTED TASKS</span>
              <h3>The queue is intentionally empty.</h3>
              <p>
                Data-verified Slack, Gmail, and Linear sources are required before QueueProof
                can reconstruct commitments, dependencies, and cross-source priority.
              </p>
              <button className="primary-button compact" onClick={onOpenConnectors}>
                <Plus size={16} /> Prove a connection
              </button>
            </div>
          ) : (
            <div className="evidence-empty">
              <div className="empty-sigil ready"><Layers3 size={34} /></div>
              <span className="eyebrow">LIVE SOURCES READY</span>
              <h3>Generate from current evidence.</h3>
              <p>
                Three provider classes are data verified. Run a cross-source Ask to inspect
                retrieval coverage before materializing the first queue snapshot.
              </p>
              <button className="primary-button compact" onClick={onAsk}>
                <Sparkles size={16} /> Run grounded retrieval
              </button>
            </div>
          )}
        </section>
        <aside className="command-side">
          <section className="panel proof-summary">
            <div className="panel-heading">
              <div>
                <span className="panel-kicker">CONNECTION PROOF</span>
                <h2>Evidence readiness</h2>
              </div>
              <Activity size={18} />
            </div>
            <div className="proof-meter">
              <div style={{ width: `${Math.min(100, (verifiedConnectors.length / 3) * 100)}%` }} />
            </div>
            <dl>
              <div><dt>Data verified</dt><dd>{verifiedConnectors.length}</dd></div>
              <div><dt>Configured</dt><dd>{connectors.length}</dd></div>
              <div><dt>Required trio</dt><dd>{priorityReady ? "Complete" : "Incomplete"}</dd></div>
            </dl>
          </section>
          <section className="panel connector-freshness">
            <span className="panel-kicker">SOURCE FRESHNESS</span>
            {connectors.length === 0 ? (
              <p className="muted-copy">No connector has reached the proof workflow.</p>
            ) : (
              connectors.map((connector) => (
                <div className="freshness-row" key={connector.id}>
                  <span className={`provider-glyph ${connector.provider}`}>
                    {connector.provider.slice(0, 1).toUpperCase()}
                  </span>
                  <span><strong>{connector.provider}</strong><small>{humanState(connector.state)}</small></span>
                  <time>{relativeTime(connector.verifiedAt ?? connector.lastSuccessfulSyncAt)}</time>
                </div>
              ))
            )}
          </section>
        </aside>
      </div>
    </>
  );
}

function ConnectorsView(props: {
  providers: Provider[];
  connectors: Connector[];
  loading: string;
  selectedConnector: Connector | null;
  resources: Resource[];
  selectedResourceIds: Set<string>;
  onRefresh: () => void;
  onSelectProvider: (provider: Provider) => void;
  onSelectConnector: (connector: Connector) => void;
  onToggleResource: (id: string) => void;
  onDiscover: (connector: Connector) => void;
  onConfigure: (connector: Connector) => void;
  onSync: (connector: Connector) => void;
  onVerify: (connector: Connector) => void;
}) {
  const {
    providers, connectors, loading, selectedConnector, resources, selectedResourceIds,
    onRefresh, onSelectProvider, onSelectConnector, onToggleResource, onDiscover,
    onConfigure, onSync, onVerify,
  } = props;
  return (
    <>
      <ViewHeader
        eyebrow="CONNECTOR GATEWAY / LIVE CATALOGUE"
        title="Prove the connection, not the callback."
        description="Providers and credential fields are rendered from the active HydraDB contract. A connector is verified only after sync evidence and a provider-matched canary retrieval."
        action={
          <button className="secondary-button" onClick={onRefresh} disabled={loading === "providers"}>
            <RefreshCw className={loading === "providers" ? "spin" : ""} size={16} />
            Refresh catalogue
          </button>
        }
      />
      <div className="connector-layout">
        <section className="panel catalogue-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">AVAILABLE PROVIDERS</span>
              <h2>HydraDB contract catalogue</h2>
            </div>
            <span className="count-chip">{providers.length} returned</span>
          </div>
          {providers.length === 0 ? (
            <div className="small-empty">
              <Blocks size={28} />
              <p>HydraDB returned no usable provider contracts. Refresh or inspect server diagnostics.</p>
            </div>
          ) : (
            <div className="provider-grid">
              {providers.map((provider) => {
                const connection = connectors.find((connector) => connector.provider === provider.id);
                return (
                  <motion.button
                    layout
                    key={provider.id}
                    className="provider-card"
                    disabled={!provider.available}
                    onClick={() => onSelectProvider(provider)}
                  >
                    <span className={`provider-glyph large ${provider.id}`}>
                      {provider.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="provider-card-copy">
                      <strong>{provider.name}</strong>
                      <small>{provider.category ?? "Workplace source"}</small>
                    </span>
                    <span className={`support-badge ${provider.supportClass}`}>
                      {provider.supportClass}
                    </span>
                    {connection ? (
                      <span className={`connection-state ${connection.state === "data_verified" ? "verified" : ""}`}>
                        {humanState(connection.state)}
                      </span>
                    ) : (
                      <ChevronRight size={16} className="card-arrow" />
                    )}
                  </motion.button>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel lifecycle-panel">
          <div className="panel-heading">
            <div>
              <span className="panel-kicker">CONNECTIONS</span>
              <h2>Proof lifecycle</h2>
            </div>
            <span className="count-chip">{connectors.length} configured</span>
          </div>
          {connectors.length === 0 ? (
            <div className="small-empty">
              <Link2 size={28} />
              <p>Select a live provider contract above to create the first connector.</p>
            </div>
          ) : (
            <div className="connector-list">
              {connectors.map((connector) => (
                <button
                  key={connector.id}
                  className={selectedConnector?.id === connector.id ? "connector-row selected" : "connector-row"}
                  onClick={() => onSelectConnector(connector)}
                >
                  <span className={`provider-glyph ${connector.provider}`}>
                    {connector.provider.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="connector-name">
                    <strong>{connector.name}</strong>
                    <small>{connector.database}{connector.collection ? ` / ${connector.collection}` : ""}</small>
                  </span>
                  <span className={`state-pill ${connector.state}`}>{humanState(connector.state)}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedConnector && (
        <section className="panel proof-drawer">
          <div className="proof-drawer-head">
            <div>
              <span className="panel-kicker">CONNECTION PROOF / {selectedConnector.provider.toUpperCase()}</span>
              <h2>{selectedConnector.name}</h2>
            </div>
            <span className={`state-pill ${selectedConnector.state}`}>{humanState(selectedConnector.state)}</span>
          </div>
          <div className="proof-pipeline" aria-label="Connector verification stages">
            {[
              ["Create", ["connector_created", "resources_discovered", "resources_selected", "initial_sync_requested", "data_verified", "degraded"]],
              ["Discover", ["resources_discovered", "resources_selected", "initial_sync_requested", "data_verified", "degraded"]],
              ["Configure", ["resources_selected", "initial_sync_requested", "data_verified", "degraded"]],
              ["Sync", ["initial_sync_requested", "data_verified", "degraded"]],
              ["Verify", ["data_verified"]],
            ].map(([label, states]) => (
              <div
                key={label as string}
                className={(states as string[]).includes(selectedConnector.state) ? "complete" : ""}
              >
                <i>{(states as string[]).includes(selectedConnector.state) ? <Check size={13} /> : null}</i>
                <span>{label as string}</span>
              </div>
            ))}
          </div>
          {resources.length > 0 && selectedConnector.state === "resources_discovered" && (
            <div className="resource-picker">
              <div className="resource-picker-head">
                <span>Select real resources</span>
                <small>{selectedResourceIds.size} selected</small>
              </div>
              <div className="resource-list">
                {resources.map((resource) => (
                  <label key={resource.id}>
                    <input
                      type="checkbox"
                      checked={selectedResourceIds.has(resource.id)}
                      onChange={() => onToggleResource(resource.id)}
                    />
                    <span className="custom-check"><Check size={12} /></span>
                    <span><strong>{resource.name}</strong><small>{resource.resourceType} · {resource.id}</small></span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="proof-actions">
            <button
              className="secondary-button"
              onClick={() => onDiscover(selectedConnector)}
              disabled={loading.startsWith("discover-")}
            >
              {loading.startsWith("discover-") ? <LoaderCircle className="spin" size={16} /> : <Search size={16} />}
              Discover resources
            </button>
            <button
              className="secondary-button"
              onClick={() => onConfigure(selectedConnector)}
              disabled={selectedResourceIds.size === 0 || loading.startsWith("configure-")}
            >
              <Layers3 size={16} /> Configure selected
            </button>
            <button
              className="secondary-button"
              onClick={() => onSync(selectedConnector)}
              disabled={!["resources_selected", "initial_sync_requested", "degraded"].includes(selectedConnector.state)}
            >
              <RefreshCw size={16} /> Trigger sync
            </button>
            <button
              className="primary-button compact"
              onClick={() => onVerify(selectedConnector)}
              disabled={!["initial_sync_requested", "degraded", "data_verified"].includes(selectedConnector.state)}
            >
              <ShieldCheck size={16} /> Test connection
            </button>
          </div>
          <dl className="proof-facts">
            <div><dt>Verification stage</dt><dd>{selectedConnector.verificationStage ?? "Not run"}</dd></div>
            <div><dt>Canary objects</dt><dd>{selectedConnector.canaryResultCount ?? "—"}</dd></div>
            <div><dt>Verified at</dt><dd>{selectedConnector.verifiedAt ? new Date(selectedConnector.verifiedAt).toLocaleString() : "—"}</dd></div>
            <div><dt>Last error</dt><dd>{selectedConnector.lastError ?? "None recorded"}</dd></div>
          </dl>
        </section>
      )}
    </>
  );
}

function AskView({
  connectors,
  loading,
  result,
  onAsk,
}: {
  connectors: Connector[];
  loading: boolean;
  result: QueryResult | null;
  onAsk: (query: string, database: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [database, setDatabase] = useState(connectors[0]?.database ?? "");
  const effectiveDatabase = database || connectors[0]?.database || "";
  return (
    <>
      <ViewHeader
        eyebrow="ASK / OBSERVABLE RETRIEVAL"
        title="Ask the difficult question."
        description="QueueProof classifies the request, plans the cheapest valid retrieval, validates provider coverage, and exposes the trace without hidden chain-of-thought."
      />
      <div className="ask-layout">
        <section className="panel ask-panel">
          <form
            className="ask-form"
            onSubmit={(event) => {
              event.preventDefault();
              onAsk(query, effectiveDatabase);
            }}
          >
            <label>
              HydraDB database
              <select value={effectiveDatabase} onChange={(event) => setDatabase(event.target.value)} required>
                {[...new Set(connectors.map((connector) => connector.database))].map((name) => (
                  <option value={name} key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label className="query-label">
              Cross-source question
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={
                  connectors.length
                    ? "What should I do next, what evidence supports it, and where do the sources disagree?"
                    : "Data-verified connectors are required before retrieval."
                }
                disabled={connectors.length === 0}
                maxLength={4000}
                required
              />
            </label>
            <div className="ask-controls">
              <span><Sparkles size={14} /> Auto routes fast or thinking mode</span>
              <button className="primary-button compact" disabled={loading || connectors.length === 0 || !query.trim()}>
                {loading ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}
                Run grounded retrieval
              </button>
            </div>
          </form>
          {!result && (
            <div className="ask-empty">
              <GitBranch size={30} />
              <p>Retrieval output, evidence, validation, and actual call telemetry will appear here.</p>
            </div>
          )}
          {result && (
            <div className="retrieval-results">
              <div className="result-summary">
                <span className="eyebrow">RETRIEVED EVIDENCE</span>
                <h2>{result.trace.resultCount} chunks across {result.trace.providerCoverage.length} providers</h2>
              </div>
              {result.result.chunks.map((chunk, index) => {
                const source = result.result.sources.find((candidate) => candidate.id === chunk.sourceId);
                return (
                  <article className="evidence-card" key={`${chunk.sourceId}-${index}`}>
                    <div className="evidence-meta">
                      <span className={`provider-glyph ${source?.provider ?? ""}`}>
                        {(source?.provider ?? "?").slice(0, 1).toUpperCase()}
                      </span>
                      <span><strong>{source?.title ?? chunk.sourceId}</strong><small>{source?.provider ?? "Unclassified provider"}</small></span>
                      <span className="score">{Math.round(chunk.relevancyScore * 100)}%</span>
                    </div>
                    <p>{chunk.excerpt}</p>
                    {chunk.untrustedInstructionDetected && (
                      <div className="injection-warning"><AlertTriangle size={14} /> Untrusted instruction-like content isolated as evidence.</div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
        <aside className="panel trace-panel">
          <span className="panel-kicker">RETRIEVAL TRACE</span>
          {!result ? (
            <div className="trace-empty"><Activity size={24} /><p>No retrieval has run in this view.</p></div>
          ) : (
            <>
              <dl>
                <div><dt>Classification</dt><dd>{result.trace.classification}</dd></div>
                <div><dt>Mode</dt><dd>{result.trace.queryMode}</dd></div>
                <div><dt>HydraDB calls</dt><dd>{result.trace.callCount}</dd></div>
                <div><dt>Hydra latency</dt><dd>{result.trace.hydradbLatencyMs} ms</dd></div>
                <div><dt>End to end</dt><dd>{result.trace.endToEndLatencyMs} ms</dd></div>
              </dl>
              <div className="trace-providers">
                <span>Provider coverage</span>
                {result.trace.providerCoverage.length ? (
                  result.trace.providerCoverage.map((provider) => <i key={provider}>{provider}</i>)
                ) : <small>No provider metadata returned</small>}
              </div>
              <div className="trace-step">
                <Check size={14} />
                <span><strong>Plan executed</strong><small>{result.trace.plannedSteps[0]}</small></span>
              </div>
              <div className="trace-step">
                <ShieldCheck size={14} />
                <span><strong>Evidence screened</strong><small>Retrieved content remained untrusted data.</small></span>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

const bundledSkills = [
  "daily-priority",
  "incident-triage",
  "customer-escalation",
  "commitment-audit",
  "release-readiness",
  "dependency-unblock",
  "executive-brief",
  "engineering-handoff",
  "source-conflict-resolution",
  "agent-task-packet",
];

const memoryClasses = [
  ["Source knowledge", "HydraDB evidence and source provenance", "Workspace evidence"],
  ["User preferences", "Explicit ranking and briefing preferences", "User controlled"],
  ["Organisation policy", "Versioned priority and approval policy", "Admin controlled"],
  ["Episodic decisions", "Completed decisions with outcomes and evidence", "Reviewable"],
  ["Procedural memory", "Approved skill versions and workflows", "Approval gated"],
];

function ControlPlaneView({
  active,
  connectors,
  testMode,
}: {
  active: string;
  connectors: Connector[];
  testMode: boolean;
}) {
  if (active === "skills") {
    return (
      <>
        <ViewHeader
          eyebrow="SKILLS / PORTABLE PROCEDURES"
          title="Skill Registry"
          description="Ten versioned workflow packages ship with QueueProof. Activation and revision remain human-controlled."
        />
        <section className="system-grid skills-grid">
          {bundledSkills.map((skill) => (
            <article className="panel system-card" key={skill}>
              <div className="system-card-head">
                <span className="empty-sigil compact"><Zap size={16} /></span>
                <span className="proof-state neutral">BUNDLED</span>
              </div>
              <h3>{skill.replaceAll("-", " ")}</h3>
              <p>Portable MCP workflow · version 1.0.0</p>
              <div className="system-actions">
                <button className="ghost-button" disabled>Inactive</button>
                <button className="ghost-button" disabled>Review package</button>
              </div>
            </article>
          ))}
        </section>
        <p className="surface-footnote">Install, fork, diff, test, approve, and roll back operations remain disabled until a workspace skill record exists.</p>
      </>
    );
  }

  if (active === "memory") {
    return (
      <>
        <ViewHeader
          eyebrow="MEMORY / FIVE BOUNDED CLASSES"
          title="Memory Controls"
          description="Memory has explicit ownership, retention, and evidence boundaries. Retrieved text never becomes policy by itself."
        />
        <section className="system-grid memory-grid">
          {memoryClasses.map(([name, description, control]) => (
            <article className="panel system-card" key={name}>
              <div className="system-card-head">
                <span className="empty-sigil compact"><Brain size={16} /></span>
                <span className="proof-state neutral">0 RECORDS</span>
              </div>
              <h3>{name}</h3>
              <p>{description}</p>
              <small>{control} · exportable · deletable · auditable</small>
            </article>
          ))}
        </section>
      </>
    );
  }

  if (active === "agents") {
    const clients = [
      ["Codex", ".codex/config.toml", "queueproof client install codex"],
      ["Claude Code", ".mcp.json", "queueproof client install claude"],
      ["Kimi Code", ".kimi-code/mcp.json", "queueproof client install kimi"],
      ["Kilo Code", ".kilo/kilo.json", "queueproof client install kilo"],
    ];
    return (
      <>
        <ViewHeader
          eyebrow="AGENT DOCK / MCP BRIDGE"
          title="Connect an execution client"
          description="Install a project-scoped QueueProof entry while preserving every unrelated MCP server and setting."
        />
        <section className="agent-layout">
          <div className="panel agent-endpoint">
            <span className="eyebrow">STREAMABLE HTTP</span>
            <h3>/api/mcp</h3>
            <p>Authentication is fail-closed. The bearer token stays in <code>QUEUEPROOF_MCP_TOKEN</code>; it is never written into client configuration.</p>
            <div className="proof-facts">
              <div><span>Workspace proof</span><strong>{connectors.length ? `${connectors.length} verified source${connectors.length === 1 ? "" : "s"}` : "No verified sources"}</strong></div>
              <div><span>Remote endpoint</span><strong>Requires deployment secrets</strong></div>
            </div>
          </div>
          <div className="system-grid agent-clients">
            {clients.map(([name, file, command]) => (
              <article className="panel system-card" key={name}>
                <div className="system-card-head"><TerminalSquare size={18} /><span className="proof-state neutral">NOT VERIFIED</span></div>
                <h3>{name}</h3>
                <p>{file}</p>
                <code className="install-command">{command}</code>
              </article>
            ))}
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <ViewHeader
        eyebrow="EVALUATION LAB / EVIDENCE QUALITY"
        title="Evaluation Lab"
        description="Offline fixtures and live workspace evaluations are separated so synthetic scores can never masquerade as production proof."
      />
      <section className="eval-grid">
        <article className="panel eval-card">
          <span className="eyebrow">OFFLINE / ROUTING CONTRACT</span>
          <h3>32 labelled cases</h3>
          <p>The checked-in suite covers exact IDs, temporal questions, conflicts, counterfactuals, cross-source lookup, and simple facts.</p>
          <span className={`proof-state ${testMode ? "verified" : "neutral"}`}>{testMode ? "FIXTURE MODE VISIBLE" : "RUN FROM CLI"}</span>
        </article>
        <article className="panel eval-card">
          <span className="eyebrow">LIVE / WORKSPACE SOURCES</span>
          <h3>No live evaluation yet</h3>
          <p>{connectors.length ? "Verified sources exist, but no live evaluation run has been recorded." : "Verify real connector data before starting a live evaluation."}</p>
          <span className="proof-state neutral">NO CLAIMED SCORE</span>
        </article>
      </section>
    </>
  );
}

function TruthfulEmptyView({
  active,
  connectors,
}: {
  active: string;
  connectors: Connector[];
}) {
  const item = navItems.find((candidate) => candidate.id === active);
  const Icon = item?.icon ?? Layers3;
  return (
    <>
      <ViewHeader
        eyebrow={`${active.toUpperCase()} / EVIDENCE GATED`}
        title={item?.label ?? active}
        description="This surface only materializes records produced by the live workspace or explicitly consented user input."
      />
      <section className="panel evidence-empty full">
        <div className="empty-sigil"><Icon size={34} /></div>
        <span className="eyebrow">NO FABRICATED STATE</span>
        <h3>No live records exist for this view.</h3>
        <p>
          {connectors.length
            ? "Connected evidence has not yet produced a supported record for this capability."
            : "Complete connection proof for at least one real provider to begin."}
        </p>
      </section>
    </>
  );
}

function ConnectorDialog({
  provider,
  loading,
  onClose,
  onSubmit,
}: {
  provider: Provider;
  loading: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [database, setDatabase] = useState("");
  const [collection, setCollection] = useState("");
  const [name, setName] = useState(provider.name);
  const [accountScope, setAccountScope] = useState("");
  const fields = provider.credentialFields;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      name,
      database,
      collection: collection || undefined,
      accountScope: accountScope || undefined,
      credentials: values,
    });
  };
  return (
    <motion.div
      className="modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.form
        className="connector-modal"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.99 }}
        onSubmit={submit}
      >
        <header>
          <span className={`provider-glyph large ${provider.id}`}>{provider.name.slice(0, 1).toUpperCase()}</span>
          <div>
            <span className="eyebrow">NEW CONNECTOR / {provider.supportClass.toUpperCase()}</span>
            <h2>Connect {provider.name}</h2>
          </div>
          <button type="button" className="icon-button plain" onClick={onClose} aria-label="Close connector setup">
            <X size={18} />
          </button>
        </header>
        <div className="contract-strip">
          <ShieldCheck size={15} />
          <span>Fields loaded from HydraDB contract</span>
          <code>{provider.contractHash.slice(0, 10)}</code>
        </div>
        <div className="form-grid">
          <label>
            Connector name
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            HydraDB database
            <input value={database} onChange={(event) => setDatabase(event.target.value)} placeholder="workspace database" required />
          </label>
          <label>
            Collection <span>optional</span>
            <input value={collection} onChange={(event) => setCollection(event.target.value)} placeholder="team or user scope" />
          </label>
          <label>
            Provider account scope <span>when known</span>
            <input value={accountScope} onChange={(event) => setAccountScope(event.target.value)} placeholder="workspace, org, or account ID" />
          </label>
          {fields.length === 0 ? (
            <div className="contract-missing">
              <AlertTriangle size={16} />
              The provider contract returned no credential fields. QueueProof will not guess them.
            </div>
          ) : (
            fields.map((field) => (
              <label key={field.name} className="credential-field">
                {field.title ?? field.name.replaceAll("_", " ")}
                {!field.required && <span>optional</span>}
                <input
                  type={
                    field.format === "password" ||
                    /token|secret|password|key/i.test(field.name)
                      ? "password"
                      : "text"
                  }
                  value={values[field.name] ?? ""}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [field.name]: event.target.value }))
                  }
                  autoComplete="off"
                  required={Boolean(field.required)}
                  aria-describedby={field.description ? `help-${field.name}` : undefined}
                />
                {field.description && <small id={`help-${field.name}`}>{field.description}</small>}
              </label>
            ))
          )}
        </div>
        <footer>
          <p><KeyRound size={14} /> Credentials are forwarded server-to-server and are not stored by QueueProof.</p>
          <button className="primary-button" disabled={loading || fields.length === 0}>
            {loading ? <LoaderCircle className="spin" size={16} /> : <ArrowRight size={16} />}
            Create connector
          </button>
        </footer>
      </motion.form>
    </motion.div>
  );
}
