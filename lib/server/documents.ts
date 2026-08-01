import { sha256 } from "../../packages/security/src";

/**
 * Document intake: validation, hashing and stage tracking.
 *
 * Validation is by MAGIC BYTES, not by file extension or the declared Content-Type.
 * Both of those are attacker-controlled: a request can claim `application/pdf` for
 * arbitrary content, and an extension is just part of a string. Checking the actual
 * leading bytes is the only part of this that is a real control.
 *
 * Stages describe operations that genuinely happened. There is deliberately no synthetic
 * percentage — a progress bar that is not driven by real processing is a lie told
 * politely.
 */

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export type IngestionStage =
  | "received"
  | "validated"
  | "hashed"
  | "duplicate"
  | "uploading"
  | "processing"
  | "indexed"
  | "failed";

export type DetectedType =
  | { ok: true; kind: "pdf" | "markdown" | "text"; mime: string }
  | { ok: false; reason: string };

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((byte, index) => bytes[index] === byte);
}

/** UTF-8 validity with no NUL bytes. A NUL is the cheapest signal that "text" is binary. */
function looksLikeText(bytes: Uint8Array): boolean {
  if (bytes.includes(0x00)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export function detectFileType(
  bytes: Uint8Array,
  declaredMime: string,
  filename: string,
): DetectedType {
  if (bytes.length === 0) return { ok: false, reason: "The uploaded file is empty." };
  if (bytes.length > MAX_DOCUMENT_BYTES) {
    return {
      ok: false,
      reason: `File exceeds the ${Math.floor(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB limit.`,
    };
  }

  const extension = filename.toLowerCase().split(".").pop() ?? "";
  const mime = declaredMime.toLowerCase().split(";")[0].trim();
  const isPdfBytes = startsWith(bytes, PDF_MAGIC);

  // The declared type and the real bytes must agree. Disagreement is the interesting
  // case: it means either a mislabelled upload or a deliberate one.
  if (isPdfBytes) {
    if (mime && mime !== "application/pdf" && mime !== "application/octet-stream") {
      return { ok: false, reason: `File content is a PDF but was declared as ${mime}.` };
    }
    return { ok: true, kind: "pdf", mime: "application/pdf" };
  }

  if (mime === "application/pdf" || extension === "pdf") {
    return {
      ok: false,
      reason: "File claims to be a PDF but does not begin with the PDF signature.",
    };
  }

  if (looksLikeText(bytes)) {
    const kind = extension === "md" || extension === "markdown" ? "markdown" : "text";
    return { ok: true, kind, mime: kind === "markdown" ? "text/markdown" : "text/plain" };
  }

  return {
    ok: false,
    reason: "Unsupported file. QueueProof accepts PDF, Markdown and plain text.",
  };
}

export async function contentHash(bytes: Uint8Array): Promise<string> {
  // Copy into a standalone ArrayBuffer so a view over a larger pooled buffer cannot
  // hash neighbouring bytes.
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return sha256(buffer);
}
