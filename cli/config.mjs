import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const CANONICAL_MCP_PATH = "/mcp";

export function canonicalMcpEndpoint(baseUrl) {
  return `${String(baseUrl).replace(/\/$/, "")}${CANONICAL_MCP_PATH}`;
}

export function clientEntry(client, endpoint, tokenEnv = "QUEUEPROOF_MCP_TOKEN") {
  if (client === "codex") {
    return `[mcp_servers.queueproof]\nurl = "${endpoint}"\nbearer_token_env_var = "${tokenEnv}"\n`;
  }
  if (client === "claude") {
    return { mcpServers: { queueproof: { type: "http", url: endpoint, headers: { Authorization: `Bearer \${${tokenEnv}}` } } } };
  }
  if (client === "kimi") {
    return { mcpServers: { queueproof: { type: "http", url: endpoint, bearerTokenEnvVar: tokenEnv, allowedTools: ["queueproof_*"] } } };
  }
  if (client === "kilo") {
    return {
      mcp: {
        queueproof: {
          type: "remote",
          url: endpoint,
          enabled: true,
          headers: { Authorization: `Bearer {env:${tokenEnv}}` },
        },
      },
    };
  }
  throw new Error(`Unsupported client: ${client}`);
}

export function mergeClientJson(current, addition) {
  const result = structuredClone(current ?? {});
  for (const [section, value] of Object.entries(addition)) {
    result[section] = { ...(result[section] ?? {}), ...value };
  }
  return result;
}

export async function installClientConfig({ client, file, endpoint, tokenEnv = "QUEUEPROOF_MCP_TOKEN" }) {
  await mkdir(dirname(file), { recursive: true });
  let currentText = "";
  try {
    currentText = await readFile(file, "utf8");
    await copyFile(file, `${file}.queueproof-backup`);
  } catch {}

  const entry = clientEntry(client, endpoint, tokenEnv);
  if (client === "codex") {
    if (currentText.includes("[mcp_servers.queueproof]")) throw new Error("QueueProof already exists; remove or uninstall it first.");
    await writeFile(file, `${currentText.trimEnd()}${currentText ? "\n\n" : ""}${entry}`, "utf8");
  } else {
    const current = currentText ? JSON.parse(currentText) : {};
    await writeFile(file, `${JSON.stringify(mergeClientJson(current, entry), null, 2)}\n`, "utf8");
  }
  return { file, backup: currentText ? `${file}.queueproof-backup` : null };
}

export const projectConfigPath = {
  codex: ".codex/config.toml",
  claude: ".mcp.json",
  kimi: ".kimi-code/mcp.json",
  kilo: ".kilo/kilo.json",
};
