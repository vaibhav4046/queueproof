#!/usr/bin/env node
import { Command } from "commander";
import { readFile, rename } from "node:fs/promises";
import process from "node:process";
import { canonicalMcpEndpoint, installClientConfig, projectConfigPath } from "./config.mjs";
import { callMcpTool, tokenSetupInstructions, verifyMcp } from "./mcp-client.mjs";

const program = new Command()
  .name("queueproof")
  .description("QueueProof operator and MCP client bridge")
  .version("0.1.0")
  .option("--url <url>", "QueueProof base URL", process.env.QUEUEPROOF_URL || "http://127.0.0.1:3000");

function base() { return program.opts().url.replace(/\/$/, ""); }
function mcpOptions() {
  return {
    endpoint: canonicalMcpEndpoint(base()),
    token: process.env.QUEUEPROOF_MCP_TOKEN,
  };
}
function print(value) { console.log(JSON.stringify(value, null, 2)); }
async function tool(name, args = {}) { print(await callMcpTool(mcpOptions(), name, args)); }
async function request(path, init = {}) {
  const response = await fetch(`${base()}${path}`, init);
  const body = await response.json().catch(() => ({ error: response.statusText }));
  if (!response.ok) throw new Error(`${response.status}: ${body.error || JSON.stringify(body)}`);
  console.log(JSON.stringify(body, null, 2));
}

program.command("login").description("Explain secure sign-in").action(() =>
  console.log(`Open ${base()}/owner to create an owner session and MCP connection key.\n\n${tokenSetupInstructions()}\n\nCredentials are never accepted as CLI arguments.`));
program.command("logout").description("Remove local session guidance").action(() =>
  console.log("QueueProof CLI stores no session or provider credential."));
program.command("status").action(() => request("/api/health/ready"));
program.command("doctor").action(() => request("/api/health/dependencies"));
program.command("connect").argument("<provider>").action((provider) => {
  if (provider !== "hydradb") throw new Error("Only 'connect hydradb' is supported.");
  console.log(`Open ${base()} and submit a newly generated HydraDB key through the encrypted form.`);
});

const connectors = program.command("connectors");
connectors.command("list").action(() => tool("queueproof_list_connectors"));
connectors.command("verify").argument("<id>").action((id) =>
  tool("queueproof_verify_connector", { connectorId: id }));
program.command("sync").argument("<id>").action((id) =>
  tool("queueproof_sync_connector", { connectorId: id }));
program.command("ask").argument("<question...>")
  .option("--connectors <ids>", "comma-separated connector IDs returned by connectors list")
  .option("--sources <ids>", "comma-separated indexed document source IDs")
  .option("--mode <mode>", "fast, auto, or thinking", "auto")
  .action((words, options) => {
    const connectorIds = options.connectors?.split(",").map((value) => value.trim()).filter(Boolean);
    const sourceIds = options.sources?.split(",").map((value) => value.trim()).filter(Boolean);
    if (Boolean(connectorIds?.length) === Boolean(sourceIds?.length)) {
      throw new Error("Choose exactly one of --connectors or --sources.");
    }
    return tool("queueproof_search", {
      query: words.join(" "),
      ...(connectorIds?.length ? { connectorIds } : { sourceIds }),
      mode: options.mode,
    });
  });
program.command("next").option("--limit <count>", "maximum actions", "10").action((options) =>
  tool("queueproof_get_next_actions", { limit: Number(options.limit) }));
program.command("changes").option("--limit <count>", "maximum snapshots", "20").action((options) =>
  tool("queueproof_list_queue_snapshots", { limit: Number(options.limit) }));

const skills = program.command("skills");
skills.command("list").action(() => console.log("Portable skills are under ./skills; hosted activation requires a workspace."));
skills.command("install").argument("<path>").action((path) => console.log(`Review and install ${path} in the QueueProof Skill Registry.`));

const mcp = program.command("mcp");
mcp.command("serve").action(() => console.log("Run `pnpm dev`; the authenticated endpoint is /mcp."));
mcp.command("install").argument("<client>").action(async (client) => {
  const file = projectConfigPath[client];
  if (!file) throw new Error("Client must be codex, claude, kimi, or kilo.");
  print(await installClientConfig({ client, file, endpoint: canonicalMcpEndpoint(base()) }));
  console.log(`\n${tokenSetupInstructions()}\nRestart ${client}, then run \`queueproof mcp verify\`.`);
});
mcp.command("verify").description("Perform a real MCP handshake and list tools").action(async () =>
  print(await verifyMcp(mcpOptions())));

const client = program.command("client");
client.command("install").argument("<client>").option("--endpoint <url>").action(async (name, options) => {
  const file = projectConfigPath[name];
  if (!file) throw new Error("Client must be codex, claude, kimi, or kilo.");
  console.log(await installClientConfig({ client: name, file, endpoint: options.endpoint || canonicalMcpEndpoint(base()) }));
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
