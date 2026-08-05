# QueueProof design system

**Direction:** Ember Evidence Assistant.

**Product job:** ask one work question, get one sourced answer, understand disagreement, and prepare a safe next action that cannot run without approval.

**Audience:** daily operators first; hackathon judges and AI-tool developers second.

## Signature

The revolving ember evidence core is the single expressive object. It represents sources being gathered into a grounded answer. The rest of the product is deliberately quiet: ink-black workspace surfaces, warm readable text, thin borders, and orange only for brand, active navigation, focus, and primary actions.

The proof-seal Q mark uses one continuous Q and one orange check. Do not add satellite dots, gradients, mascots, or decorative marks to the logo.

## Tokens

| Role | Value |
| --- | --- |
| Ink background | `#050403` |
| Sidebar / coal | `#070605` |
| Panel | `#0B0907` |
| Raised panel | `#120E0B` |
| Hover | `#1A130E` |
| Primary text | `#FAF7F2` |
| Secondary text | `#C0B7AF` |
| Muted text | `#9A9088` |
| Ember action | `#FF6A00` |
| Ember highlight | `#FF9A42` |
| Verified | `#55D99A` |
| Warning | `#F4BA66` |
| Danger | `#FF786C` |
| Hairline | `rgba(255,255,255,.085)` |
| Active hairline | `rgba(255,154,66,.28)` |

Geist is the interface face. Geist Mono is reserved for receipt IDs, commands, timestamps, source identifiers, and measured values. Body text is never smaller than 14px. Labels and navigation never fall below 11px. Controls are at least 44px high.

## Hierarchy

- Ask is the daily-driver home. The working composer appears in the first viewport on every phone.
- Today turns evidence into a short ranked work list.
- Sources shows real verified connectors before diagnostic detail.
- History reopens saved investigations.
- Review changes exposes the exact provider payload and approval boundary.
- Connect AI explains and configures the MCP workflow.
- Benchmarks, Replay, Method, and Owner remain available but never compete with the daily workflow.

Desktop uses a fixed 264px ink sidebar. Mobile uses one 60px header and one five-item dock. Neither may be grey, brown, blue, or green. The command menu is a contained dialog on desktop and a keyboard-safe sheet on mobile.

## Plain-language rules

- Say “verified source,” not “live system,” unless a request was just checked.
- Say “proposed changes,” not “action ledger.”
- Say “runs once,” not “unique execution claim.”
- Say “provider cited,” not “source checked,” when the metric is provider coverage.
- A one-provider state mismatch is “tracking mismatch.” “Sources disagree” requires at least two providers.
- Every unavailable owner action links to Owner sign-in; never render a disabled dead end.

## Motion

- Hover and focus: 150–180ms.
- Navigation and layout: 180–260ms.
- Drawers and sheets: 220–300ms.
- The evidence core is the only ambient animation.
- Scroll reveals use short opacity and 8px vertical travel.
- Reduced motion removes ambient rotation and all nonessential transforms.

Motion may clarify state, hierarchy, or navigation. It may never delay the composer, hide connector truth, manufacture workflow activity, or cover an interactive control.

## Truth, safety, and accessibility

- Never hardcode connector truth, answer citations, latency, benchmark passes, or provider execution.
- REVIEW remains a failure until the frozen requirement passes.
- Verified connector rows show the last proof time; failed connectors stay out of answers.
- External writes are owner-only, evidence-linked, reviewable, and at-most-once.
- MCP connection metadata and keys are owner-only. Plaintext keys are shown once and never stored.
- Color is never the sole state signal.
- Primary and secondary text meet WCAG AA against their surfaces.
- Dialogs trap focus, Escape closes the top-most layer, and focus returns to the invoker.
- Mobile sheets respect dynamic viewport height and safe areas; fixed navigation never overlaps a primary action.
