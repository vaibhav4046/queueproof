const base = (process.env.QUEUEPROOF_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const response = await fetch(`${base}/api/health/live`);
if (!response.ok) throw new Error(`QueueProof is not live: ${response.status}`);
const html = await (await fetch(base)).text();
for (const marker of ["QueueProof — Evidence-Ranked Execution", "Connect workplace evidence", "queueproof-sentinel.png"]) {
  if (!html.includes(marker)) throw new Error(`Missing rendered marker: ${marker}`);
}
const workspaceResponse = await fetch(`${base}/api/workspace`);
if (!workspaceResponse.ok) throw new Error(`Workspace bootstrap failed: ${workspaceResponse.status}`);
const workspace = await workspaceResponse.json();
if (workspace.ok !== true) throw new Error("Workspace bootstrap did not return an explicit success contract.");
console.log("PASS  live endpoint, metadata shell, and workspace bootstrap");
