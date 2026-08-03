import { apiError, noStoreJson } from "../../../lib/server/api";
import { requirePrivateControlActor, requireRequestActor } from "../../../lib/server/identity";
import { requireDb } from "../../../lib/server/runtime";
import { audit, createId, ensureCoreSchema, requireWorkspaceForUser } from "../../../lib/server/store";
import { hydraAccountForWorkspace, hydraClientForWorkspace } from "../../../lib/server/hydradb-account";
import {
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_REQUEST_BYTES,
  contentHash,
  detectFileType,
  pdfPageCount,
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
                hydradb_database AS database, hydradb_source_id AS hydradbSourceId,
                page_count AS pageCount, indexed_at AS indexedAt,
                processing_duration_ms AS processingDurationMs,
                stage, error, created_at AS createdAt
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
    requirePrivateControlActor(actor, "Document upload");
    await ensureCoreSchema();
    const workspace = await requireWorkspaceForUser(actor.id);
    const workspaceId = String(workspace.id);

    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_DOCUMENT_REQUEST_BYTES) {
      // This must remain before formData(): the parser materialises multipart bodies, so
      // checking only File.size afterward does not protect memory from declared oversize
      // requests. The per-file byte check below remains authoritative after parsing.
      return noStoreJson(
        { ok: false, error: `Upload request exceeds the ${Math.floor(MAX_DOCUMENT_BYTES / (1024 * 1024))} MB file limit.` },
        { status: 413 },
      );
    }

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
      // Checked before the explicit ArrayBuffer copy below. The framework has already
      // parsed multipart metadata at this boundary, so this is not claimed as streaming.
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
    const pageCount = detected.kind === "pdf" ? pdfPageCount(bytes) : null;
    const db = requireDb();

    const existing = await db
      .prepare(
        `SELECT id, filename, stage, hydradb_database AS database,
                hydradb_source_id AS hydradbSourceId, page_count AS pageCount,
                indexed_at AS indexedAt, processing_duration_ms AS processingDurationMs
         FROM documents WHERE workspace_id = ? AND content_hash = ? LIMIT 1`,
      )
      .bind(workspaceId, hash)
      .first<{
        id: string; filename: string; stage: string; database: string | null;
        hydradbSourceId: string | null; pageCount: number | null;
        indexedAt: string | null; processingDurationMs: number | null;
      }>();

    if (existing) {
      if (pageCount && !existing.pageCount) {
        await db.prepare(`UPDATE documents SET page_count = ? WHERE id = ?`).bind(pageCount, existing.id).run();
        existing.pageCount = pageCount;
      }
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
        `INSERT INTO documents (id, workspace_id, filename, mime, byte_size, content_hash, page_count, stage)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(documentId, workspaceId, file.name || "upload", detected.mime, bytes.byteLength, hash, pageCount, stage)
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
          document: { id: documentId, filename: file.name, mime: detected.mime, stage, contentHash: hash, pageCount },
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
        `UPDATE documents SET stage = 'processing', hydradb_source_id = ?, hydradb_database = ?,
         updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      )
      .bind(sourceId, database, documentId)
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
          pageCount,
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
