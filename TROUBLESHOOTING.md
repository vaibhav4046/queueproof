# Troubleshooting

## Empty Command screen

This is expected until a connector reaches `data_verified` and grounded source evidence exists. Check Connectors for the exact proof state; do not enable fixture mode.

## HydraDB key rejected

Generate a new key, confirm the account can call `GET /connectors/providers`, and enter it in the secure web form. QueueProof never displays the saved value.

## Connector remains in sync

HydraDB exposes connector timestamps/errors rather than a dedicated run-status endpoint. Refresh provider state, inspect `provider_cursor`, and run Verify. A requested sync is not treated as success.

## MCP returns 503

Both `QUEUEPROOF_MCP_TOKEN` and `QUEUEPROOF_MCP_WORKSPACE_ID` must be configured. This is intentional fail-closed behavior.

## MCP returns 401

Set the client’s bearer-token environment variable. Do not paste a token into checked-in configuration. Confirm the client points to `/api/mcp`.

## D1 binding missing

Run `pnpm deploy:check` and ensure `.openai/hosting.json` maps `d1` to `DB`. Local and hosted environments must expose the same binding name.

## Semicolon warning on Windows

The parent workspace contains `;`. Package scripts invoke Node entrypoints directly, so the warning about `node_modules/.bin` is non-fatal. The `C:\tmp\queueproof` junction is used for tooling compatibility.
