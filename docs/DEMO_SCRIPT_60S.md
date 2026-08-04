# QueueProof 60-second demo

Record the canonical product at <https://queueproof.vercel.app/>. Do not use fixtures or hide
failed states. Before recording, confirm the visible connector count and run the flagship
question once so provider latency cannot consume the entire take.

## 0–8 seconds — start in the working product

**Screen:** Open Ask. Keep the source-readiness line and composer visible.

**Say:**

> This is QueueProof, a live workspace for deciding what needs attention from evidence across
> connected systems. Four sources are verified here; unverified sources cannot influence an
> answer.

## 8–24 seconds — run a real multi-hop question

**Screen:** Run the flagship AuthShield question. Point to the selected route while it resolves.

**Say:**

> I’ll ask who escalated this outage, what engineering committed to, and whether the fix is
> already merged. QueueProof routes the question through HydraDB and records the mode, calls,
> provider coverage, and elapsed time.

## 24–39 seconds — inspect proof, not prose

**Screen:** Show the returned answer, then open one numbered citation receipt.

**Say:**

> The answer is stored with the exact question. Each claim opens to its provider, timestamp,
> source identifier, and excerpt. The Linear and GitHub disagreement remains visible instead
> of being rewritten into false certainty.

## 39–50 seconds — show the next action

**Screen:** Close the receipt, open Priorities, and expand the top queue packet.

**Say:**

> The same evidence compiles a deterministic priority packet with score factors, constraints,
> and a safe next action. Any provider write starts as a proposal and still requires approval.

## 50–60 seconds — show the engineering receipt

**Screen:** Open Benchmarks. Point to the total denominator, `PASS`/`REVIEW` rows, latency,
calls, mode, and reproducibility command.

**Say:**

> Benchmarks publish expected versus observed answers, latency, calls, and failures. REVIEW is
> never relabelled as a pass. The public repository contains the locked build, tests, and exact
> reproduction commands.

## Recording rules

- Say the provider count, latency, call count, and benchmark denominator exactly as displayed
  in the final take; do not memorize an older run.
- Do not call the deterministic router fixture live accuracy or describe a replay as a new run.
- Do not imply Gmail supported the flagship answer unless a Gmail citation is actually present.
- Do not imply public visitors can configure connectors, upload documents, mint tokens, or
  execute an external write.
- Keep any degraded connector or `REVIEW` benchmark row visible. That honesty is part of the
  product.
- Stop and rerun acceptance if the health endpoint does not identify the submitted release.
