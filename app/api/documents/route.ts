import { apiError, noStoreJson } from "../../../lib/server/api";
import { requireRequestActor } from "../../../lib/server/identity";
import { requireDb } from "../../../lib/server/runtime";
import { audit, createId, ensureCoreSchema, requireWorkspaceForUser } from "../../../lib/server/store";
import { hydraAccountForWorkspace, hydraClientForWorkspace } from "../../../lib/server/hydradb-account";
import {
  MAX_DOCUMENT_BYTES,
  contentHash,
  detectFileType,
  type IngestionStage,
} from "../../../lib/server/documents";

async function recordStage(
  workspaceId: string,
  documentId: string,
  stage: IngestionStage,
  detail?: string,
) {
  await requireDb()
    .prepare(
      `INSERT INTO document_ingestion_runs (id, workspace_id, document_id, stage, detail)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(createId("ingest"), workspaceId, documentId, stage, detail ?? null)
    .run();
}

/** List documents for the authenticated workspace with their real stages. */
export async function GET() {
  try {
    const actor = await requireRequestActor();
    await ensureCoreSchema();
    const workspace = await requireWorkspaceForUser(actor.id);
    const rows = await requireDb()
      .prepare(
        `SELECT id, filename, mime, byte_size AS byteSize, content_hash AS contentHash,
                hydradb_source_id AS hydradbSourceId, stage, error, created_at AS createdAt
         FROM documents WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 100`,
      )
      .bind(String(workspace.id))
      .all();
    return noStoreJson({ ok: true, documents: rows.results });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Accept a document, validate it by magic bytes, hash it, and record it.
 *
 * The workspace is always resolved server-side from the authenticated actor; it is never
 * read from the request body, so a caller cannot write into another tenant's documents.
 *
 * When no HydraDB credential is configured the document is stored at stage `validated`
 * and the response says so explicitly. It does not invent a source id and does not claim
 * indexing happened — an upload that silently reports success without being retrievable
 * is worse than a clear pending state.
 */
export async function POST(request: Request) {
  try {
    const actor = await requireRequestActor();
    await ensureCoreSchema();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return noStoreJson(
        { ok: false, error: "Expected a multipart/form-data upload." },
        { status: 400 },
      );
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return noStoreJson({ ok: false, error: "No file field was provided." }, { status: 400 });
    }
    if (file.size > MAX_DOCUMENT_BYTES) {
      // Checked before reading the body into memory.
      return noStoreJson(
        { ok: false, error: `File exceeds the ${Math.floor(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB limit.` },
        { status: 413 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectFileType(bytes, file.type ?? "", file.name ?? "upload");
    if (!detected.ok) {
      await audit({
        workspaceId,
        actorId: actor.id,
        operation: "document.rejected",
        outcome: "denied",
        riskClass: "write",
        metadata: { reason: detected.reason, byteSize: bytes.byteLength },
      });
      return noStoreJson({ ok: false, error: detected.reason }, { status: 415 });
    }

    const hash = await contentHash(bytes);
    const db = requireDb();

    const existing = await db
      .prepare(
        `SELECT id, filename, stage, hydradb_source_id AS hydradbSourceId
         FROM documents WHERE workspace_id = ? AND content_hash = ? LIMIT 1`,
      )
      .bind(workspaceId, hash)
      .first<{ id: string; filename: string; stage: string; hydradbSourceId: string | null }>();

    if (existing) {
      await recordStage(workspaceId, existing.id, "duplicate", `Re-upload of ${file.name}.`);
      return noStoreJson({
        ok: true,
        duplicate: true,
        document: { ...existing, contentHash: hash },
        message: "This file is already in the workspace; the existing document was returned.",
      });
    }

    const account = await hydraAccountForWorkspace(workspaceId);
    const stage: IngestionStage = account ? "uploading" : "validated";
    const documentId = createId("doc");

    await db
      .prepare(
        `INSERT INTO documents (id, workspace_id, filename, mime, byte_size, content_hash, stage)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(documentId, workspaceId, file.name || "upload", detected.mime, bytes.byteLength, hash, stage)
      .run();

    await recordStage(workspaceId, documentId, "received", `${bytes.byteLength} bytes.`);
    await recordStage(workspaceId, documentId, "validated", `Detected ${detected.kind} by file signature.`);
    await recordStage(workspaceId, documentId, "hashed", hash);

    await audit({
      workspaceId,
      actorId: actor.id,
      operation: "document.upload",
      targetType: "document",
      targetId: documentId,
      outcome: "success",
      riskClass: "write",
      metadata: { kind: detected.kind, byteSize: bytes.byteLength, contentHash: hash },
    });

    if (!account) {
      return noStoreJson(
        {
          ok: true,
          hydradbConfigured: false,
          document: { id: documentId, filename: file.name, mime: detected.mime, stage, contentHash: hash },
          message:
            "Document stored and validated. Indexing is pending: configure a HydraDB credential for this workspace to make it retrievable.",
        },
        { status: 202 },
      );
    }

    // Upload to HydraDB. The database defaults to the workspace slug so each tenant's
    // documents land in their own database.
    const database = String(form.get("database") || workspace.slug || workspaceId);
    await recordStage(workspaceId, documentId, "uploading", `database=${database}`);

    const client = await hydraClientForWorkspace(workspaceId);
    const ingest = await client.ingestDocument({
      database,
      filename: file.name || "upload",
      bytes,
      mime: detected.mime,
    });

    if (!ingest.ok) {
      await recordStage(workspaceId, documentId, "failed", ingest.error ?? "Ingestion was rejected.");
      await db
        .prepare(`UPDATE documents SET stage = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(ingest.error ?? "HydraDB rejected the upload.", documentId)
        .run();
      return noStoreJson(
        { ok: false, error: ingest.error ?? "HydraDB rejected the upload.", documentId },
        { status: 502 },
      );
    }

    // A 202 from HydraDB means queued, not indexed. The source id is recorded and the
    // stage stays `processing` until a status poll observes a terminal state — reporting
    // "indexed" here is exactly how an upload appears to work while returning nothing.
    // HydraDB wraps its payload in a {success, data, error, meta} envelope, and the
    // client returns that envelope verbatim, so the results live one level deeper than
    // they appear. Both shapes are read: without the source id the document can never be
    // polled to a terminal state or cited as evidence, so a silent null here would make
    // the upload look successful and be useless.
    const envelope = ingest.data as
      | { results?: Array<{ id?: string }>; data?: { results?: Array<{ id?: string }> } }
      | null;
    const results = envelope?.data?.results ?? envelope?.results ?? [];
    const sourceId = results[0]?.id ?? null;

    if (!sourceId) {
      await recordStage(workspaceId, documentId, "failed", "HydraDB accepted the upload but returned no source id.");
      await db
        .prepare(`UPDATE documents SET stage = 'failed', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind("HydraDB returned no source id, so the document cannot be tracked or cited.", documentId)
        .run();
      return noStoreJson(
        { ok: false, error: "HydraDB accepted the upload but returned no source id.", documentId },
        { status: 502 },
      );
    }

    await db
      .prepare(
        `UPDATE documents SET stage = 'processing', hydradb_source_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
      .bind(sourceId, documentId)
      .run();
    await recordStage(workspaceId, documentId, "processing", sourceId ?? "queued without a source id");

    return noStoreJson(
      {
        ok: true,
        hydradbConfigured: true,
        document: {
          id: documentId,
          filename: file.name,
          mime: detected.mime,
          stage: "processing",
          contentHash: hash,
          hydradbSourceId: sourceId,
          database,
        },
        message:
          "Accepted by HydraDB and queued for indexing. Poll this document until its stage reaches indexed before querying it.",
      },
      { status: 202 },
    );
  } catch (error) {
    return apiError(error);
  }
}
