import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import facts from "../evals/fixtures/large-pdf-facts.json";
import { PDF_CANARY_KINDS, summarisePdfCanaries } from "../evals/lib/grounded-grader.mjs";

type RequiredFact = { id: string; anyOf?: string[]; allOf?: string[][] };
const factsWithRequirements = facts as unknown as Array<(typeof facts)[number] & { requiredFacts: RequiredFact[] }>;

/**
 * The large-PDF fixture is only useful if it is a real document. These assertions run the
 * generator for real, against a throwaway path, and check the bytes it produced rather than
 * anything the script says about itself. execFileSync throws on a non-zero exit, so a generator
 * that fails its own checks fails this suite too.
 */

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const generator = join(repoRoot, "scripts", "generate-large-pdf.mjs");
const scratchDir = mkdtempSync(join(tmpdir(), "queueproof-large-pdf-"));
const outputPath = join(scratchDir, "helios-operations-handbook.pdf");

const MIN_PAGES = 250;
const MAX_PAGES = 350;
const MIN_BYTES = 200 * 1024;

let bytes!: Buffer;
let generatorOutput!: string;

/** Read the page count back out of the page tree, the way a PDF parser would. */
function declaredPageCount(pdf: Buffer): number {
  const match = /\/Type\s*\/Pages\s*\/Count\s+(\d+)/.exec(pdf.toString("latin1"));
  if (!match) throw new Error("the written PDF has no /Type /Pages ... /Count entry");
  return Number(match[1]);
}

beforeAll(() => {
  generatorOutput = execFileSync(process.execPath, [generator, outputPath], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  bytes = readFileSync(outputPath);
}, 120_000);

afterAll(() => {
  rmSync(scratchDir, { recursive: true, force: true });
});

describe("large PDF fixture generator", () => {
  it("writes a file at the requested output path", () => {
    expect(existsSync(outputPath)).toBe(true);
  });

  it("writes a PDF header and a complete trailer", () => {
    expect(bytes.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(bytes.subarray(-16).toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("contains between 250 and 350 pages", () => {
    const pages = declaredPageCount(bytes);
    expect(pages).toBeGreaterThanOrEqual(MIN_PAGES);
    expect(pages).toBeLessThanOrEqual(MAX_PAGES);
  });

  it("is larger than 200 KB", () => {
    expect(bytes.byteLength).toBeGreaterThan(MIN_BYTES);
  });

  it("reports the page count it actually wrote", () => {
    expect(generatorOutput).toContain(`Pages        ${declaredPageCount(bytes)}`);
  });
});

describe("large PDF ground truth", () => {
  it("plants at least twelve facts", () => {
    expect(facts.length).toBeGreaterThanOrEqual(12);
  });

  it("uses a unique id for every fact", () => {
    expect(new Set(facts.map((fact) => fact.id)).size).toBe(facts.length);
  });

  it("points every fact at a page inside the document", () => {
    const pages = declaredPageCount(bytes);
    for (const fact of facts) {
      expect(Number.isInteger(fact.page), `${fact.id} has a non-integer page`).toBe(true);
      expect(fact.page, `${fact.id} is out of range`).toBeGreaterThanOrEqual(1);
      expect(fact.page, `${fact.id} is out of range`).toBeLessThanOrEqual(pages);
    }
  });

  it("covers the retrieval behaviours the fixture exists to test", () => {
    const kinds = new Set(facts.map((fact) => fact.kind));
    for (const kind of [
      "exact_identifier",
      "superseded_policy_original",
      "superseding_decision",
      "entity_disambiguation",
      "hindi_commitment",
      "beginning_load_bearing",
      "middle_load_bearing",
      "end_load_bearing",
    ]) {
      expect(kinds, `missing fact kind ${kind}`).toContain(kind);
    }
  });

  it("gives every exact-identifier fact something to search for verbatim", () => {
    const identifierFacts = facts.filter((fact) => fact.kind === "exact_identifier");
    expect(identifierFacts.length).toBeGreaterThanOrEqual(4);
    for (const fact of identifierFacts) {
      expect(typeof fact.exactIdentifier, `${fact.id} has no exactIdentifier`).toBe("string");
      expect(bytes.toString("latin1")).toContain(String(fact.exactIdentifier));
    }
  });

  it("gives every PDF case an explicit non-empty required-fact set", () => {
    for (const fact of factsWithRequirements) {
      expect(fact.requiredFacts.length, `${fact.id} has no required facts`).toBeGreaterThan(0);
      expect(new Set(fact.requiredFacts.map((required) => required.id)).size, `${fact.id} repeats a required fact id`)
        .toBe(fact.requiredFacts.length);
      for (const required of fact.requiredFacts) {
        const alternatives = (required.anyOf?.length ?? 0) + (required.allOf?.length ?? 0);
        expect(alternatives, `${fact.id}/${required.id} has no match alternatives`).toBeGreaterThan(0);
      }
    }
  });

  it("uses the fixture's exact beginning, middle, and end canary kinds", () => {
    expect(PDF_CANARY_KINDS).toEqual({
      beginning: "beginning_load_bearing",
      middle: "middle_load_bearing",
      end: "end_load_bearing",
    });
    const canaryKinds = new Set<string>(Object.values(PDF_CANARY_KINDS));
    const canaryRows = facts
      .filter((fact) => canaryKinds.has(fact.kind))
      .map((fact) => ({ ...fact, pass: true }));
    expect(summarisePdfCanaries(canaryRows)).toEqual({ beginning: true, middle: true, end: true });
  });
});
