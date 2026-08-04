# HydraDB hackathon form answers

Use these answers only after the public deployment and judge-accessible repository pass
the final verification checklist. Do not paste a video URL until the recording is public.

## Did you try ingesting huge PDFs?

Yes. QueueProof generates and ingests a deterministic 346-page handbook, then asks 22
labelled questions containing 56 frozen fact groups. The latest accepted public run before
the final release passed 20/22 cases and recovered 53/56 facts with 100% citation
precision/completeness and zero unsupported claims. The two REVIEW cases remain visible;
the final deployed commit must rerun this benchmark before submission.

## Did you use at least three connectors?

Yes. The last verified public workspace contained four HydraDB connectors at
`data_verified`: GitHub, Gmail, Linear, and Slack. The flagship production investigation
retrieved attributable GitHub, Linear, and Slack receipts. Connector state means a real
canary returned records with connector/resource lineage; a saved credential does not
count as working.

## One-line project description

QueueProof retrieves cross-source work evidence through HydraDB, proves every supported
claim with a receipt, preserves conflicts, and gives an agent one approval-safe next
action.

## What makes it technically difficult?

The flagship question requires identity matching, timeline ordering, changed-state and
contradiction handling, citation validation, and a bounded evidence-derived follow-up
query. QueueProof separates fast and Deep check routing, records every HydraDB call and
retained receipt, and abstains when evidence cannot support an answer.

## Latency, accuracy, and cost

- Offline router fixture: 39/39 labelled cases and 331 deterministic assertions.
- Stored six-question live sample: 15/19 required facts (78.9%), 100% citation precision
  and completeness, zero unsupported claims, one full case pass, two fast and four Deep
  check runs, p50 4.915 seconds and p95 6.285 seconds.
- Relative cost: median 1 HydraDB call, mean 1.17 calls; fast costs 1 weighted unit and
  Deep check costs 3. No unverified USD price is invented.
- Strict 346-page PDF baseline: 20/22 cases and 53/56 facts before the final deployment
  rerun.

These numbers are different measurements and must never be merged into one accuracy
claim. Replace them only with the final post-deploy artifacts.

## Video demo

Record the public `/demo` route using [the canonical 60-second script](DEMO_SCRIPT_60S.md).
The URL is intentionally absent until the final public build and repository are verified.

## GitHub submission

<https://github.com/vaibhav4046/queueproof>

The repository must be public or explicitly shared with judges before this link is
submitted.

## LinkedIn and X/Twitter

Use the measured, boundary-aware drafts in [SOCIAL_POSTS.md](SOCIAL_POSTS.md) only after
the final release rerun. Update figures from artifacts rather than rounding them upward.

## Judge testing instructions

1. Open <https://queueproof.vercel.app/demo> with no account.
2. Run the preloaded AuthShield question.
3. Inspect mode, route reason, provider coverage, HydraDB calls, elapsed time, timeline,
   one citation receipt, promised versus actual, missing information, and next safe action.
4. Open **Benchmarks** to compare expected and observed output.
5. Open **Replay** to step through one measured run and download its JSON receipt.
6. Open <https://queueproof.vercel.app/method> for the trust and refusal boundaries.
7. Clone the repository and run the verification commands in the README.
