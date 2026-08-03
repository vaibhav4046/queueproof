import { beforeAll, describe, expect, it } from "vitest";
import {
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_REQUEST_BYTES,
  contentHash,
  detectFileType,
  pdfPageCount,
} from "../lib/server/documents";
import { requireDb } from "../lib/server/runtime";
import { createId, ensureCoreSchema } from "../lib/server/store";

const pdfBytes = (body = "1 0 obj\n") => new TextEncoder().encode(`%PDF-1.7\n${body}%%EOF`);

describe("file type detection (magic bytes, not extension)", () => {
  it("accepts a real PDF by its signature", () => {
    const result = detectFileType(pdfBytes(), "application/pdf", "handbook.pdf");
    expect(result).toMatchObject({ ok: true, kind: "pdf", mime: "application/pdf" });
  });

  it("rejects content that claims to be a PDF but is not", () => {
    // The whole point of the control: a declared Content-Type is attacker-supplied.
    const result = detectFileType(new TextEncoder().encode("not a pdf at all"), "application/pdf", "x.pdf");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/does not begin with the PDF signature/);
  });

  it("rejects a PDF mislabelled as something else", () => {
    const result = detectFileType(pdfBytes(), "image/png", "sneaky.png");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/declared as image\/png/);
  });

  it("rejects a .pdf extension whose bytes are text", () => {
    const result = detectFileType(new TextEncoder().encode("hello"), "", "notes.pdf");
    expect(result.ok).toBe(false);
  });

  it("accepts markdown and plain text, distinguishing them by extension", () => {
    expect(detectFileType(new TextEncoder().encode("# Title"), "text/markdown", "a.md")).toMatchObject({
      ok: true,
      kind: "markdown",
    });
    expect(detectFileType(new TextEncoder().encode("plain"), "text/plain", "a.txt")).toMatchObject({
      ok: true,
      kind: "text",
    });
  });

  it("rejects binary content masquerading as text via a NUL byte", () => {
    const result = detectFileType(new Uint8Array([0x68, 0x00, 0x69]), "text/plain", "a.txt");
    expect(result.ok).toBe(false);
  });

  it("rejects invalid UTF-8", () => {
    const result = detectFileType(new Uint8Array([0xff, 0xfe, 0xfd]), "text/plain", "a.txt");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(detectFileType(new Uint8Array(), "text/plain", "a.txt").ok).toBe(false);
  });

  it("rejects a file over the size limit", () => {
    const oversized = new Uint8Array(MAX_DOCUMENT_BYTES + 1);
    oversized.set(pdfBytes());
    const result = detectFileType(oversized, "application/pdf", "big.pdf");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/exceeds/);
  });

  it("extracts receipt page count when the PDF page tree is inspectable", () => {
    expect(pdfPageCount(pdfBytes("1 0 obj << /Type /Pages /Count 346 >> endobj\n"))).toBe(346);
    expect(pdfPageCount(new TextEncoder().encode("plain text"))).toBeNull();
  });
});

describe("content hashing", () => {
  it("is stable for identical bytes and differs for changed bytes", async () => {
    const a = await contentHash(new TextEncoder().encode("same"));
    const b = await contentHash(new TextEncoder().encode("same"));
    const c = await contentHash(new TextEncoder().encode("different"));
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("hashes only the view, not the surrounding pooled buffer", async () => {
    const backing = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const view = backing.subarray(1, 4);
    expect(await contentHash(view)).toBe(await contentHash(new Uint8Array([2, 3, 4])));
  });
});

describe("duplicate prevention at the storage layer", () => {
  beforeAll(async () => {
    await ensureCoreSchema();
  });

  it("cannot store the same content twice in one workspace", async () => {
    const db = requireDb();
    const workspaceId = createId("ws");
    const hash = await contentHash(pdfBytes("dup"));

    await db
      .prepare(
        `INSERT INTO documents (id, workspace_id, filename, mime, byte_size, content_hash, stage)
         VALUES (?, ?, ?, ?, ?, ?, 'validated')`,
      )
      .bind(createId("doc"), workspaceId, "a.pdf", "application/pdf", 10, hash)
      .run();

    // A check-then-insert would race here; the UNIQUE constraint is the real control.
    await expect(
      db
        .prepare(
          `INSERT INTO documents (id, workspace_id, filename, mime, byte_size, content_hash, stage)
           VALUES (?, ?, ?, ?, ?, ?, 'validated')`,
        )
        .bind(createId("doc"), workspaceId, "copy.pdf", "application/pdf", 10, hash)
        .run(),
    ).rejects.toThrow();

    const rows = await db
      .prepare(`SELECT id FROM documents WHERE workspace_id = ? AND content_hash = ?`)
      .bind(workspaceId, hash)
      .all();
    expect(rows.results).toHaveLength(1);
  });

  it("allows the same content in a different workspace", async () => {
    const db = requireDb();
    const hash = await contentHash(pdfBytes("shared"));
    for (const workspaceId of [createId("ws"), createId("ws")]) {
      await db
        .prepare(
          `INSERT INTO documents (id, workspace_id, filename, mime, byte_size, content_hash, stage)
           VALUES (?, ?, ?, ?, ?, ?, 'validated')`,
        )
        .bind(createId("doc"), workspaceId, "a.pdf", "application/pdf", 10, hash)
        .run();
    }
    const rows = await db
      .prepare(`SELECT workspace_id FROM documents WHERE content_hash = ?`)
      .bind(hash)
      .all();
    expect(rows.results).toHaveLength(2);
  });
});

describe("document routes", () => {
  it("reject an unauthenticated request", async () => {
    const { GET, POST } = await import("../app/api/documents/route");
    expect((await GET()).status).toBe(401);
    expect(
      (await POST(new Request("https://queueproof.example/api/documents", { method: "POST" }))).status,
    ).toBe(401);
  });

  it("rejects a declared oversized upload before parsing multipart form data", async () => {
    const previousLocalIdentity = process.env.QUEUEPROOF_ALLOW_LOCAL_IDENTITY;
    process.env.QUEUEPROOF_ALLOW_LOCAL_IDENTITY = "true";
    try {
      await ensureCoreSchema();
      const db = requireDb();
      const userId = "user:local-development";
      let workspace = await db
        .prepare(
          `SELECT w.id FROM workspaces w
           JOIN workspace_members wm ON wm.workspace_id = w.id
           WHERE wm.user_id = ? LIMIT 1`,
        )
        .bind(userId)
        .first<{ id: string }>();
      if (!workspace) {
        const workspaceId = createId("ws");
        await db.batch([
          db.prepare("INSERT OR IGNORE INTO users (id, email, display_name) VALUES (?, ?, ?)")
            .bind(userId, "local@queueproof.invalid", "Local workspace"),
          db.prepare("INSERT INTO workspaces (id, slug, name) VALUES (?, ?, ?)")
            .bind(workspaceId, `upload-preflight-${workspaceId.slice(-6)}`, "Upload preflight"),
          db.prepare(
            "INSERT INTO workspace_members (id, workspace_id, user_id, role) VALUES (?, ?, ?, 'owner')",
          ).bind(createId("member"), workspaceId, userId),
        ]);
        workspace = { id: workspaceId };
      }

      let parsed = false;
      const request = new Request("https://queueproof.example/api/documents", {
        method: "POST",
        headers: {
          "Content-Type": "multipart/form-data; boundary=queueproof-test",
          "Content-Length": String(MAX_DOCUMENT_REQUEST_BYTES + 1),
        },
      });
      Object.defineProperty(request, "formData", {
        value: async () => {
          parsed = true;
          throw new Error("formData must not run for a declared oversized request");
        },
      });

      const { POST } = await import("../app/api/documents/route");
      const response = await POST(request);
      expect(response.status).toBe(413);
      expect(parsed).toBe(false);
      expect(workspace.id).toBeTruthy();
    } finally {
      if (previousLocalIdentity === undefined) delete process.env.QUEUEPROOF_ALLOW_LOCAL_IDENTITY;
      else process.env.QUEUEPROOF_ALLOW_LOCAL_IDENTITY = previousLocalIdentity;
    }
  });
});
