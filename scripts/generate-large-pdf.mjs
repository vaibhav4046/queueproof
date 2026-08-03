#!/usr/bin/env node
/**
 * Generate the large-document retrieval fixture: a real, several-hundred-page PDF of the
 * (fictional) Helios Robotics Operations Handbook, plus the machine-readable ground truth that an
 * evaluation run asserts against.
 *
 * The previous version of this file printed a message and exited, so `generate:large-pdf` produced
 * nothing and any eval that depended on it was measuring an empty corpus. Everything below writes
 * real bytes and then re-reads them: the page count reported is parsed back out of the finished
 * file's page tree, the cross-reference offsets are followed the way a parser would follow them,
 * and every planted fact is checked to appear on the page the fixture claims and on no other page.
 * If any of that fails the script exits non-zero and does not claim success.
 *
 * No npm dependencies. The PDF bytes are written by hand; see scripts/lib/pdf-writer.mjs.
 *
 * Usage:
 *   node scripts/generate-large-pdf.mjs [output.pdf]      # default work/helios-operations-handbook.pdf
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { inspectPdf, renderDocument } from "./lib/pdf-writer.mjs";
import {
  ANNOTATIONS,
  DOCUMENT_INFO,
  IDENTIFIER_PAGES,
  PLANTED_FACTS,
  TOTAL_PAGES,
  buildPages,
} from "./lib/handbook-content.mjs";

const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));
const DEFAULT_OUTPUT = path.join(REPO_ROOT, "work", "helios-operations-handbook.pdf");
const FACTS_OUTPUT = path.join(REPO_ROOT, "evals", "fixtures", "large-pdf-facts.json");
const MINIMUM_BYTES = 200 * 1024;
const MINIMUM_FACTS = 12;

const failures = [];
const checks = [];

function check(name, ok, detail = "") {
  checks.push({ name, ok, detail });
  if (!ok) failures.push(`${name}: ${detail}`);
  return ok;
}

/** Flatten a page to searchable text the way an extractor would, with whitespace normalised. */
function pageText(page) {
  return page.lines
    .map((item) => item.text ?? "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function verifyPlantedFacts(pages, texts) {
  const normalise = (value) => value.replace(/\s+/g, " ").trim();

  check("At least twelve ground-truth facts", PLANTED_FACTS.length >= MINIMUM_FACTS, `${PLANTED_FACTS.length} facts`);

  const seen = new Set();
  const duplicates = PLANTED_FACTS.filter((fact) => {
    if (seen.has(fact.id)) return true;
    seen.add(fact.id);
    return false;
  });
  check("Fact ids are unique", duplicates.length === 0, duplicates.map((fact) => fact.id).join(", ") || "no duplicates");

  const requiredKinds = [
    "exact_identifier",
    "superseded_policy_original",
    "superseding_decision",
    "entity_disambiguation",
    "hindi_commitment",
    "beginning_load_bearing",
    "middle_load_bearing",
    "end_load_bearing",
    "table_lookup",
    "deadline",
    "project_alias",
    "distractor_discrimination",
  ];
  const presentKinds = new Set(PLANTED_FACTS.map((fact) => fact.kind));
  const missingKinds = requiredKinds.filter((kind) => !presentKinds.has(kind));
  check(
    "All required fact kinds present",
    missingKinds.length === 0,
    missingKinds.join(", ") || `${presentKinds.size} kinds`,
  );

  for (const fact of PLANTED_FACTS) {
    const inRange = Number.isInteger(fact.page) && fact.page >= 1 && fact.page <= pages.length;
    if (!check(`Fact ${fact.id} page in range`, inRange, `page ${fact.page} of ${pages.length}`)) continue;

    const evidence = normalise(fact.evidence);
    const hits = [];
    texts.forEach((text, index) => {
      if (text.includes(evidence)) hits.push(index + 1);
    });
    check(
      `Fact ${fact.id} grounded once, on page ${fact.page}`,
      hits.length === 1 && hits[0] === fact.page,
      hits.length === 0 ? "evidence text not found on any page" : `evidence found on pages ${hits.join(", ")}`,
    );

    if (fact.exactIdentifier) {
      const onOwnPage = texts[fact.page - 1].includes(fact.exactIdentifier);
      check(
        `Fact ${fact.id} carries ${fact.exactIdentifier} on page ${fact.page}`,
        onOwnPage,
        onOwnPage ? "verbatim on its own page" : "identifier missing from its own page",
      );
    }
  }

  // A planted identifier that leaked into filler would make a verbatim lookup ambiguous.
  for (const [identifier, expectedPages] of Object.entries(IDENTIFIER_PAGES)) {
    const actual = [];
    texts.forEach((text, index) => {
      if (text.includes(identifier)) actual.push(index + 1);
    });
    check(
      `Identifier ${identifier} appears only where declared`,
      actual.join(",") === expectedPages.join(","),
      `expected [${expectedPages.join(", ")}], found [${actual.join(", ")}]`,
    );
  }
}

function main() {
  const requested = process.argv[2];
  const outputPath = requested ? path.resolve(process.cwd(), requested) : DEFAULT_OUTPUT;

  const pages = buildPages();
  const texts = pages.map(pageText);
  check("Composed the planned page count", pages.length === TOTAL_PAGES, `${pages.length} pages`);
  check("Page count inside the 250 to 350 window", pages.length >= 250 && pages.length <= 350, `${pages.length} pages`);

  verifyPlantedFacts(pages, texts);

  // The trailer /ID is derived from the text corpus, so it is stable across runs and changes only
  // when the document does. Generation is otherwise fully deterministic.
  const fileId = createHash("sha256").update(texts.join("\n")).digest("hex").slice(0, 32).toUpperCase();

  // A page that overflows its text frame throws here rather than dropping a planted fact.
  const { bytes, pageCount, objectCount } = renderDocument({
    pages,
    info: { ...DOCUMENT_INFO, fileId },
    annotations: ANNOTATIONS,
  });

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, bytes);

  const fixture = PLANTED_FACTS.map(({ id, page, kind, question, expectedAnswer, requiredFacts, exactIdentifier }) => ({
    id,
    page,
    kind,
    question,
    expectedAnswer,
    requiredFacts,
    exactIdentifier,
  }));
  mkdirSync(path.dirname(FACTS_OUTPUT), { recursive: true });
  writeFileSync(FACTS_OUTPUT, `${JSON.stringify(fixture, null, 2)}\n`);

  // Re-read from disk. Everything reported below comes from the file, not from memory.
  const onDisk = readFileSync(outputPath);
  const report = inspectPdf(onDisk);
  const digest = createHash("sha256").update(onDisk).digest("hex");

  check(
    "File starts with %PDF-",
    onDisk.subarray(0, 5).toString("latin1") === "%PDF-",
    onDisk.subarray(0, 8).toString("latin1"),
  );
  check(
    "File ends with %%EOF",
    onDisk.subarray(-8).toString("latin1").trimEnd().endsWith("%%EOF"),
    JSON.stringify(onDisk.subarray(-8).toString("latin1")),
  );
  check(
    "Cross-reference table resolves",
    report.ok,
    report.problems.join("; ") || `${report.verifiedOffsets} offsets verified`,
  );
  check(
    "/Count matches the pages written",
    report.declaredPageCount === pageCount,
    `/Count ${report.declaredPageCount} vs ${pageCount} rendered`,
  );
  check("Byte size above 200 KB", onDisk.length > MINIMUM_BYTES, `${onDisk.length} bytes`);

  const width = Math.max(...checks.map((entry) => entry.name.length));
  for (const { name, ok, detail } of checks) console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(width)}  ${detail}`);
  console.log("");

  if (failures.length > 0) {
    console.error(`${failures.length} of ${checks.length} checks failed. First blocker: ${failures[0]}`);
    console.error("Output was written but must not be trusted as a fixture.");
    return 1;
  }

  console.log(`Wrote        ${outputPath}`);
  console.log(`Pages        ${report.declaredPageCount} (read back from /Count in the written file)`);
  console.log(`Bytes        ${onDisk.length} (${(onDisk.length / 1024).toFixed(1)} KB)`);
  console.log(`SHA-256      ${digest}`);
  console.log(`Objects      ${objectCount} indirect objects, ${report.verifiedOffsets} xref offsets verified`);
  console.log(`Ground truth ${fixture.length} facts -> ${FACTS_OUTPUT}`);
  console.log(`All ${checks.length} checks passed.`);
  return 0;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`Generation failed: ${error instanceof Error ? error.stack : String(error)}`);
  process.exitCode = 1;
}
