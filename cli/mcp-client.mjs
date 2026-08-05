export function tokenSetupInstructions() {
  return [
    "Set the connection key in the environment that launches your AI client:",
    'PowerShell:  $env:QUEUEPROOF_MCP_TOKEN="<paste connection key>"',
    'macOS/Linux: export QUEUEPROOF_MCP_TOKEN="<paste connection key>"',
  ].join("\n");
}

export function parseMcpResponse(text) {
  const trimmed = String(text).trim();
  if (!trimmed) throw new Error("MCP returned an empty response.");
  if (trimmed.startsWith("{")) return JSON.parse(trimmed);
  const events = trimmed
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  if (!events.length) throw new Error(`MCP response was not JSON or SSE: ${trimmed.slice(0, 180)}`);
  return JSON.parse(events.at(-1));
}

export async function callMcp({ endpoint, token, method, params = {}, fetchImpl = fetch, id = Date.now() }) {
  if (!token?.trim()) throw new Error(`QUEUEPROOF_MCP_TOKEN is missing.\n${tokenSetupInstructions()}`);
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  const text = await response.text();
  if (!response.ok) {
    const hint = response.status === 401
      ? " Check QUEUEPROOF_MCP_TOKEN and confirm the key has not expired or been revoked."
      : "";
    throw new Error(`MCP ${response.status}: ${text.slice(0, 300) || response.statusText}.${hint}`);
  }
  const payload = parseMcpResponse(text);
  if (payload.error) throw new Error(`MCP ${payload.error.code ?? "error"}: ${payload.error.message ?? "Request failed."}`);
  return payload.result;
}

export async function callMcpTool(options, name, args = {}) {
  const result = await callMcp({ ...options, method: "tools/call", params: { name, arguments: args } });
  if (result?.isError) {
    const message = result.content?.map((item) => item.text).filter(Boolean).join("\n") || `${name} failed.`;
    throw new Error(message);
  }
  return result?.structuredContent ?? result;
}

export async function verifyMcp(options) {
  const initialized = await callMcp({
    ...options,
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "queueproof-cli", version: "0.1.0" },
    },
  });
  const listed = await callMcp({ ...options, id: 2, method: "tools/list", params: {} });
  return {
    connected: true,
    server: initialized?.serverInfo ?? null,
    protocolVersion: initialized?.protocolVersion ?? null,
    tools: Array.isArray(listed?.tools) ? listed.tools.map((tool) => tool.name) : [],
  };
}
