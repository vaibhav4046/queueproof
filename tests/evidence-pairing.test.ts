import { describe, expect, it } from "vitest";
import { matchingChunk } from "../lib/server/queue";
import { matchingChunks } from "../lib/server/hydradb-shapes";

/**
 * Regression tests for evidence misattribution.
 *
 * The original implementation joined on chunk.source_id / context_id / document_id /
 * parent_id, none of which exist on the HydraDB chunk shape. It therefore never matched
 * and fell back to chunks[index] — pairing a deduplicated source list positionally
 * against a relevance-ranked chunk list, so excerpts were attached to the wrong source.
 */
describe("matchingChunk", () => {
  const chunks = [
    { id: "src-b", chunk_content: "Billing migration slipped to Friday." },
    { id: "src-a", chunk_content: "Auth incident is still open." },
  ];

  it("pairs a source with its own chunk, not the one in the same position", () => {
    // src-a is first in the source list but its chunk is SECOND in the ranked chunk list.
    // Positional pairing would hand back the billing excerpt here.
    expect(matchingChunk({ id: "src-a" }, chunks).chunk_content).toBe("Auth incident is still open.");
    expect(matchingChunk({ id: "src-b" }, chunks).chunk_content).toBe(
      "Billing migration slipped to Friday.",
    );
  });

  it("returns no chunk rather than a wrong one when nothing matches", () => {
    // A missing citation is honest; a confident wrong one is not.
    expect(matchingChunk({ id: "src-unknown" }, chunks)).toEqual({});
  });

  it("returns no chunk when the source carries no usable identifier", () => {
    expect(matchingChunk({ title: "no id here" }, chunks)).toEqual({});
  });

  it("matches on the alternative source identifier fields", () => {
    expect(matchingChunk({ source_id: "src-b" }, chunks).chunk_content).toBe(
      "Billing migration slipped to Friday.",
    );
    expect(matchingChunk({ context_id: "src-a" }, chunks).chunk_content).toBe(
      "Auth incident is still open.",
    );
  });

  it("handles an empty chunk list without inventing evidence", () => {
    expect(matchingChunk({ id: "src-a" }, [])).toEqual({});
  });

  it("preserves every relevance-ranked chunk belonging to one document", () => {
    const documentChunks = [
      { id: "doc-1", chunk_id: "doc-1_chunk_0000", chunk_content: "Table of contents" },
      { id: "doc-1", chunk_id: "doc-1_chunk_0001", chunk_content: "The cited answer" },
      { id: "doc-2", chunk_id: "doc-2_chunk_0000", chunk_content: "Another document" },
    ];
    expect(matchingChunks({ id: "doc-1" }, documentChunks).map((chunk) => chunk.chunk_id)).toEqual([
      "doc-1_chunk_0000",
      "doc-1_chunk_0001",
    ]);
  });
});
