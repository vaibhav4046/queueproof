#!/usr/bin/env node
import { Command } from "commander";
import { readFile, rename } from "node:fs/promises";
import process from "node:process";
import { installClientConfig, projectConfigPath } from "./config.mjs";

const program = new Command()
  .name("queueproof")
  .description("QueueProof operator and MCP client bridge")
  .version("0.1.0")
  .option("--url <url>", "QueueProof base URL", process.env.QUEUEPROOF_URL || "http://127.0.0.1:3000");

function base() { return program.opts().url.replace(/\/$/, ""); }
async function request(path, init = {}) {
  const response = await fetch(`${base()}${path}`, init);
  const body = await response.json().catch(() => ({ error: response.statusText }));
  if (!response.ok) throw new Error(`${response.status}: ${body.error || JSON.stringify(body)}`);
  console.log(JSON.stringify(body, null, 2));
}

program.command("login").description("Explain secure sign-in").action(() =>
  console.log(`Open ${base()} and use the hosted sign-in. Credentials are never accepted as CLI arguments.`));
program.command("logout").description("Remove local session guidance").action(() =>
  console.log("QueueProof CLI stores no session or provider credential."));
program.command("status").action(() => request("/api/health/ready"));
program.command("doctor").action(() => request("/api/health/dependencies"));
program.command("connect").argument("<provider>").action((provider) => {
  if (provider !== "hydradb") throw new Error("Only 'connect hydradb' is supported.");
  console.log(`Open ${base()} and submit a newly generated HydraDB key through the encrypted form.`);
});

const connectors = program.command("connectors");
connectors.command("list").action(() => request("/api/connectors"));
connectors.command("verify").argument("<id>").action((id) =>
  request(`/api/connectors/${encodeURIComponent(id)}/verify`, { method: "POST" }));
program.command("sync").argument("<id>").action((id) =>
  request(`/api/connectors/${encodeURIComponent(id)}/sync`, { method: "POST" }));
program.command("ask").argument("<question...>").requiredOption("--database <database>").action((words, options) =>
  request("/api/query", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: words.join(" "), database: options.database }) }));
program.command("next").action(() => console.log("Use the authenticated MCP tool queueproof_get_next_actions."));
program.command("changes").action(() => console.log("Use the authenticated MCP resource queueproof://workspace/changes."));

const skills = program.command("skills");
skills.command("list").action(() => console.log("Portable skills are under ./skills; hosted activation requires a workspace."));
skills.command("install").argument("<path>").action((path) => console.log(`Review and install ${path} in the QueueProof Skill Registry.`));

const mcp = program.command("mcp");
mcp.command("serve").action(() => console.log("Run `pnpm dev`; the authenticated endpoint is /api/mcp."));
mcp.command("install").argument("<client>").action(async (client) => {
  const file = projectConfigPath[client];
  if (!file) throw new Error("Client must be codex, claude, kimi, or kilo.");
  console.log(await installClientConfig({ client, file, endpoint: `${base()}/api/mcp` }));
});
mcp.command("verify").action(() => console.log(`Test ${base()}/api/mcp with an MCP client and QUEUEPROOF_MCP_TOKEN.`));

const client = program.command("client");
client.command("install").argument("<client>").option("--endpoint <url>").action(async (name, options) => {
  const file = projectConfigPath[name];
  if (!file) throw new Error("Client must be codex, claude, kimi, or kilo.");
  console.log(await installClientConfig({ client: name, file, endpoint: options.endpoint || `${base()}/api/mcp` }));
});
client.command("uninstall").argument("<client>").action(async (name) => {
  const file = projectConfigPath[name];
  if (!file) throw new Error("Client must be codex, claude, kimi, or kilo.");
  const backup = `${file}.queueproof-backup`;
  await readFile(backup);
  await rename(backup, file);
  console.log(`Restored ${file} from QueueProof backup.`);
});

program.command("eval").argument("<action>", "run").action((action) =>
  console.log(action === "run" ? "Run `QUEUEPROOF_TEST_MODE=true pnpm eval` for fixtures or use the hosted Evaluation Lab." : "Unknown eval action."));
program.command("export").description("Export grounded workspace data through the hosted UI").action(() =>
  console.log(`Open ${base()} and use workspace-scoped export. CLI never exports without an authenticated workspace.`));

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
