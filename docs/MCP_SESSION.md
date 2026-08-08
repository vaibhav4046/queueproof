# MCP session receipts

Every block below is raw output from the deployed product. Nothing here is illustrative or
hand-written: the JSON files referenced are committed next to this page in
[`assets/`](assets/), and the same calls can be repeated by anyone.

Two endpoints exist:

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `https://queueproof.vercel.app/mcp` | Bearer token or OAuth | Full workspace contract |
| `https://queueproof.vercel.app/mcp/demo` | None | Read-only reviewer endpoint, single search tool |

## 1. The protected endpoint refuses anonymous callers

```console
$ curl -si -X POST https://queueproof.vercel.app/mcp \
    -H 'content-type: application/json' \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -3
HTTP/1.1 401
www-authenticate: Bearer resource_metadata="https://queueproof.vercel.app/.well-known/oauth-protected-resource/mcp", scope="openid profile email", error="invalid_token"
```

The challenge follows RFC 9728, so a compliant client can discover the resource metadata,
the authorization server, the scopes, and the dynamic registration endpoint without being
told them out of band.

## 2. Handshake on the reviewer endpoint

```console
$ curl -s -X POST https://queueproof.vercel.app/mcp/demo \
    -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'
```

Negotiated protocol `2025-06-18`; server identifies itself as `queueproof 0.2.0`.
`tools/list` returns one tool, `queueproof_search`, with a complete input schema.
`resources/list` returns `queueproof://demo/guide`. No fictional tools, prompts, or
change-diff resources are advertised.

## 3. A hard question, answered with an explicit gap

This is the interesting case, because the honest answer is not a complete one. The request
asks for four separate things at once and forces the thinking lane:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "queueproof_search",
    "arguments": {
      "query": "Reconstruct the AuthShield outage end to end: who escalated it, what engineering committed to, whether the fix is merged, and name any source disagreement or missing evidence.",
      "mode": "thinking"
    }
  }
}
```

Full response: [`assets/mcp-complex-call.json`](assets/mcp-complex-call.json) (JSON-RPC envelope)
and [`assets/mcp-complex-result.json`](assets/mcp-complex-result.json) (decoded payload).

What came back:

| Field | Value |
| --- | --- |
| `plan.category` | `conflict_analysis` |
| `plan.queryBy` | `hybrid`, with graph context enabled |
| `mode` | `thinking` |
| `validation.status` | **`partial`** |
| `claims` / cited claims | 2 / 2 |
| `evidence` | 3 records |
| `providerCoverage` | `linear`, `github`, `slack` |
| `contradictions` | 1, preserved rather than resolved |
| `missingInformation` | `["Insufficient evidence for the requested engineering commitment."]` |
| `latencyMs` | 5528 |
| `callCount` / `estimatedCostUnits` | 1 / 3 |
| `failedScopeCount` | 0 |

The answer text is two sentences, and both carry citation markers:

> The AuthShield authentication fix for the Northwind outage (INC-2031) was merged. [1]
> Northwind have escalated the AuthShield authentication outage (INC-2031). [2]

The fourth part of the question — what engineering committed to — is **not** answered. The
tool reports it as missing information instead of inventing a commitment, and the response is
marked `partial` rather than `grounded` because of it. The preserved contradiction is a date
disagreement inside the Linear records:

> The cited records contain different dates: linear says 29 July 2026; linear says 7 August 2026.

Each citation resolves to a stored evidence record with provider, source ID, title, and
timestamp, for example
`772fc4ca6eab32434a9df0b8626810c498ed652518d9228a756078ea4abf7f61:chunk:1` on `linear`.

## 4. Why this is the receipt worth reading

A retrieval demo is easy to make look good by asking a question the corpus answers cleanly.
This one deliberately asks for more than the evidence supports. The system answers what it can
prove, cites all of it, names the part it cannot prove, and keeps a source disagreement visible
instead of picking a winner. That behaviour is the product.

## Reproduce it

```bash
curl -s -X POST https://queueproof.vercel.app/mcp/demo \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"queueproof_search","arguments":{"query":"Reconstruct the AuthShield outage end to end: who escalated it, what engineering committed to, whether the fix is merged, and name any source disagreement or missing evidence.","mode":"thinking"}}}'
```

The response is a Server-Sent Events stream; the payload is on the `data:` line.

Client setup guides: [Remote MCP](REMOTE_MCP_SETUP.md) ·
[Claude workflow](CLAUDE_QUEUEPROOF_WORKFLOW.md) ·
[Codex workflow](CODEX_QUEUEPROOF_WORKFLOW.md) ·
[ChatGPT workflow](CHATGPT_MCP_SETUP.md)
