/**
 * Layout primitives and filler-page generators for the Helios Robotics handbook fixture.
 *
 * This module knows how to shape text into a page frame. It knows nothing about the planted
 * ground-truth facts, which live in handbook-content.mjs. Keeping the split means the filler can
 * never accidentally be treated as load-bearing, and the fact verification in the generator has a
 * clean corpus to check uniqueness against.
 *
 * Everything here is deterministic: a fixed seed drives every choice, so two runs on two machines
 * produce byte-identical output and therefore the same SHA-256.
 */
import { STYLES } from "./pdf-writer.mjs";

const FRAME_HEIGHT = 666; // CONTENT_TOP (726) down to CONTENT_BOTTOM (60)
const BODY_COLUMNS = 92; // Helvetica 10pt across a 468pt column
const MONO_COLUMNS = 84; // Courier 9pt across the same column

// ---------------------------------------------------------------------------
// Line primitives
// ---------------------------------------------------------------------------

export const line = (text, style = "body", indent = 0) => ({ text, style, indent });
export const blank = (count = 1) => Array.from({ length: count }, () => ({ text: "", style: "blank" }));
export const h1 = (text) => ({ text, style: "h1", rule: true });
export const h2 = (text) => ({ text, style: "h2" });
export const h3 = (text) => ({ text, style: "h3" });

/** Greedy wrap. Words longer than the column are left alone rather than sliced mid-token. */
export function wrap(text, columns = BODY_COLUMNS) {
  const words = text.split(/\s+/).filter(Boolean);
  const rows = [];
  let current = "";
  for (const word of words) {
    if (!current) current = word;
    else if (current.length + 1 + word.length <= columns) current += ` ${word}`;
    else {
      rows.push(current);
      current = word;
    }
  }
  if (current) rows.push(current);
  return rows;
}

export const para = (text, style = "body") => [...wrap(text).map((row) => line(row, style)), ...blank()];

export const bullet = (text) => {
  const rows = wrap(`- ${text}`, BODY_COLUMNS - 4);
  return rows.map((row, index) => line(index === 0 ? row : `  ${row}`, "body", 14));
};

export const monoBlock = (rows) => rows.map((row) => line(row.slice(0, MONO_COLUMNS), "mono"));

/**
 * Fixed-width table drawn with text, the way an operations handbook printed from plain text
 * would look. Widths are character counts; the caller keeps the total inside MONO_COLUMNS.
 */
export function table(headers, rows, widths) {
  const border = `+${widths.map((width) => "-".repeat(width + 2)).join("+")}+`;
  const format = (cells) =>
    `|${cells.map((cell, index) => ` ${String(cell).slice(0, widths[index]).padEnd(widths[index])} `).join("|")}|`;
  return monoBlock([border, format(headers), border, ...rows.map(format), border]);
}

/** Vertical space a line list consumes, used to keep filler inside the frame. */
export function measure(lines) {
  return lines.reduce((total, item) => total + STYLES[item.style ?? "body"].leading, 0);
}

/** Drop trailing lines until the page fits. Only ever applied to filler, never to anchor pages. */
export function capToFrame(lines) {
  const kept = [...lines];
  while (kept.length > 0 && measure(kept) >= FRAME_HEIGHT) kept.pop();
  return kept;
}

// ---------------------------------------------------------------------------
// Deterministic choice
// ---------------------------------------------------------------------------

export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rng, values) => values[Math.floor(rng() * values.length) % values.length];
const between = (rng, min, max) => min + Math.floor(rng() * (max - min + 1));

// ---------------------------------------------------------------------------
// Vocabulary. Original copy, written for this fixture.
// ---------------------------------------------------------------------------

const SUBSYSTEMS = [
  "fleet scheduler", "telemetry ingest", "charge dock controller", "waypoint planner",
  "manifest service", "credential broker", "payload arm firmware", "depot gateway",
  "battery health monitor", "route cache", "notification relay", "audit ledger",
  "simulation harness", "field diagnostics bundle", "dispatch queue", "map tile service",
];

const TEAMS = [
  "Fleet Platform", "Security Engineering", "Billing Systems", "Field Operations",
  "Developer Experience", "Site Reliability", "Customer Success", "Hardware Integration",
];

const SITES = ["Bengaluru", "Toronto", "Rotterdam", "Osaka", "Sao Paulo", "Manchester", "Denver"];

const STAFF = [
  "Daniel Okafor", "Marta Kilburn", "Ines Delacroix", "Tomas Berg", "Ayla Karim",
  "Ruth Vanterpool", "Kenji Sato", "Nadia Osei", "Owen Fitzgerald", "Salome Marks",
  "Viktor Lindqvist", "Hana Petrova", "Gregor Amsel", "Lucia Ferreira",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const CONSEQUENCE = [
  "the depot crew keeps a printed fallback checklist at the charge bay",
  "rollback stays a single command and never requires a database restore",
  "operators can answer a customer question without opening an engineering console",
  "the audit ledger records who approved the change and when",
  "a partial outage degrades to slower dispatch rather than a stopped fleet",
  "the on-call engineer is never the only person who can authorise a restart",
];

const RISK = [
  "a stale route cache can send a rover to a depot that closed for maintenance",
  "two operators can accept the same job when the dispatch queue partitions",
  "a firmware rollback loses the calibration profile written during the last service",
  "telemetry gaps longer than four minutes are indistinguishable from a parked rover",
  "billing retries can double count a delivery when the idempotency key is regenerated",
];

const date = (rng) => `${between(rng, 1, 28)} ${pick(rng, MONTHS)} ${pick(rng, [2030, 2031])}`;

// ---------------------------------------------------------------------------
// Filler page generators. Each returns { runningHead, lines }.
// Filler identifiers are drawn from ranges that cannot collide with, or contain as a substring,
// any planted identifier (BUG-123, ENG-456, INC-2031, PR-8871).
// ---------------------------------------------------------------------------

function policyPage(rng, index) {
  const code = `OPS-POL-${200 + index}`;
  const subsystem = pick(rng, SUBSYSTEMS);
  const team = pick(rng, TEAMS);
  return {
    runningHead: "Part I - Operating Policies",
    lines: [
      h1(`${code} ${subsystem.replace(/^\w/, (c) => c.toUpperCase())} operating rule`),
      ...blank(),
      line(`Owner: ${team}    Effective: ${date(rng)}    Review cycle: every ${between(rng, 2, 12)} months`, "small"),
      ...blank(),
      h2("Intent"),
      ...para(
        `This rule governs day to day handling of the ${subsystem} across all depots. It exists because ` +
          `${pick(rng, RISK)}, and because the ${team} rotation cannot depend on a single engineer being awake ` +
          "to interpret an ambiguous alert. The rule is binding on depot staff, remote operators, and any " +
          "contractor holding a temporary badge.",
      ),
      h2("Requirements"),
      ...bullet(
        `Every change to the ${subsystem} is announced in the depot channel at least ` +
          `${between(rng, 15, 90)} minutes before it starts.`,
      ),
      ...bullet(
        `A change is only in effect once the ${team} duty engineer has confirmed the post change health probe.`,
      ),
      ...bullet(
        `If the health probe fails twice, the change is reverted without further discussion and reopened as a ticket.`,
      ),
      ...bullet(`Records are retained for ${between(rng, 12, 84)} months in the audit ledger.`),
      ...blank(),
      h2("Rationale"),
      ...para(
        `The earlier revision of this rule allowed a verbal handover at shift change. In practice the handover ` +
          `was skipped whenever the depot was busy, which is exactly when it mattered. Writing the confirmation ` +
          `down costs a minute and means ${pick(rng, CONSEQUENCE)}.`,
      ),
      h2("Exceptions"),
      ...para(
        `A depot manager may suspend the announcement window during a declared incident. The suspension is ` +
          `logged, and the ${team} lead reviews every suspension at the weekly operations meeting. No exception ` +
          "extends past the end of the shift in which it was granted.",
      ),
    ],
  };
}

function escalationPage(rng, index) {
  const code = `ESC-${300 + index}`;
  const team = pick(rng, TEAMS);
  return {
    runningHead: "Part II - Customer Escalation Rules",
    lines: [
      h1(`${code} Escalation rule`),
      ...blank(),
      line(`Desk: ${team}    Region: ${pick(rng, SITES)}    Last reviewed: ${date(rng)}`, "small"),
      ...blank(),
      h2("Trigger"),
      ...para(
        `Raise this escalation when a customer reports that ${pick(rng, RISK)} and the depot cannot resolve it ` +
          `within ${between(rng, 20, 120)} minutes. The reporting customer does not need to name a subsystem; ` +
          "the desk classifies the report, not the customer.",
      ),
      h2("Response"),
      ...bullet(`Acknowledge to the customer within ${between(rng, 5, 60)} minutes, in writing.`),
      ...bullet(`Page the ${team} duty engineer and record the page reference on the ticket.`),
      ...bullet("Post a status note every hour until the customer confirms the impact has stopped."),
      ...bullet("Close only after the customer, not the engineer, agrees the issue is resolved."),
      ...blank(),
      h2("Handling notes"),
      ...para(
        "Do not offer a credit before the impact window is measured. Estimated credits that later shrink cost " +
          "more trust than a slower and correct number. If the customer asks for a root cause before the review " +
          "is finished, share the timeline that is known and say plainly which parts are still being confirmed.",
      ),
      ...para(
        `Escalations that cross a regional boundary move to the ${pick(rng, SITES)} desk at the start of the next ` +
          "shift, with a written handover that names the open questions.",
      ),
    ],
  };
}

function adrPage(rng, index) {
  const number = String(100 + index).padStart(3, "0");
  const subsystem = pick(rng, SUBSYSTEMS);
  return {
    runningHead: "Part V - Architecture Decision Records",
    lines: [
      h1(`ADR-${number} ${subsystem.replace(/^\w/, (c) => c.toUpperCase())}`),
      ...blank(),
      line(`Status: Accepted    Decided: ${date(rng)}    Author: ${pick(rng, STAFF)}`, "small"),
      ...blank(),
      h2("Context"),
      ...para(
        `The ${subsystem} was built for a single depot and now serves ${between(rng, 4, 40)} of them. The original ` +
          `design assumed an operator could watch the console during a run, which stopped being true once the ` +
          `${pick(rng, SITES)} depot moved to unattended overnight shifts. ${pick(rng, RISK).replace(/^\w/, (c) => c.toUpperCase())}.`,
      ),
      h2("Decision"),
      ...para(
        `We split the ${subsystem} into a control path and a reporting path. The control path is synchronous, ` +
          `bounded to ${between(rng, 200, 900)} milliseconds, and refuses work it cannot finish. The reporting ` +
          "path is allowed to lag and is rebuilt from the event log if it falls behind.",
      ),
      h2("Consequences"),
      ...bullet(`Positive: ${pick(rng, CONSEQUENCE)}.`),
      ...bullet("Positive: the control path can be load tested without generating fake reporting data."),
      ...bullet("Negative: two paths mean two deployment steps, and they can drift in configuration."),
      ...bullet(`Negative: reporting lag of up to ${between(rng, 2, 30)} minutes is now normal and must be explained to operators.`),
      ...blank(),
      h2("Alternatives considered"),
      ...para(
        "Keeping one path and adding a queue in front was cheaper to build but moved the failure to a place " +
          "with no operator visibility. Buying a managed workflow engine was rejected on cost and on the " +
          "offline requirement at depots with intermittent links.",
      ),
    ],
  };
}

function incidentPage(rng, index) {
  const code = `INC-33${String(index % 100).padStart(2, "0")}`;
  const subsystem = pick(rng, SUBSYSTEMS);
  const minutes = between(rng, 6, 180);
  return {
    runningHead: "Part IV - Incident Reports",
    lines: [
      h1(`${code} ${subsystem.replace(/^\w/, (c) => c.toUpperCase())} degradation`),
      ...blank(),
      line(
        `Severity: SEV-${between(rng, 2, 4)}    Date: ${date(rng)}    Impact window: ${minutes} minutes    ` +
          `Commander: ${pick(rng, STAFF)}`,
        "small",
      ),
      ...blank(),
      h2("Summary"),
      ...para(
        `The ${subsystem} returned errors to ${between(rng, 2, 60)} percent of requests for ${minutes} minutes. ` +
          `Deliveries continued on the cached plan, so no rover stopped, but operators could not see live status ` +
          `at the ${pick(rng, SITES)} depot for the duration.`,
      ),
      h2("Timeline"),
      ...monoBlock([
        `  T+00   automated alert fires on error rate above ${between(rng, 2, 9)} percent`,
        `  T+0${between(rng, 2, 9)}   duty engineer acknowledges and opens the incident channel`,
        `  T+${between(rng, 10, 40)}   cause narrowed to a configuration change shipped earlier that day`,
        `  T+${between(rng, 41, 70)}   change reverted, error rate falls within two minutes`,
        `  T+${minutes}   customer facing status updated and incident closed`,
      ]),
      ...blank(),
      h2("Root cause"),
      ...para(
        `A configuration value was tightened without a matching change to the client timeout. Requests that ` +
          "would previously have completed slowly were cut off instead, and the retry storm that followed kept " +
          "the service saturated until the change was reverted.",
      ),
      h2("Follow up"),
      ...bullet("Client and server timeouts are now asserted against each other in the deployment check."),
      ...bullet(`Alert threshold lowered so the page fires ${between(rng, 2, 9)} minutes earlier.`),
    ],
  };
}

function runbookPage(rng, index) {
  const subsystem = pick(rng, SUBSYSTEMS);
  return {
    runningHead: "Part VI - Field Runbooks",
    lines: [
      h1(`Runbook RB-${400 + index}: recover the ${subsystem}`),
      ...blank(),
      line(`Expected duration: ${between(rng, 5, 45)} minutes    Requires: depot badge, console access`, "small"),
      ...blank(),
      h2("When to use this"),
      ...para(
        `Use this runbook when the ${subsystem} health probe has failed twice in a row, or when an operator ` +
          "reports that status has not moved for more than four minutes. Do not use it during a declared " +
          "incident unless the incident commander asks for it by name.",
      ),
      h2("Procedure"),
      ...bullet("Confirm the failure on the depot console. A single failed probe is not enough."),
      ...bullet(`Capture the diagnostics bundle before restarting anything. Restarting first destroys the evidence.`),
      ...bullet(`Drain the ${subsystem} and wait for in flight work to finish, up to ${between(rng, 30, 180)} seconds.`),
      ...bullet("Restart the service and watch the probe for two consecutive passes."),
      ...bullet("If the probe fails again, stop and escalate rather than restarting a third time."),
      ...blank(),
      h2("Verification"),
      ...para(
        `The recovery is complete when the probe has passed twice, the dispatch queue depth is falling, and an ` +
          `operator at ${pick(rng, SITES)} confirms live status is moving again. Record the diagnostics bundle ` +
          "reference on the ticket even when the restart worked.",
      ),
      h2("If this does not work"),
      ...para(
        `Escalate to the ${pick(rng, TEAMS)} duty engineer with the bundle reference and the exact probe output. ` +
          "Do not roll back firmware as a first response; firmware rollback needs its own approval.",
      ),
    ],
  };
}

function changelogPage(rng, index) {
  const rows = Array.from({ length: 9 }, (_, row) => {
    const identifier = `PR-9${String((index * 9 + row) % 900 + 100).padStart(3, "0")}`;
    return [identifier, date(rng), pick(rng, SUBSYSTEMS).slice(0, 24), pick(rng, STAFF).split(" ")[1]];
  });
  return {
    runningHead: "Part VII - Change Log",
    lines: [
      h1(`Change log, sheet ${index + 1}`),
      ...blank(),
      ...para(
        "Merged changes are listed in the order they reached the depot fleet, not the order they were reviewed. " +
          "A change that was reviewed weeks earlier but held for a maintenance window appears at its release date.",
      ),
      ...table(["Change", "Released", "Area", "Owner"], rows, [10, 18, 24, 16]),
      ...blank(),
      h2("Notes"),
      ...para(
        `Sheet ${index + 1} covers routine work only. Changes that required a safety review are listed in the ` +
          "architecture decision records instead, with the review reference attached.",
      ),
      ...bullet("A blank owner column means the change was released by the automated dependency job."),
      ...bullet("Released dates are depot local time at the first depot to receive the change."),
    ],
  };
}

function projectPage(rng, index) {
  const team = pick(rng, TEAMS);
  const subsystem = pick(rng, SUBSYSTEMS);
  return {
    runningHead: "Part III - Project Workstreams",
    lines: [
      h1(`Workstream note WS-${500 + index}`),
      ...blank(),
      line(`Team: ${team}    Site: ${pick(rng, SITES)}    Week ending: ${date(rng)}`, "small"),
      ...blank(),
      h2("Progress"),
      ...para(
        `The ${subsystem} migration reached ${between(rng, 10, 95)} percent of depots this week. The remaining ` +
          `sites are held by a hardware dependency rather than by software readiness, and the ${team} team has ` +
          "stopped adding scope until those sites are scheduled.",
      ),
      h2("Risks"),
      ...bullet(`${pick(rng, RISK).replace(/^\w/, (c) => c.toUpperCase())}.`),
      ...bullet(`Two engineers on this workstream rotate onto on call next month, which halves review capacity.`),
      ...blank(),
      h2("Decisions taken this week"),
      ...para(
        `We will not backport the change to the previous depot image. Sites still on that image are scheduled ` +
          `for replacement before ${date(rng)}, and maintaining two images through the transition costs more ` +
          "review time than the replacement itself.",
      ),
      h2("Asks"),
      ...bullet("One reviewer from Site Reliability for the rollout window."),
      ...bullet(`A depot slot at ${pick(rng, SITES)} for the hardware dependency check.`),
    ],
  };
}

function appendixPage(rng, index) {
  const subsystem = pick(rng, SUBSYSTEMS);
  return {
    runningHead: "Part VIII - Appendices",
    lines: [
      h1(`Reference sheet A-${600 + index}`),
      ...blank(),
      h2(`Configuration defaults for the ${subsystem}`),
      ...table(
        ["Setting", "Default", "Safe range"],
        [
          ["probe interval", `${between(rng, 5, 60)}s`, "5s to 120s"],
          ["retry budget", `${between(rng, 1, 6)}`, "1 to 8"],
          ["queue depth alarm", `${between(rng, 50, 900)}`, "50 to 2000"],
          ["cache lifetime", `${between(rng, 1, 24)}h`, "1h to 48h"],
        ],
        [28, 14, 22],
      ),
      ...blank(),
      h2("Reading this sheet"),
      ...para(
        "Defaults are what a new depot receives on first boot. The safe range is what an operator may change " +
          "without a review. Anything outside the safe range needs an architecture decision record, even when " +
          "the value looks harmless, because the ranges encode load testing that was done once and not repeated.",
      ),
      h2("Related material"),
      ...bullet(`Field runbooks for the ${subsystem} recovery procedure.`),
      ...bullet("The escalation rules that reference queue depth alarms."),
      ...bullet("Change log sheets covering the last two release trains."),
    ],
  };
}

const GENERATORS = {
  policy: policyPage,
  escalation: escalationPage,
  adr: adrPage,
  incident: incidentPage,
  runbook: runbookPage,
  changelog: changelogPage,
  project: projectPage,
  appendix: appendixPage,
};

/** Build one filler page of the requested kind, capped so it can never overflow the frame. */
export function fillerPage(kind, pageNumber) {
  const generator = GENERATORS[kind];
  if (!generator) throw new Error(`unknown filler kind: ${kind}`);
  const rng = mulberry32(0x5e1f0000 + pageNumber);
  const page = generator(rng, pageNumber);
  return { runningHead: page.runningHead, lines: capToFrame(page.lines) };
}
