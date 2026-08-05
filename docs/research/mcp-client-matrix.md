# MCP client matrix

Accessed 2026-07-31.

- Protocol: [Model Context Protocol 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28)
- Node server package: [`@modelcontextprotocol/server`](https://www.npmjs.com/package/@modelcontextprotocol/server), pinned 2.0.0.
- Codex: [official MCP guide](https://developers.openai.com/codex/mcp/)
- Claude Code: [official MCP guide](https://docs.anthropic.com/en/docs/claude-code/mcp)
- Kimi Code: [official repository](https://github.com/MoonshotAI/kimi-code)
- Kilo Code: [official MCP configuration guide](https://kilo.ai/docs/automate/mcp/using-in-kilo-code)

QueueProof exposes Streamable HTTP at the canonical `/mcp` route. `/api/mcp` remains a compatibility alias that re-exports the same authenticated handler. Codex uses project `.codex/config.toml`; Claude Code uses `.mcp.json`; current Kimi Code uses `.kimi-code/mcp.json` and `bearerTokenEnvVar`; Kilo uses project `kilo.json`/`.kilo/kilo.json`, `type: "remote"`, and `{env:VARIABLE}` interpolation in trusted configuration. Installers preserve unrelated settings and back up before mutation. OAuth metadata is not advertised unless a real issuer is configured.
