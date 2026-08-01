# Sixty-second demo script

Every beat below can be performed today, on a laptop, with no HydraDB account and no
provider authorisation. Nothing here requires a connector to have run.

Beats that need credentials are listed separately at the bottom and are **not** part of
this recording. Do not stage them with fixtures.

## Setup before recording

```bash
npm install
# .env.local
#   QUEUEPROOF_ENCRYPTION_KEY=<32 random bytes, base64>
#   QUEUEPROOF_ALLOW_LOCAL_IDENTITY=true
npm run dev
```

The dev server takes the next free port if 3000 is busy and prints the one it chose, and
on some Windows setups it binds IPv6 loopback only. Confirm the real port before
recording and substitute it everywhere below, using `http://[::1]:<port>` if `localhost`
refuses the connection. A failed curl mid-take is the one avoidable way to lose this
recording.

Have four things open: the local app, a terminal, an MCP client pointed at the local
`/mcp`, and a browser tab on <https://queueproof.vercel.app>.

## The script

**0 to 8s. The problem.**
Open the local app on an empty queue.

Be aware before framing this shot: the empty-state copy reads "Connect Slack, Gmail,
Linear, or another HydraDB provider". Those are catalogue examples, not integrations, and
none is connected. Either keep that copy out of frame or say plainly that nothing is
connected yet. Never let it imply a working integration.

> "Your agents can already execute. They cannot tell you which piece of work deserves
> execution next, or defend the answer afterwards. That is the layer QueueProof builds."

**8 to 18s. Refusing to fake it.**
Switch to the live Vercel tab. It shows the setup screen naming the environment variables
it needs. Run in the terminal:

```bash
curl -i https://queueproof.vercel.app/api/health/ready
```

Show `503` and `{"databaseBinding":false,"uploadBinding":false,"encryptionKey":false}`.

> "This deployment has no database bound. It says so, precisely, instead of rendering a
> dashboard of invented numbers. When QueueProof has no evidence, it returns an empty
> state."

Narrate only that. Do **not** say or imply that setting the variables would flip this
endpoint to ready: `uploadBinding` is a Cloudflare R2 binding that the Vercel runtime
cannot provide, so readiness stays 503 there by construction. That is a known defect,
recorded in `ARCHITECTURE.md`. If a judge asks, say so directly.

**18 to 30s. The security boundary.**
Back to the terminal, against the local server:

```bash
curl -i localhost:3000/api/health/ready     # 200 ready, all three checks true
```

Then run the session attack set and show the wall of `401`s, all nine: spoofed
`oai-authenticated-user-email` header; `Host: localhost.attacker.example`;
`Host: localhost` reading `/api/mcp-tokens`; no credentials; wrong access token; garbage
signature; payload swapped to another email with the signature kept; unsigned payload;
correctly signed but expired. Then a valid session cookie returning `200`.

> "Sessions are HMAC-signed httpOnly cookies. Nine attack variants, nine 401s. Identity
> is never taken from a header a caller controls."

**30 to 44s. The agent path, and why proposing is not executing.**
Switch to the MCP client. Show the handshake completing on protocol `2025-11-25`, then
the tool list: 13 tools for a read plus propose token. Point at the scope split.

Call `queueproof_propose_action` twice with the same `idempotencyKey`.

> "Same key, same proposal ID. An agent that retries does not create a second action.
> And propose is not execute: QueueProof records the exact payload and its evidence, then
> stops at the approval gate. No provider write has ever been executed by this system,
> and there is no executor to do it."

**44 to 54s. Determinism.**
Show `packages/ranking` on screen, then run:

```bash
npm test
```

Show `90 passed (90)`.

> "Ranking is a pure function. Nine components, explicit penalties, clamped to a hundred,
> and every result carries its policy version and a written explanation. The same
> evidence always produces the same answer, and you can diff it when the policy changes."

**54 to 60s. Close.**

> "QueueProof is the part that has to be trustworthy before autonomy is safe: a
> defensible next action, with receipts, and an honest empty state when there is nothing
> to defend."

## Not in this recording

These require a HydraDB API key and provider authorisation before they can be shown.
They are written but have never been run against a live account, so they must not be
demonstrated, narrated as working, or simulated with fixtures:

- Connector create, resource discovery, scoped configure, backfill, sync, and
  canary verification reaching `data_verified`.
- Any Linear, Slack, or Gmail specific behaviour. There is no provider integration in the
  repository: no client, no auth flow, no API call.
- Cross-source Ask with real citations and a live retrieval trace.
- A queue or Execution Packet built from real provider evidence.
- Any accuracy, latency, or cost figure. No such measurement exists in this repository.
- Document or PDF upload and ingestion. No upload code exists.
