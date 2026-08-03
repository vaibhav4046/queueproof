/**
 * The Helios Robotics Operations Handbook: an original, fictional document written for this
 * repository as a retrieval fixture. No third-party text is reproduced here.
 *
 * The point of the fixture is the *planting*, not the prose. PLANTED_FACTS is the single source of
 * truth: every fact carries the page it lives on, the question an evaluation should ask, the answer
 * it should get, and an `evidence` phrase that the generator asserts appears on that page and
 * nowhere else in the document. If a page is edited so a fact moves or is repeated, generation
 * fails instead of silently shipping a fixture whose ground truth has drifted.
 *
 * Deliberate structure:
 *   - Load-bearing facts sit at page 3, page 160 and page 340, each stated exactly once.
 *   - OPS-POL-14 on page 7 is explicitly superseded by ADR-037 on page 231, seven months later.
 *   - Priya Raman and Priya Ramanathan are different people with different roles and employee IDs.
 *   - The Hindi commitment appears three ways: Devanagari in a page annotation and in the document
 *     Keywords entry (both UTF-16BE with a byte order mark), and a marked Latin transliteration in
 *     the page text, because a standard Type1 font cannot draw Devanagari glyphs.
 *   - Pages 290 to 292 are distractors: withdrawn drafts, lookalike terminology, training drills.
 */
import { blank, bullet, fillerPage, h1, h2, h3, line, monoBlock, para, table } from "./handbook-text.mjs";

export const TOTAL_PAGES = 346;

const CHARTER = "HR-CHARTER-9";
const CHARTER_DATE = "12 January 2031";
const STOP_WORK_AUTHORITY = "Duty Operations Lead";
const ATLAS_GA = "14 March 2031";
const AUTHSHIELD_DUE = "30 June 2031";
const BILLING_CUTOVER = "1 October 2031";
const ROVER_FREEZE = "15 November 2031";
const OPS_POL_14_DATE = "3 February 2031";
const ADR_037_DATE = "9 September 2031";
const BEACON_CADENCE = "90 seconds";
const RING_BUFFER_FRAMES = "4096";
const BATTERY_RESERVE = "18 percent";

const HINDI_COMMITMENT =
  "हेलिओस रोबोटिक्स " +
  "की सुरक्षा टीम वचन " +
  "देती है कि ENG-456 के तहत " +
  "AuthShield ऑपरेटर टोकन का " +
  "जीवनकाल 30 जून 2031 तक " +
  "घटाकर पंद्रह मिनट " +
  "कर दिया जाएगा।";

const HINDI_TRANSLITERATION =
  "Helios Robotics ki suraksha team vachan deti hai ki ENG-456 ke tahat AuthShield operator " +
  "token ka jeevankaal 30 June 2031 tak ghatakar pandrah minute kar diya jaayega.";

// ---------------------------------------------------------------------------
// Ground truth. `evidence` is checked against the rendered page; the other keys are the fixture.
// ---------------------------------------------------------------------------

const PLANTED_FACT_DEFINITIONS = [
  {
    id: "fact-begin-stop-work",
    page: 3,
    kind: "beginning_load_bearing",
    question: "Who at Helios Robotics holds the sole authority to declare a fleet wide stop work?",
    expectedAnswer: `The ${STOP_WORK_AUTHORITY}.`,
    exactIdentifier: null,
    evidence: `the sole authority to declare a fleet wide stop work rests with the ${STOP_WORK_AUTHORITY}`,
  },
  {
    id: "fact-charter-id",
    page: 3,
    kind: "exact_identifier",
    question: "Which charter governs the Helios Robotics operations handbook, and when was it ratified?",
    expectedAnswer: `${CHARTER}, ratified on ${CHARTER_DATE}.`,
    exactIdentifier: CHARTER,
    evidence: `${CHARTER}, ratified on ${CHARTER_DATE}`,
  },
  {
    id: "fact-superseded-policy",
    page: 7,
    kind: "superseded_policy_original",
    question: "What did OPS-POL-14 originally permit for Rover SDK field firmware flashing?",
    expectedAnswer:
      "A single Tier 2 engineer could flash Rover SDK field firmware without a second approver while the rover " +
      "was on a maintenance stand. This permission is no longer in force.",
    exactIdentifier: "OPS-POL-14",
    evidence: "a single Tier 2 engineer may flash Rover SDK field firmware without a second approver",
  },
  {
    id: "fact-superseding-decision",
    page: 231,
    kind: "superseding_decision",
    question: "Is the single approver firmware flashing rule in OPS-POL-14 still in force?",
    expectedAnswer:
      `No. ADR-037, dated ${ADR_037_DATE}, supersedes OPS-POL-14 and requires two approvers, one of whom must ` +
      "be a Safety Case Owner.",
    exactIdentifier: "ADR-037",
    evidence: `ADR-037, dated ${ADR_037_DATE}, supersedes OPS-POL-14`,
  },
  {
    id: "fact-escalation-sev1",
    page: 46,
    kind: "table_lookup",
    question: "In the escalation severity matrix, what is the SEV-1 acknowledgement target and who approves it?",
    expectedAnswer: `5 minutes, approved by the ${STOP_WORK_AUTHORITY}.`,
    exactIdentifier: null,
    evidence: `SEV-1 | 5 minutes | ${STOP_WORK_AUTHORITY}`,
  },
  {
    id: "fact-alias-rover-sdk",
    page: 80,
    kind: "project_alias",
    question: "Which internal programme code does the project alias Rover SDK refer to?",
    expectedAnswer: "HR-P4, the field autonomy toolkit.",
    exactIdentifier: "HR-P4",
    evidence: "Rover SDK | HR-P4 | Field autonomy toolkit",
  },
  {
    id: "fact-atlas-deadline",
    page: 81,
    kind: "deadline",
    question: "What was the committed general availability date for Atlas Launch?",
    expectedAnswer: ATLAS_GA,
    exactIdentifier: null,
    evidence: `Atlas Launch reached general availability on ${ATLAS_GA}`,
  },
  {
    id: "fact-eng-456",
    page: 82,
    kind: "exact_identifier",
    question: "What work does ENG-456 track and when is it due?",
    expectedAnswer: `ENG-456 reduces the AuthShield operator token lifetime to fifteen minutes, due ${AUTHSHIELD_DUE}.`,
    exactIdentifier: "ENG-456",
    evidence: "ENG-456 reduces the AuthShield operator token lifetime to fifteen minutes",
  },
  {
    id: "fact-hindi-commitment",
    page: 83,
    kind: "hindi_commitment",
    question: "Which English issue identifier does the Hindi language commitment in the security section refer to?",
    expectedAnswer:
      `ENG-456. The commitment states that the AuthShield operator token lifetime will be cut to fifteen ` +
      `minutes by ${AUTHSHIELD_DUE}.`,
    exactIdentifier: "ENG-456",
    evidence: "vachan deti hai ki ENG-456 ke tahat AuthShield operator token ka jeevankaal",
  },
  {
    id: "fact-billing-cutover",
    page: 84,
    kind: "deadline",
    question: "When is the Billing Migration ledger cutover scheduled?",
    expectedAnswer: BILLING_CUTOVER,
    exactIdentifier: null,
    evidence: `The Billing Migration ledger cutover is scheduled for ${BILLING_CUTOVER}`,
  },
  {
    id: "fact-rover-freeze",
    page: 85,
    kind: "deadline",
    question: "What is the code freeze date for Rover SDK 5.0?",
    expectedAnswer: ROVER_FREEZE,
    exactIdentifier: null,
    evidence: `Rover SDK 5.0 enters code freeze on ${ROVER_FREEZE}`,
  },
  {
    id: "fact-bug-123",
    page: 120,
    kind: "exact_identifier",
    question: "What defect does BUG-123 record and in which release was it fixed?",
    expectedAnswer: "Odometry drift after cold boot, fixed in Rover SDK 4.2.1 released on 21 May 2031.",
    exactIdentifier: "BUG-123",
    evidence: "BUG-123 records odometry drift after cold boot",
  },
  {
    id: "fact-pr-8871",
    page: 121,
    kind: "exact_identifier",
    question: "What did PR-8871 change and when was it merged?",
    expectedAnswer: "The Atlas Launch telemetry schema version 3, merged on 2 July 2031.",
    exactIdentifier: "PR-8871",
    evidence: "PR-8871 merged the Atlas Launch telemetry schema version 3 on 2 July 2031",
  },
  {
    id: "fact-middle-beacon",
    page: 160,
    kind: "middle_load_bearing",
    question: "What beacon cadence do Rover SDK units fall back to during a communications blackout?",
    expectedAnswer: BEACON_CADENCE,
    exactIdentifier: null,
    evidence: `fall back to a beacon cadence of ${BEACON_CADENCE}`,
  },
  {
    id: "fact-middle-buffer",
    page: 160,
    kind: "single_source_fact",
    question: "How many telemetry frames does a Rover SDK unit retain in its onboard ring buffer during a blackout?",
    expectedAnswer: RING_BUFFER_FRAMES,
    exactIdentifier: null,
    evidence: `retains the last ${RING_BUFFER_FRAMES} telemetry frames in the onboard ring buffer`,
  },
  {
    id: "fact-inc-2031",
    page: 180,
    kind: "exact_identifier",
    question: "What happened in INC-2031 and how long did customer impact last?",
    expectedAnswer: "A Billing Migration double charge event on 8 April 2031, with 41 minutes of customer impact.",
    exactIdentifier: "INC-2031",
    evidence: "INC-2031 was a Billing Migration double charge event on 8 April 2031",
  },
  {
    id: "fact-incident-table",
    page: 181,
    kind: "table_lookup",
    question: "In the incident log summary, what severity and impact window are recorded against INC-2031?",
    expectedAnswer: "SEV-2, with a 41 minute impact window.",
    exactIdentifier: "INC-2031",
    evidence: "INC-2031 | 8 April 2031 | SEV-2 | 41 min",
  },
  {
    id: "fact-priya-raman",
    page: 203,
    kind: "entity_disambiguation",
    question: "What is Priya Raman's role at Helios Robotics and which programme does she own?",
    expectedAnswer: "Staff Reliability Engineer, employee HR-2214, engineering owner of AuthShield.",
    exactIdentifier: "HR-2214",
    evidence: "Priya Raman, Staff Reliability Engineer, employee HR-2214",
  },
  {
    id: "fact-priya-ramanathan",
    page: 203,
    kind: "entity_disambiguation",
    question: "What is Priya Ramanathan's role at Helios Robotics and which desk does she run?",
    expectedAnswer: "Customer Escalation Manager, employee HR-5871, running the Billing Migration escalation desk.",
    exactIdentifier: "HR-5871",
    evidence: "Priya Ramanathan, Customer Escalation Manager, employee HR-5871",
  },
  {
    id: "fact-oncall-ring0",
    page: 204,
    kind: "table_lookup",
    question: "Who is the Ring 0 on call contact for the Bengaluru depot?",
    expectedAnswer: "Priya Raman.",
    exactIdentifier: null,
    evidence: "Ring 0 | Bengaluru | Priya Raman | AuthShield",
  },
  {
    id: "fact-distractor-draft",
    page: 290,
    kind: "distractor_discrimination",
    question: "Does DRAFT-OPS-14 permit single engineer firmware flashing today?",
    expectedAnswer:
      "No. DRAFT-OPS-14 was never ratified and carries no operational authority. The binding rule is ADR-037, " +
      "which requires two approvers.",
    exactIdentifier: "DRAFT-OPS-14",
    evidence: "DRAFT-OPS-14 was never ratified and carries no operational authority",
  },
  {
    id: "fact-end-battery",
    page: 340,
    kind: "end_load_bearing",
    question: "What share of the 2032 capital expenditure is reserved for battery replacement?",
    expectedAnswer: BATTERY_RESERVE,
    exactIdentifier: null,
    evidence: `reserves ${BATTERY_RESERVE} of 2032 capital expenditure for battery replacement`,
  },
];

const anyFact = (id, label, ...anyOf) => ({ id, label, anyOf });
const allFact = (id, label, ...allOf) => ({ id, label, allOf });

/**
 * Semantic answer requirements live beside the planted source facts so regenerating the PDF
 * cannot silently replace the strict grader fixture with question/answer prose alone.
 */
const REQUIRED_FACTS_BY_ID = {
  "fact-begin-stop-work": [
    anyFact("stop-work-authority", "The Duty Operations Lead has sole authority", "Duty Operations Lead"),
  ],
  "fact-charter-id": [
    anyFact("charter", "The governing charter is HR-CHARTER-9", "HR-CHARTER-9"),
    anyFact("ratified", "The charter was ratified on 12 January 2031", "12 January 2031"),
  ],
  "fact-superseded-policy": [
    anyFact("single-engineer", "A single Tier 2 engineer could perform the flash", "single Tier 2 engineer"),
    allFact("field-firmware", "The permission covered Rover SDK field firmware flashing", ["Rover SDK"], ["field firmware"], ["flash", "flashing"]),
    anyFact("without-second-approver", "No second approver was required", "without a second approver", "no second approver"),
    anyFact("maintenance-stand", "The rover had to be on a maintenance stand", "maintenance stand"),
    anyFact("no-longer-force", "The permission is no longer in force", "no longer in force", "permission is withdrawn", "permission was withdrawn", "policy was superseded"),
  ],
  "fact-superseding-decision": [
    anyFact("not-in-force", "The single-approver rule is not in force", "not in force", "no longer in force", "withdrawn", "must not be relied on"),
    anyFact("decision", "ADR-037 is the superseding decision", "ADR-037"),
    anyFact("decision-date", "ADR-037 is dated 9 September 2031", "9 September 2031"),
    allFact("supersedes-policy", "ADR-037 supersedes OPS-POL-14", ["supersedes", "superseded"], ["OPS-POL-14"]),
    anyFact("two-approvers", "Two approvers are required", "two approvers", "two-approver"),
    anyFact("safety-owner", "One approver must be a Safety Case Owner", "Safety Case Owner"),
  ],
  "fact-escalation-sev1": [
    anyFact("severity", "The row is SEV-1", "SEV-1"),
    anyFact("ack-target", "The acknowledgement target is 5 minutes", "5 minutes"),
    anyFact("approver", "The Duty Operations Lead approves it", "Duty Operations Lead"),
  ],
  "fact-alias-rover-sdk": [
    anyFact("alias", "The alias is Rover SDK", "Rover SDK"),
    anyFact("programme-code", "The programme code is HR-P4", "HR-P4"),
    anyFact("scope", "The programme is the field autonomy toolkit", "field autonomy toolkit"),
  ],
  "fact-atlas-deadline": [
    anyFact("ga-date", "Atlas Launch general availability was 14 March 2031", "14 March 2031"),
  ],
  "fact-eng-456": [
    anyFact("issue", "The issue is ENG-456", "ENG-456"),
    allFact("work", "It reduces the AuthShield operator token lifetime", ["AuthShield"], ["operator token lifetime"], ["reduces", "reduced"]),
    anyFact("lifetime", "The target lifetime is fifteen minutes", "fifteen minutes"),
    anyFact("due-date", "It is due 30 June 2031", "30 June 2031"),
  ],
  "fact-hindi-commitment": [
    anyFact("issue", "The English issue identifier is ENG-456", "ENG-456"),
    allFact("commitment", "The commitment concerns the AuthShield operator token lifetime", ["AuthShield"], ["operator token lifetime"]),
    anyFact("lifetime", "The target lifetime is fifteen minutes in English", "fifteen minutes"),
    anyFact("date", "The commitment is due 30 June 2031", "30 June 2031"),
  ],
  "fact-billing-cutover": [
    anyFact("cutover-date", "The ledger cutover is scheduled for 1 October 2031", "1 October 2031"),
  ],
  "fact-rover-freeze": [
    anyFact("freeze-date", "The Rover SDK 5.0 code freeze is 15 November 2031", "15 November 2031"),
  ],
  "fact-bug-123": [
    allFact("defect", "BUG-123 records odometry drift after cold boot", ["odometry drift"], ["cold boot"]),
    anyFact("release", "It was fixed in Rover SDK 4.2.1", "Rover SDK 4.2.1"),
    anyFact("release-date", "The release date was 21 May 2031", "21 May 2031"),
  ],
  "fact-pr-8871": [
    allFact("change", "PR-8871 changed the Atlas Launch telemetry schema version 3", ["Atlas Launch"], ["telemetry schema version 3"]),
    anyFact("merge-date", "It merged on 2 July 2031", "2 July 2031"),
  ],
  "fact-middle-beacon": [
    anyFact("beacon-cadence", "The fallback beacon cadence is 90 seconds", "90 seconds"),
  ],
  "fact-middle-buffer": [
    anyFact("buffer-frames", "The ring buffer retains 4096 telemetry frames", "4096"),
  ],
  "fact-inc-2031": [
    allFact("event", "INC-2031 was a Billing Migration double charge event", ["Billing Migration"], ["double charge"]),
    anyFact("event-date", "It happened on 8 April 2031", "8 April 2031"),
    allFact("impact", "Customer impact lasted 41 minutes", ["41 minutes", "41 minute", "41 min"], ["customer impact", "customer visible"]),
  ],
  "fact-incident-table": [
    anyFact("severity", "INC-2031 is SEV-2", "SEV-2"),
    anyFact("impact-window", "The impact window is 41 minutes", "41 minutes", "41 minute", "41 min"),
  ],
  "fact-priya-raman": [
    anyFact("role", "Priya Raman is a Staff Reliability Engineer", "Staff Reliability Engineer"),
    anyFact("employee", "Her employee identifier is HR-2214", "HR-2214"),
    allFact("ownership", "She is the engineering owner of AuthShield", ["engineering owner"], ["AuthShield"]),
  ],
  "fact-priya-ramanathan": [
    anyFact("role", "Priya Ramanathan is a Customer Escalation Manager", "Customer Escalation Manager"),
    anyFact("employee", "Her employee identifier is HR-5871", "HR-5871"),
    allFact("desk", "She runs the Billing Migration escalation desk", ["Billing Migration"], ["escalation desk"]),
  ],
  "fact-oncall-ring0": [
    anyFact("ring-zero-contact", "The Ring 0 Bengaluru contact is Priya Raman", "Priya Raman"),
  ],
  "fact-distractor-draft": [
    anyFact("not-permitted", "The draft does not permit single-engineer flashing today", "does not permit", "neither the draft nor the superseded policy permits", "not permitted"),
    anyFact("never-ratified", "DRAFT-OPS-14 was never ratified", "never ratified"),
    anyFact("no-authority", "The draft has no operational authority", "no operational authority"),
    anyFact("binding-rule", "ADR-037 is the binding rule", "ADR-037"),
    anyFact("two-approvers", "The binding rule requires two approvers", "two approvers", "two-approver"),
  ],
  "fact-end-battery": [
    anyFact("battery-share", "Battery replacement receives 18 percent", "18 percent", "18%"),
  ],
};

export const PLANTED_FACTS = PLANTED_FACT_DEFINITIONS.map((fact) => {
  const requiredFacts = REQUIRED_FACTS_BY_ID[fact.id];
  if (!requiredFacts?.length) throw new Error(`Missing required fact set for ${fact.id}.`);
  return { ...fact, requiredFacts };
});

/**
 * Every page on which a planted identifier is allowed to appear. The generator asserts the real
 * document matches exactly, so a stray mention in filler is caught rather than quietly making an
 * exact-identifier lookup ambiguous.
 */
export const IDENTIFIER_PAGES = {
  [CHARTER]: [1, 3], // named on the title page, defined on page 3
  "OPS-POL-14": [7, 231, 290],
  "ADR-037": [231, 290],
  "HR-P4": [80, 85], // registry entry on page 80, programme dossier on page 85
  "ENG-456": [82, 83],
  "BUG-123": [120],
  "PR-8871": [121],
  "INC-2031": [180, 181],
  "HR-2214": [203],
  "HR-5871": [203],
  "DRAFT-OPS-14": [290],
};

export const DOCUMENT_INFO = {
  title: "Helios Robotics Operations Handbook, Revision 7",
  author: "Helios Robotics Fleet Operations",
  subject:
    "Operating policies, architecture decision records, incident reports and customer escalation rules for the " +
    "Helios Robotics depot fleet. Fictional document, written as a retrieval test fixture.",
  keywords: `Helios Robotics; Atlas Launch; AuthShield; Billing Migration; Rover SDK; ${HINDI_COMMITMENT}`,
  producer: "queueproof scripts/generate-large-pdf.mjs",
  footerLabel: "Helios Robotics Operations Handbook, Revision 7",
  date: "D:20310902120000Z",
};

export const ANNOTATIONS = [
  {
    page: 83,
    rect: [498, 688, 514, 704],
    title: "Helios Robotics Security Engineering",
    contents: HINDI_COMMITMENT,
  },
];

// ---------------------------------------------------------------------------
// Anchor pages
// ---------------------------------------------------------------------------

const POLICY_HEAD = "Part I - Operating Policies";
const ESCALATION_HEAD = "Part II - Customer Escalation Rules";
const PROJECT_HEAD = "Part III - Project Workstreams";
const INCIDENT_HEAD = "Part IV - Incident Reports";
const ADR_HEAD = "Part V - Architecture Decision Records";
const RUNBOOK_HEAD = "Part VI - Field Runbooks";
const CHANGELOG_HEAD = "Part VII - Change Log";
const APPENDIX_HEAD = "Part VIII - Appendices";

const ANCHORS = new Map();
const anchor = (pageNumber, runningHead, lines) => ANCHORS.set(pageNumber, { runningHead, lines });

anchor(1, "Front Matter", [
  ...blank(4),
  line("Helios Robotics", "title"),
  line("Operations Handbook", "title"),
  ...blank(2),
  line("Revision 7", "h2"),
  line(`Issued under charter ${CHARTER}`, "h3"),
  ...blank(3),
  ...para(
    "This handbook is the operating record of the Helios Robotics depot fleet. It collects the policies that " +
      "bind depot staff, the architecture decisions that explain why the systems behave as they do, the incident " +
      "reports that were written after things went wrong, and the escalation rules that govern what a customer " +
      "is told and when.",
  ),
  ...para(
    "Helios Robotics is a fictional company. This document is original material written as a retrieval test " +
      "fixture. Nothing in it describes a real organisation, a real person, or a real system.",
  ),
  ...blank(2),
  line("Distribution: internal, all depots", "small"),
  line("Retention: superseded revisions are archived, never deleted", "small"),
]);

anchor(2, "Front Matter", [
  h1("How to read this handbook"),
  ...blank(),
  ...para(
    "The handbook is ordered by how often a page is needed during a shift, not by how important it is. Policies " +
      "come first because they are read every day. Appendices come last because they are read once a quarter.",
  ),
  h2("Contents"),
  ...monoBlock([
    "  Part I     Operating policies .................................. page   3",
    "  Part II    Customer escalation rules ........................... page  46",
    "  Part III   Project workstreams ................................. page  80",
    "  Part IV    Incident reports .................................... page 180",
    "  Part V     Architecture decision records ....................... page 231",
    "  Part VI    Field runbooks ...................................... page 160",
    "  Part VII   Change log .......................................... page 120",
    "  Part VIII  Appendices .......................................... page 290",
  ]),
  ...blank(),
  h2("Precedence"),
  ...para(
    "When two pages disagree, the later dated decision wins. A policy is not corrected in place; it is left " +
      "standing and a dated decision record is written that supersedes it. Readers therefore need both pages to " +
      "know what is true, which is deliberate: the history of a rule is part of the rule.",
  ),
  h2("What is not here"),
  ...bullet("Draft material that was never ratified. Withdrawn drafts are listed in the appendices, marked as such."),
  ...bullet("Training scenarios. These are simulations and are labelled as simulations wherever they appear."),
  ...bullet("Customer contracts. The escalation rules summarise obligations but are not the contract."),
]);

anchor(3, POLICY_HEAD, [
  h1("Charter and prime directives"),
  ...blank(),
  line(`Charter: ${CHARTER}    Ratified: ${CHARTER_DATE}    Revision: 7`, "small"),
  ...blank(),
  ...para(
    `This handbook is governed by ${CHARTER}, ratified on ${CHARTER_DATE} by the Helios Robotics operations ` +
      "board. The charter grants the fleet operations function the authority to halt work, and it names exactly " +
      "one role that may exercise that authority.",
  ),
  h2("Prime directive one: one person can stop the fleet"),
  ...para(
    `Across every depot and every shift, the sole authority to declare a fleet wide stop work rests with the ` +
      `${STOP_WORK_AUTHORITY}. No committee, no vote, and no escalation path is required. A depot manager may ` +
      "halt a single depot at any time, but a fleet wide halt is one role and one decision.",
  ),
  ...para(
    "The reason is speed. Every minute spent assembling a quorum during a safety event is a minute rovers keep " +
      "moving. The cost of a wrong halt is a lost afternoon. The cost of a slow halt has no ceiling.",
  ),
  h2("Prime directive two: evidence before action"),
  ...para(
    "No operator action is taken against a customer account, a rover, or a depot without a recorded observation " +
      "that justifies it. The observation is attached to the action in the audit ledger before the action runs.",
  ),
  h2("Prime directive three: the later dated decision wins"),
  ...para(
    "Policies in this handbook are superseded by dated decision records rather than edited. Any reader who finds " +
      "two rules in conflict follows the one with the later date and reports the conflict to the handbook owner.",
  ),
]);

anchor(7, POLICY_HEAD, [
  h1("OPS-POL-14 Rover SDK field firmware flashing"),
  ...blank(),
  line(`Owner: Field Operations    Effective: ${OPS_POL_14_DATE}    Status at issue: binding`, "small"),
  ...blank(),
  h2("Rule"),
  ...para(
    "At a depot, a single Tier 2 engineer may flash Rover SDK field firmware without a second approver, " +
      "provided the rover is on a maintenance stand with the drive system isolated and the depot console shows " +
      "the rover out of service.",
  ),
  h2("Why the rule was written this way"),
  ...para(
    "Depots run thin on the night shift. Requiring a second approver for a routine flash meant either waking a " +
      "second engineer or leaving the rover out of service until morning. The maintenance stand was treated as " +
      "sufficient physical protection, on the argument that an isolated rover cannot move whatever the firmware " +
      "does.",
  ),
  h2("Bounds"),
  ...bullet("Applies only to Rover SDK field firmware, not to charge dock or depot gateway firmware."),
  ...bullet("Applies only while the rover is on a maintenance stand with the drive system isolated."),
  ...bullet("The engineer records the firmware version and the stand identifier in the audit ledger."),
  ...blank(),
  h2("Reader note"),
  ...para(
    "This page states the rule as issued. Check the architecture decision records before relying on it: the " +
      "handbook does not edit policies in place, and a later dated decision may have replaced this one.",
  ),
]);

anchor(46, ESCALATION_HEAD, [
  h1("Escalation severity matrix"),
  ...blank(),
  ...para(
    "Severity is set by customer impact, not by how hard the problem is to fix. A one line configuration error " +
      "that stops deliveries is a SEV-1. A week of difficult debugging that no customer can perceive is a SEV-4.",
  ),
  ...table(
    ["Severity", "Ack target", "Approver", "Paging ring"],
    [
      ["SEV-1", "5 minutes", STOP_WORK_AUTHORITY, "Ring 0 and Ring 1"],
      ["SEV-2", "15 minutes", "Depot Manager", "Ring 1"],
      ["SEV-3", "2 hours", "Duty Engineer", "Ring 2"],
      ["SEV-4", "1 business day", "Team Lead", "none, ticket only"],
    ],
    [10, 16, 24, 20],
  ),
  ...blank(),
  h2("Using the matrix"),
  ...bullet("The acknowledgement target is measured from the first customer report, not from triage."),
  ...bullet("The approver in this table approves customer facing communication, not the technical fix."),
  ...bullet("A severity may be raised by anyone at any time. Lowering a severity needs the approver named above."),
  ...blank(),
  h2("Common mistakes"),
  ...para(
    "The most frequent error is treating a partial regional outage as a SEV-2 because only one region is " +
      "affected. Severity follows the impact experienced by the customers who are affected, not the fraction of " +
      "the fleet involved.",
  ),
]);

anchor(80, PROJECT_HEAD, [
  h1("Project alias registry"),
  ...blank(),
  ...para(
    "Projects are known internally by an alias and formally by a programme code. Both appear in tickets, so the " +
      "registry below is the mapping of record. An alias is never reused for a second programme.",
  ),
  ...table(
    ["Alias", "Code", "Scope", "Milestone"],
    [
      ["Atlas Launch", "HR-P1", "Depot fleet general availability", ATLAS_GA],
      ["AuthShield", "HR-P2", "Operator identity and tokens", AUTHSHIELD_DUE],
      ["Billing Migration", "HR-P3", "Ledger cutover to usage billing", BILLING_CUTOVER],
      ["Rover SDK", "HR-P4", "Field autonomy toolkit", ROVER_FREEZE],
    ],
    [18, 6, 32, 18],
  ),
  ...blank(),
  h2("Reading the registry"),
  ...bullet("The milestone column is the committed date at the time of this revision, not the original estimate."),
  ...bullet("Programme codes are stable. Aliases occasionally change spelling in older tickets."),
  ...bullet("Work that belongs to no programme is filed against the owning team instead of a code."),
  ...blank(),
  h2("Retired aliases"),
  ...para(
    "Two aliases from earlier revisions are retired and must not be used in new tickets: Atlas Lander, which " +
      "was an early name for a hardware programme that was cancelled, and Rover CLI, which described a tool that " +
      "was folded into the Rover SDK. Neither appears in the registry above.",
  ),
]);

anchor(81, PROJECT_HEAD, [
  h1("Atlas Launch programme dossier"),
  ...blank(),
  line("Programme: HR-P1    Sponsor: Fleet Platform    Status: delivered", "small"),
  ...blank(),
  h2("Objective"),
  ...para(
    "Atlas Launch took the depot fleet from a supervised pilot at two sites to general availability across all " +
      "contracted depots, with unattended overnight operation as the acceptance bar.",
  ),
  h2("Delivery"),
  ...para(
    `Atlas Launch reached general availability on ${ATLAS_GA}, four weeks later than the original plan. The ` +
      "delay came from the charge dock controller, which needed a firmware revision before unattended overnight " +
      "operation was safe. Software readiness was never the blocking path.",
  ),
  h2("What went well"),
  ...bullet("The staged rollout meant no depot received an untested image."),
  ...bullet("Operators were trained on the new console before the fleet moved, not during."),
  ...blank(),
  h2("What did not"),
  ...bullet("The hardware dependency was tracked in a separate plan and surfaced late."),
  ...bullet("Telemetry schema churn during the rollout forced two dashboard rewrites."),
  ...blank(),
  h2("Successor work"),
  ...para(
    "Remaining Atlas Launch scope moved into routine operations. The telemetry schema work continued " +
      "separately and is recorded in the change log.",
  ),
]);

anchor(82, PROJECT_HEAD, [
  h1("AuthShield programme dossier"),
  ...blank(),
  line("Programme: HR-P2    Sponsor: Security Engineering    Status: in flight", "small"),
  ...blank(),
  h2("Objective"),
  ...para(
    "AuthShield replaces long lived operator credentials with short lived tokens issued by the credential " +
      "broker, so that a stolen laptop stops being a standing grant of fleet access.",
  ),
  h2("Open work"),
  ...para(
    `ENG-456 reduces the AuthShield operator token lifetime to fifteen minutes, down from the eight hours a ` +
      `token inherits from the old session model. The committed completion date is ${AUTHSHIELD_DUE}. The work ` +
      "is held behind a refresh path for depots with intermittent links, because a fifteen minute token is " +
      "useless if a depot cannot reach the broker to refresh it.",
  ),
  h2("Dependencies"),
  ...bullet("Credential broker availability at depot sites with satellite links."),
  ...bullet("Console changes so an operator sees a refresh failure before the token expires."),
  ...bullet("An offline grace path, bounded and audited, for depots that lose connectivity mid shift."),
  ...blank(),
  h2("Engineering owner"),
  ...para(
    "The engineering owner for AuthShield is Priya Raman. Escalations about AuthShield customer impact go to " +
      "the escalation desk, not to the engineering owner directly.",
  ),
]);

anchor(83, PROJECT_HEAD, [
  h1("AuthShield commitment record"),
  ...blank(),
  ...para(
    "The security team records commitments in the language they were made in, so that the wording a team " +
      "actually agreed to is preserved rather than a translation of it.",
  ),
  h2("Commitment recorded in Hindi"),
  ...para(
    "The Devanagari original of this commitment is carried in the PDF text annotation attached to this page and " +
      "in the document Keywords entry, both encoded UTF-16BE with a byte order mark. The Latin transliteration " +
      "below is what appears in the page text, because the standard Type1 font used throughout this handbook " +
      "has no Devanagari glyphs.",
  ),
  h3("Hindi, transliterated to Latin script"),
  ...para(HINDI_TRANSLITERATION),
  h3("English translation"),
  ...para(
    "The Helios Robotics security team commits that under ENG-456 the AuthShield operator token lifetime will " +
      `be reduced to fifteen minutes by ${AUTHSHIELD_DUE}.`,
  ),
  h2("Status"),
  ...bullet("The commitment is tracked against the engineering issue, not against this page."),
  ...bullet("If the date moves, the commitment is restated and dated rather than amended in place."),
]);

anchor(84, PROJECT_HEAD, [
  h1("Billing Migration programme dossier"),
  ...blank(),
  line("Programme: HR-P3    Sponsor: Billing Systems    Status: in flight", "small"),
  ...blank(),
  h2("Objective"),
  ...para(
    "Billing Migration moves customers from a flat monthly plan to usage billing computed from completed " +
      "deliveries, with the audit ledger as the source of truth for what was delivered.",
  ),
  h2("Cutover"),
  ...para(
    `The Billing Migration ledger cutover is scheduled for ${BILLING_CUTOVER}. Both ledgers run in parallel for ` +
      "the preceding month, and a customer is only moved once two consecutive parallel runs agree to the cent.",
  ),
  h2("Risks carried"),
  ...bullet("Retry paths can produce duplicate charges when an idempotency key is regenerated rather than reused."),
  ...bullet("Parallel running doubles ledger write volume for a month and needs a capacity reservation."),
  ...bullet("Customers on legacy contracts need a manual review before they can move."),
  ...blank(),
  h2("Escalation desk"),
  ...para(
    "Billing Migration escalations are handled by a dedicated desk rather than the general customer queue, " +
      "because a billing complaint needs ledger access that the general queue does not have.",
  ),
]);

anchor(85, PROJECT_HEAD, [
  h1("Rover SDK programme dossier"),
  ...blank(),
  line("Programme: HR-P4    Sponsor: Hardware Integration    Status: in flight", "small"),
  ...blank(),
  h2("Objective"),
  ...para(
    "The Rover SDK is the field autonomy toolkit that runs on the rover itself: navigation, telemetry, safety " +
      "interlocks, and the firmware update path. Depot software talks to it, and never around it.",
  ),
  h2("Release plan"),
  ...para(
    `Rover SDK 5.0 enters code freeze on ${ROVER_FREEZE}, with a six week soak at three depots before any wider ` +
      "rollout. Version 4.2.1 remains the supported release for the whole fleet until the soak completes.",
  ),
  h2("Compatibility"),
  ...bullet("Depot software supports the current and previous minor release, and nothing older."),
  ...bullet("Firmware rollback is supported within a minor release only."),
  ...bullet("Calibration profiles survive an upgrade but not a cross minor rollback."),
  ...blank(),
  h2("Naming"),
  ...para(
    "The Rover SDK is not the Rover CLI. The Rover CLI was a depot side tool, retired two revisions ago, whose " +
      "commands were folded into the depot console. Tickets that mention the Rover CLI predate that change.",
  ),
]);

anchor(120, CHANGELOG_HEAD, [
  h1("Defect record BUG-123"),
  ...blank(),
  line("Severity: high    Opened: 2 May 2031    Closed: 21 May 2031    Owner: Daniel Okafor", "small"),
  ...blank(),
  h2("Symptom"),
  ...para(
    "BUG-123 records odometry drift after cold boot on Rover SDK 4.2.0. A rover powered on from cold in an " +
      "unheated depot accumulated a position error of up to eleven centimetres over the first hour of operation, " +
      "which was enough to make precision docking fail on narrow bays.",
  ),
  h2("Cause"),
  ...para(
    "The wheel encoder calibration constant was read once at boot, before the sensor board reached its " +
      "operating temperature. At low temperature the constant read several counts low, and the error persisted " +
      "for the whole session because the value was never re read.",
  ),
  h2("Fix"),
  ...para(
    "Calibration is now sampled three times during the first ten minutes after boot and the drive controller " +
      "uses the last sample. The fix shipped in Rover SDK 4.2.1, released on 21 May 2031, and the defect was " +
      "closed the same day after two depots confirmed docking success rates returned to normal.",
  ),
  h2("Detection gap"),
  ...bullet("No alert existed for docking retries. One was added with the fix."),
  ...bullet("Cold boot was not covered by the depot soak test, which always started from a warm rover."),
]);

anchor(121, CHANGELOG_HEAD, [
  h1("Change record PR-8871"),
  ...blank(),
  line("Area: telemetry ingest    Programme: HR-P1    Review: two approvers", "small"),
  ...blank(),
  h2("What changed"),
  ...para(
    "PR-8871 merged the Atlas Launch telemetry schema version 3 on 2 July 2031. Version 3 flattens the nested " +
      "per subsystem envelope into a single record with an explicit subsystem field, which cut ingest cost by " +
      "roughly a third and removed the ambiguity that produced two different dashboard rewrites during rollout.",
  ),
  h2("Migration"),
  ...bullet("Version 2 and version 3 records were accepted in parallel for six weeks."),
  ...bullet("Dashboards were cut over one at a time, with the old panel kept alongside until the numbers matched."),
  ...bullet("Version 2 acceptance was removed only after no depot had emitted it for fourteen consecutive days."),
  ...blank(),
  h2("Review notes"),
  ...para(
    "The change was held for one week while the retention policy was confirmed, because flattening the envelope " +
      "changed which fields count as personal data under the depot agreements. The review concluded no field " +
      "changed category, and the hold was recorded rather than dropped.",
  ),
]);

anchor(160, RUNBOOK_HEAD, [
  h1("Rover SDK communications blackout protocol"),
  ...blank(),
  line("Applies to: Rover SDK 4.2 and later    Owner: Hardware Integration", "small"),
  ...blank(),
  h2("What a blackout is"),
  ...para(
    "A communications blackout is any period longer than four minutes in which a rover cannot reach the depot " +
      "gateway. Blackouts are routine at sites with satellite links and inside the metal structures at two " +
      "depots. They are not incidents on their own.",
  ),
  h2("Rover behaviour during a blackout"),
  ...para(
    `Rover SDK units fall back to a beacon cadence of ${BEACON_CADENCE}, up from the two second cadence used ` +
      "when the link is healthy. The slower beacon exists so a rover that is out of contact for an hour does not " +
      "flatten its radio budget trying to reach a gateway that is not there.",
  ),
  ...para(
    `While the link is down the unit retains the last ${RING_BUFFER_FRAMES} telemetry frames in the onboard ` +
      "ring buffer and replays them in order once contact returns. Frames beyond that are overwritten oldest " +
      "first and are not recoverable.",
  ),
  h2("Operator actions"),
  ...bullet("Do not dispatch new work to a rover that has been dark for more than fifteen minutes."),
  ...bullet("Do not power cycle a rover to restore a link. The buffered telemetry is lost with the power."),
  ...bullet("Record the blackout window on the shift log so the replayed frames can be reconciled later."),
]);

anchor(180, INCIDENT_HEAD, [
  h1("Incident report INC-2031"),
  ...blank(),
  line("Severity: SEV-2    Date: 8 April 2031    Impact: 41 minutes    Commander: Ruth Vanterpool", "small"),
  ...blank(),
  h2("Summary"),
  ...para(
    "INC-2031 was a Billing Migration double charge event on 8 April 2031. During a parallel ledger run, 1,184 " +
      "completed deliveries were written to the new ledger twice, and 212 customers saw a duplicate line on a " +
      "live invoice before the run was stopped.",
  ),
  h2("Root cause"),
  ...para(
    "The parallel run regenerated the idempotency key on retry instead of reusing the key from the first " +
      "attempt. A transient timeout in the ledger write path therefore produced two records that the ledger " +
      "considered distinct. Customer impact lasted 41 minutes, from the first duplicate write to the point the " +
      "run was halted and invoices were frozen.",
  ),
  h2("Resolution"),
  ...bullet("The parallel run was halted and the duplicate records were reversed within the same billing day."),
  ...bullet("Affected customers were contacted before the invoice reached them, with the correction attached."),
  ...bullet("Idempotency keys are now derived from the delivery identifier and never regenerated on retry."),
  ...blank(),
  h2("Lessons"),
  ...para(
    "The retry path had been reviewed and the key generation had not, because key generation looked like a " +
      "detail of the client library rather than part of the billing contract.",
  ),
]);

anchor(181, INCIDENT_HEAD, [
  h1("Incident log summary"),
  ...blank(),
  ...para(
    "The summary covers incidents with customer visible impact. Internal degradations that no customer could " +
      "perceive are recorded in the change log instead.",
  ),
  ...table(
    ["Incident", "Date", "Sev", "Impact", "Status"],
    [
      ["INC-2028", "17 February 2031", "SEV-3", "12 min", "closed"],
      ["INC-2029", "2 March 2031", "SEV-3", "26 min", "closed"],
      ["INC-2030", "29 March 2031", "SEV-4", "8 min", "closed"],
      ["INC-2031", "8 April 2031", "SEV-2", "41 min", "closed"],
      ["INC-2032", "3 June 2031", "SEV-3", "19 min", "closed"],
    ],
    [10, 17, 6, 8, 10],
  ),
  ...blank(),
  h2("Reading the summary"),
  ...bullet("Impact is the customer visible window, not the time the incident channel stayed open."),
  ...bullet("Status is closed only after the follow up actions have shipped, not when the symptom stopped."),
  ...blank(),
  h2("Trend"),
  ...para(
    "Four of the five incidents in this window began with a change that was reviewed for correctness but not " +
      "for what it did under retry. That pattern is the reason the deployment check now asserts timeout and " +
      "retry behaviour explicitly.",
  ),
]);

anchor(203, RUNBOOK_HEAD, [
  h1("Named roles and directory"),
  ...blank(),
  ...para(
    "Two people in this directory have similar names and are frequently confused in tickets. They are different " +
      "people, in different functions, with different employee identifiers. Check the identifier before routing " +
      "anything.",
  ),
  h2("Engineering"),
  ...para(
    "Priya Raman, Staff Reliability Engineer, employee HR-2214, based in Bengaluru. She is the engineering " +
      "owner of AuthShield and sits in the Ring 1 on call rotation. Route technical questions about token " +
      "lifetime, the credential broker, and operator identity to her.",
  ),
  h2("Customer operations"),
  ...para(
    "Priya Ramanathan, Customer Escalation Manager, employee HR-5871, based in Toronto. She runs the Billing " +
      "Migration escalation desk. Route customer facing billing complaints, credit decisions, and invoice " +
      "corrections to her desk, not to engineering.",
  ),
  h2("Disambiguation rule"),
  ...bullet("A ticket that names only Priya is routed by subject: identity to HR-2214, billing to HR-5871."),
  ...bullet("Neither person approves work on behalf of the other, and neither covers the other on call."),
  ...bullet("Older tickets sometimes abbreviate both to P. Raman. Those must be checked by hand."),
]);

anchor(204, RUNBOOK_HEAD, [
  h1("On call rotation and contact rings"),
  ...blank(),
  ...para(
    "Ring 0 is paged first and is expected to answer within five minutes. Ring 1 is paged if Ring 0 does not " +
      "acknowledge, or immediately for a SEV-1. Ring 2 is a daytime queue and is never paged overnight.",
  ),
  ...table(
    ["Ring", "Depot", "Primary", "Programme"],
    [
      ["Ring 0", "Bengaluru", "Priya Raman", "AuthShield"],
      ["Ring 0", "Toronto", "Daniel Okafor", "Billing Migration"],
      ["Ring 1", "Rotterdam", "Marta Kilburn", "Atlas Launch"],
      ["Ring 1", "Osaka", "Kenji Sato", "Rover SDK"],
      ["Ring 2", "Manchester", "Owen Fitzgerald", "shared"],
    ],
    [8, 14, 20, 20],
  ),
  ...blank(),
  h2("Handover"),
  ...bullet("Handover is written, in the shift log, and names the open questions rather than summarising them."),
  ...bullet("An engineer leaving the rotation stays reachable for one shift after their last on call day."),
  ...blank(),
  h2("Escalation beyond the rings"),
  ...para(
    "If no ring answers within fifteen minutes, the depot manager pages the operations board directly. This has " +
      "happened twice, both times during a regional network failure that also took out the paging path.",
  ),
]);

anchor(231, ADR_HEAD, [
  h1("ADR-037 Two approvers for Rover SDK firmware flashing"),
  ...blank(),
  line(`Status: Accepted    Decided: ${ADR_037_DATE}    Author: Kenji Sato    Supersedes: OPS-POL-14`, "small"),
  ...blank(),
  h2("Decision"),
  ...para(
    `ADR-037, dated ${ADR_037_DATE}, supersedes OPS-POL-14. From this date every Rover SDK field firmware flash ` +
      "requires two approvers, and one of them must be a Safety Case Owner. The single engineer permission in " +
      "OPS-POL-14 is withdrawn and must not be relied on, whatever the depot staffing situation.",
  ),
  h2("Context"),
  ...para(
    "OPS-POL-14 assumed the maintenance stand was sufficient protection, on the argument that an isolated rover " +
      "cannot move. Two near misses showed the argument was too narrow. A flash that fails part way can leave " +
      "the safety interlock in an undefined state, and the rover leaves the stand later with nobody aware.",
  ),
  h2("Consequences"),
  ...bullet("Night shift flashes now wait for a second approver, and some rovers stay out of service until morning."),
  ...bullet("The Safety Case Owner rotation was extended to cover nights, which added on call load."),
  ...bullet("Firmware flashing is now recorded with two names in the audit ledger, not one."),
  ...blank(),
  h2("Rejected alternative"),
  ...para(
    "Automating the second approval with a checklist the same engineer completes was rejected. A checklist " +
      "signed by the person doing the work is not a second pair of eyes, it is paperwork.",
  ),
]);

anchor(290, APPENDIX_HEAD, [
  h1("Appendix C: withdrawn drafts"),
  ...blank(),
  ...para(
    "Drafts in this appendix were written, circulated, and never ratified. They are kept because they are " +
      "frequently quoted in old tickets by people who believe they are policy. Nothing on this page is binding.",
  ),
  h2("DRAFT-OPS-14"),
  ...para(
    "DRAFT-OPS-14 was never ratified and carries no operational authority. It proposed that any engineer, at " +
      "any tier, could flash rover firmware provided a photograph of the maintenance stand was attached to the " +
      "ticket. It is routinely confused with OPS-POL-14, which was a real policy and which was itself " +
      "superseded by ADR-037. Neither the draft nor the superseded policy permits single engineer flashing today.",
  ),
  h2("DRAFT-ESC-9"),
  ...para(
    "A proposal to let the escalation desk issue credits up to a fixed limit without ledger access. Withdrawn " +
      "after the Billing Migration parallel run showed that a credit issued without ledger access cannot be " +
      "reconciled.",
  ),
  h2("DRAFT-RB-2"),
  ...para(
    "A runbook draft for restarting the dispatch queue that omitted the diagnostics capture step. Withdrawn " +
      "rather than corrected, because the corrected version already exists in the field runbooks.",
  ),
]);

anchor(291, APPENDIX_HEAD, [
  h1("Appendix D: terminology that looks similar"),
  ...blank(),
  ...para(
    "These pairs are the most common source of mistaken retrieval in this handbook. Each pair contains one term " +
      "in current use and one that is retired, unofficial, or refers to something else entirely.",
  ),
  ...table(
    ["Term", "Status", "Not to be confused with"],
    [
      ["Atlas Launch", "current programme", "Atlas Lander, cancelled hardware"],
      ["Rover SDK", "current toolkit", "Rover CLI, retired depot tool"],
      ["AuthShield", "current programme", "AuthShell, an internal test rig"],
      ["Depot gateway", "current component", "Depot console, the operator UI"],
      ["Audit ledger", "system of record", "Billing ledger, a downstream copy"],
    ],
    [16, 18, 38],
  ),
  ...blank(),
  h2("Why these persist"),
  ...para(
    "Retired names live on in ticket titles, which are never rewritten. A search that matches a ticket title " +
      "will surface the retired name long after the thing itself is gone. When a retired term appears in a " +
      "result, the safe assumption is that the ticket predates the rename.",
  ),
]);

anchor(292, APPENDIX_HEAD, [
  h1("Appendix E: training drills"),
  ...blank(),
  ...para(
    "Everything in this appendix is a simulation. No drill involved a real rover, a real customer, or a real " +
      "charge. Drill records are numbered in their own series so they can never be mistaken for incidents.",
  ),
  ...table(
    ["Drill", "Date", "Scenario", "Outcome"],
    [
      ["DRILL-2031-04", "11 April 2031", "Depot gateway total loss", "passed"],
      ["DRILL-2031-05", "9 May 2031", "Duplicate billing simulation", "passed"],
      ["DRILL-2031-06", "13 June 2031", "Fleet wide stop work rehearsal", "passed"],
      ["DRILL-2031-07", "10 July 2031", "Credential broker outage", "retry required"],
    ],
    [16, 16, 32, 14],
  ),
  ...blank(),
  h2("Reading drill records"),
  ...bullet("A drill outcome of passed means the procedure was followed, not that the systems behaved well."),
  ...bullet("Drills use simulated customer accounts. No invoice is ever generated during a drill."),
  ...bullet("Drill numbers are never reused, and never share a series with incident numbers."),
  ...blank(),
  h2("The July retry"),
  ...para(
    "The credential broker drill needed a second attempt because the simulated outage also disabled the paging " +
      "path used to run the drill. The retry passed. The finding was that the drill tooling shared a dependency " +
      "with the thing being tested, which has since been separated.",
  ),
]);

anchor(340, APPENDIX_HEAD, [
  h1("Appendix J: fleet renewal budget envelope"),
  ...blank(),
  line("Approved by: operations board    Applies to: financial year 2032", "small"),
  ...blank(),
  h2("Envelope"),
  ...para(
    "The approved fleet renewal envelope reserves 18 percent of 2032 capital expenditure for battery " +
      "replacement, which is the single largest line in the renewal plan and the only line that cannot be " +
      "deferred without taking rovers out of service.",
  ),
  h2("Why batteries dominate"),
  ...para(
    "Cells in the current fleet reach the end of their warranted cycle count during 2032, and a depot with " +
      "degraded cells loses range before it loses uptime, so the symptom appears as missed deliveries rather " +
      "than as a hardware alert. Replacing on a schedule is cheaper than replacing on failure.",
  ),
  h2("Remaining envelope"),
  ...bullet("Charge dock refresh, staged by depot age."),
  ...bullet("Sensor board replacement for the two oldest depot cohorts."),
  ...bullet("A contingency reserve that is released only by the operations board."),
  ...blank(),
  h2("Review"),
  ...para(
    "The envelope is reviewed at the half year. A line may be moved within the envelope by the operations " +
      "board, but the total is fixed for the year and any increase reopens the whole plan.",
  ),
]);

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

const SECTIONS = [
  { from: 3, to: 45, kind: "policy" },
  { from: 46, to: 79, kind: "escalation" },
  { from: 80, to: 119, kind: "project" },
  { from: 120, to: 159, kind: "changelog" },
  { from: 160, to: 179, kind: "runbook" },
  { from: 180, to: 202, kind: "incident" },
  { from: 203, to: 230, kind: "runbook" },
  { from: 231, to: 289, kind: "adr" },
  { from: 290, to: TOTAL_PAGES, kind: "appendix" },
];

function fillerKindFor(pageNumber) {
  const section = SECTIONS.find((entry) => pageNumber >= entry.from && pageNumber <= entry.to);
  if (!section) throw new Error(`page ${pageNumber} falls outside every declared section`);
  return section.kind;
}

/** Compose the whole handbook: anchor pages where declared, generated filler everywhere else. */
export function buildPages() {
  const pages = [];
  for (let pageNumber = 1; pageNumber <= TOTAL_PAGES; pageNumber += 1) {
    const anchored = ANCHORS.get(pageNumber);
    pages.push(anchored ?? fillerPage(fillerKindFor(pageNumber), pageNumber));
  }
  return pages;
}

export const ANCHOR_PAGE_NUMBERS = [...ANCHORS.keys()].sort((a, b) => a - b);
export { POLICY_HEAD, ADR_HEAD };
