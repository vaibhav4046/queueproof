# HydraDB contract diff — historical SDK snapshot

> **Research snapshot from 31 July 2026.** This comparison applies only to the source tree and
> installed `@hydradb/sdk` version inspected on that date. Later ingestion and connector work
> superseded some implementation findings. Do not treat it as current API documentation; use
> the pinned dependency, current code, tests, and HydraDB's official documentation. The
> original contract analysis is retained below for traceability.

**Access date: 2026-07-31, source: installed `@hydradb/sdk` 2.1.2 type declarations**
(`node_modules/@hydradb/sdk/dist/**/*.d.ts`, `dist/**/*.js` for URL paths, and `README.md`).
No network access was used. Where the SDK types an endpoint as `Record<string, unknown>`
(an open object), the contract is recorded as **UNTYPED** rather than verified or invented.

Note: the SDK `README.md` header says version `2.1.1`, but `package.json` says `2.1.2`.
The README's endpoint reference table omits the connector endpoints and `catalog`/`listProviders`
entirely — those exist only in the type declarations. The `.d.ts`/`.js` files are treated as
ground truth throughout.

---

## 0. Headline findings

| Verdict | Count |
| --- | --- |
| VERIFIED | 80 |
| MISMATCHED | 3 (1 load-bearing) |
| INVENTED | 15 field groups (4 load-bearing, 11 dead fallbacks) |
| UNTYPED (SDK returns an open object; unverifiable from types) | 9 keys |

The four load-bearing INVENTED names plus the one load-bearing MISMATCH are detailed in §9.
Each of `auth_types`, `supported_auth_types`, `last_synced_at`, `ingestion_timestamp`,
`indexed_at`, and `uploaded_at` was grepped against the entire `@hydradb/sdk` 2.1.2 package
(types, serializers, and compiled JS) and returns **zero** matches.

1. **QueueProof does not use the SDK.** `@hydradb/sdk@2.1.2` is a declared dependency
   (`package.json:30`) but is never imported anywhere in source. All calls go through a
   hand-rolled `fetch` wrapper at `packages/hydradb/src/client.ts:19-164`.
2. **Every URL path QueueProof uses is real** — all 13 match the SDK's compiled paths exactly.
3. **Every `/query` request field QueueProof sends is real** and correctly snake_cased.
   Retrieval-mode routing (`fast` / `thinking`) is genuine.
4. **Document / PDF ingestion is not implemented at all.** Nothing in the repo calls
   `/context/ingest` or any other `/context/*` endpoint.
5. Five invented/mismatched response fields are load-bearing and silently produce null or
   wrong data — see §9.

---

## 1. Real SDK surface (from type declarations)

### Client construction — `dist/BaseClient.d.ts:5-23`, `dist/environments.d.ts:1-4`

```
BaseClientOptions = {
  environment?, baseUrl?, apiVersion?, headers?, timeoutInSeconds?,
  maxRetries?, fetch?, logging?, auth?
} & BearerAuthProvider.AuthOptions   // supplies `token`
HydraDBEnvironment.Default = "https://api.hydradb.com"
```

Defaults: `apiVersion` `"2"` (sent as the `API-Version` header), `timeoutInSeconds` 60, `maxRetries` 2.

### Sub-clients — `dist/Client.d.ts:14-76`

`client.connectors`, `client.context`, `client.databases`, `client.webhooks`,
plus root methods `catalog()`, `listProviders()`, `query()`, and a passthrough `fetch()`.

### Complete method → HTTP path map (paths read from compiled `dist/**/Client.js`)

| Method | HTTP | Path | Source |
| --- | --- | --- | --- |
| `catalog` | GET | `/connector-catalog` | `dist/Client.js:82` |
| `listProviders` | GET | `/connectors/providers?id=` | `dist/Client.js:138` |
| `query` | POST | `/query` | `dist/Client.js:200` |
| `connectors.discoverPreview` | POST | `/connector-discovery` | `connectors/client/Client.js:81` |
| `connectors.list` | GET | `/connectors?provider=` | `:167` |
| `connectors.create` | POST | `/connectors` | `:237` |
| `connectors.get` | GET | `/connectors/{id}` | `:325` |
| `connectors.delete` | DELETE | `/connectors/{id}` | `:393` |
| `connectors.configure` | POST | `/connectors/{id}/configure` | `:477` |
| `connectors.rotateAConnectorsStoredOAuthRefreshToken` | PATCH | `/connectors/{id}/credentials` | `:564` |
| `connectors.discover` | GET | `/connectors/{id}/discover?cursor=&limit=` | `:668` |
| `connectors.listResources` | GET | `/connectors/{id}/resources` | `:756` |
| `connectors.createResource` | POST | `/connectors/{id}/resources` | `:826` |
| `connectors.deleteResource` | DELETE | `/connectors/{id}/resources/{resourceId}` | `:910` |
| `connectors.sync` | POST | `/connectors/{id}/sync` | `:988` |
| `context.delete` | DELETE | `/context` | `context/client/Client.js:70` |
| `context.ingest` | POST (multipart) | `/context/ingest` | `:183` |
| `context.inspect` | GET | `/context/inspect` | `:290` |
| `context.list` | POST | `/context/list` | `:358` |
| `context.relations` | GET | `/context/relations` | `:448` |
| `context.status` | GET | `/context/status` | `:529` |
| `context.updateSourceMetadata` | PATCH | `/context/{id}/metadata` | `:600` |
| `databases.list` | GET | `/databases` | `databases/client/Client.js:69` |
| `databases.create` | POST | `/databases` | `:134` |
| `databases.delete` | DELETE | `/databases` | `:234` |
| `databases.collections` | GET | `/databases/collections?database=` | `:318` |
| `databases.stats` | GET | `/databases/stats?database=` | `:402` |
| `databases.status` | GET | `/databases/status?database=` | `:486` |
| `databases.updateMetadataSchema` | PATCH | `/databases/{database}/metadata-schema` | `:568` |
| `webhooks.*` | — | `/webhooks/indexing[...]` | `webhooks/client/Client.js` |

**Auth note:** `catalog()` and `listProviders()` are the only two methods that do **not**
attach an auth request (`dist/Client.js:77-138` never calls `authProvider.getAuthRequest()`).
Every other method does, including `query` (`dist/Client.js:195`).

### `/query` request — real wire fields

`dist/api/client/requests/SearchQueryRequest.d.ts:6-79` (TS camelCase) →
`dist/serialization/client/requests/SearchQueryRequest.d.ts:13-35` (snake_case wire):

```
additional_context, alpha, collection, collections, database, graph_context,
graph_vector_prune, graph_vector_prune_spacy_entities, ids, max_results,
metadata_filters, mode, num_related_chunks, operator, query, query_apps,
query_by, query_forceful_relations, recency_bias,
sub_tenant_id (deprecated), sub_tenant_ids (deprecated), tenant_id (deprecated), type
```

Enums:

- `mode` = `SearchRecallMode`: `"fast" | "thinking" | "auto"` — `api/types/SearchRecallMode.d.ts`
- `query_by` = `SearchQueryBy`: `"hybrid" | "text"` — `api/types/SearchQueryBy.d.ts`
- `type` = `SearchSourceType`: `"knowledge" | "memory" | "all"` — `api/types/SearchSourceType.d.ts`
- `operator` = `SearchOperator`: `"or" | "and" | "phrase"` — `api/types/SearchOperator.d.ts`
- `collections` = `string[] | Record<string, number>` (weighted) — `api/types/SearchQueryRequestCollections.d.ts`
- `metadata_filters` = `Record<string, unknown>`; top-level keys hit tenant metadata,
  nested `additional_metadata` keys hit document metadata — `api/types/SearchMetadataFilters.d.ts`
- `ids` = `string[]`, a hard `source_id in [...]` pre-filter, preserved across the zero-result retry.

### `/query` response — real wire fields

`HandlerEnvelopeSearchV2RetrievalResult` = `{ data, error, meta, success }`.
`data` = `SearchV2RetrievalResult` (`serialization/types/SearchV2RetrievalResult.d.ts`):

```
additional_context: Record<string, SearchV2Chunk>
chunks:             SearchV2Chunk[]
graph_context:      SearchGraphContext
sources:            SearchSourceInfo[]
```

`SearchV2Chunk` (`serialization/types/SearchV2Chunk.d.ts:7-21`) — **complete list**:

```
additional_metadata, chunk_content, chunk_uuid, extra_context_ids, id, layout,
metadata, relevancy_score, source_last_updated_time, source_title, source_type,
source_upload_time, sub_tenant_id
```

`SearchSourceInfo` (`serialization/types/SearchSourceInfo.d.ts:6-19`) — **complete list**:

```
additional_metadata, app_external_id, app_kind, app_provider, description, id,
metadata, sub_tenant_id, timestamp, title, type, url
```

`SearchGraphContext`: `chunk_id_to_group_ids`, `chunk_relations`, `query_paths`.

### Connector / provider payloads

- `HandlerConnectorCreateReq.Raw`: `auth_type, collection, credentials, database,
  deployment_id, name, plan, provider (required), provider_account_scope,
  sub_tenant_id, sync_engine, sync_interval_seconds, tenant_id`
- `HandlerDiscoverPreviewReq.Raw`: `auth_type, credentials (required), provider (required)`
  (+ `cursor` / `limit` as query params)
- `HandlerConfigureReq.Raw`: `backfill_chunk_interval_seconds, lookback_days, resources (required)`
- `HandlerResourceMapping.Raw`: `additional_metadata, collection, database, metadata, name,
  resource_id (required), resource_type, sub_tenant_id, tenant_id`
- `ConnectorsConnector.Raw` — **complete list**: `auth_type, collection, connector_id,
  credential_ref, database, deployment_id, last_attempted_sync_at, last_error,
  last_successful_sync_at, name, next_sync_at, org_id, plan, provider,
  provider_account_scope, status, sub_tenant_id, sync_engine, sync_interval_seconds,
  sync_status, tenant_id, user_id`
- `ConnectorsResource.Raw` — **complete list**: `additional_metadata,
  backfill_chunk_interval_seconds, backfill_next_chunk_at, backfill_oldest, backfill_status,
  collection_override, connector_id, database_override, display_name, filters, metadata,
  provider_cursor, provider_metadata, resource_id, resource_type, status,
  sub_tenant_id_override, tenant_id_override`
- `TenantsTenantIdsResponse.Raw`: `databases, failed_databases, failed_tenant_ids, message, tenant_ids`

**Return-type note:** `connectors.create` and `connectors.createResource` return the bare
`ConnectorsConnector` / `ConnectorsResource` (not a `HandlerEnvelope`) —
`connectors/client/Client.d.ts:62,200`. `connectors.list`, `get`, `delete`, `configure`,
`discover`, `discoverPreview`, `listResources`, `sync`, plus root `catalog` and `listProviders`,
all return `Record<string, unknown>` (UNTYPED).

### Document / file ingestion (real surface, unused by QueueProof)

`context.ingest` — `POST /context/ingest`, multipart. Form-field names appended by the SDK
(`context/client/Client.js:120-175`): `app_knowledge`, `collection`, `database`,
`document_metadata`, `documents` (the file), `graph_payload`, `memories`, `sub_tenant_id`,
`tenant_id`, `type`, `upsert`. `database` is required.
Response: `IngestionV2SourceUploadResponse` = `{ failed_count, message, results[], success, success_count }`;
each result item = `{ error, error_code, filename, id, relations_created, relations_error, status }`
with `status` ∈ `queued | processing | completed | failed`.

---

## 2. Where QueueProof calls HydraDB

Single chokepoint: **`packages/hydradb/src/client.ts`** — a hand-rolled raw-`fetch` wrapper
(`HydraDbClient`), constructed per-workspace from an encrypted DB row at
`lib/server/hydradb-account.ts:17-24`.

| File | HydraDB operations |
| --- | --- |
| `packages/hydradb/src/client.ts:89-163` | all 13 request builders |
| `app/api/query/route.ts:25-37` | `query` |
| `app/api/ask/route.ts:47-59` | `query` (fan-out, one per verified connector) |
| `lib/server/queue.ts:211-223` | `query` (fan-out) |
| `packages/mcp/src/server.ts:148-150,170-181` | `syncConnector`, `query` |
| `app/api/providers/route.ts:16,31` | `listProviders()` and `listProviders(id)` |
| `app/api/connectors/route.ts:59-67` | `createConnector` |
| `app/api/connectors/[id]/discover/route.ts:20` | `discoverResources` |
| `app/api/connectors/[id]/configure/route.ts:41-45` | `configureConnector` |
| `app/api/connectors/[id]/sync/route.ts:18-20` | `syncConnector` |
| `app/api/connectors/[id]/verify/route.ts:32-35,57-67` | `connectorResources`, `getConnector`, `query` |
| `app/api/databases/route.ts:17,36` | `listDatabases`, `createDatabase` |
| `app/api/hydradb/configure/route.ts:18-19` | `listDatabases` (used as key-verification probe) |
| `lib/server/hydradb-shapes.ts:1-38` | all response unwrapping / field extraction |

Defined but never called: `listConnectors` (`client.ts:96`), `databaseStatus` (`client.ts:116`),
`previewResources` (`client.ts:122`).

---

## 3. Transport contract

| QueueProof | SDK ground truth | Verdict |
| --- | --- | --- |
| default base URL `https://api.hydradb.com` (`client.ts:17`) | `HydraDBEnvironment.Default` | VERIFIED |
| `Authorization: Bearer <key>` (`client.ts:37`) | `BearerAuthProvider` | VERIFIED |
| `API-Version: "2"` (`client.ts:38`) | default `apiVersion` `"2"` | VERIFIED |
| `Content-Type: application/json` on non-FormData (`client.ts:40`) | `contentType: "application/json"` | VERIFIED |
| reads response header `x-request-id` (`client.ts:45`) | README:154 documents `x-request-id` | VERIFIED |
| error body read as `parsed.error` (`client.ts:57`) | `HandlerEnvelope*.error: HandlerApiError` | VERIFIED |

## 4. URL paths — QueueProof vs SDK

| QueueProof (`packages/hydradb/src/client.ts`) | Method | SDK path | Verdict |
| --- | --- | --- | --- |
| `/connector-catalog` (`:90`) | GET | `/connector-catalog` | VERIFIED |
| `/connectors/providers?id=` (`:92`) | GET | `/connectors/providers` + query `id` | VERIFIED |
| `/connectors?provider=` (`:98`) | GET | `/connectors` + query `provider` | VERIFIED |
| `/connectors/{id}` (`:102`) | GET | `/connectors/{id}` | VERIFIED |
| `/databases` (`:106`) | GET | `/databases` | VERIFIED |
| `/databases` (`:110`) | POST | `/databases` | VERIFIED |
| `/databases/status?database=` (`:118`) | GET | `/databases/status` + query `database` | VERIFIED |
| `/connector-discovery` (`:123`) | POST | `/connector-discovery` | VERIFIED |
| `/connectors` (`:130`) | POST | `/connectors` | VERIFIED |
| `/connectors/{id}/discover` (`:137`) | GET | `/connectors/{id}/discover` | VERIFIED |
| `/connectors/{id}/configure` (`:141`) | POST | `/connectors/{id}/configure` | VERIFIED |
| `/connectors/{id}/sync` (`:148`) | POST | `/connectors/{id}/sync` | VERIFIED |
| `/connectors/{id}/resources` (`:155`) | GET | `/connectors/{id}/resources` | VERIFIED |
| `/query` (`:159`) | POST | `/query` | VERIFIED |

**13/13 VERIFIED.** No invented paths.

## 5. `/query` request fields

Sent at `app/api/query/route.ts:26-37`, `app/api/ask/route.ts:48-58`,
`lib/server/queue.ts:212-222`, `app/api/connectors/[id]/verify/route.ts:58-66`,
`packages/mcp/src/server.ts:171-180`.

| Field sent | SDK wire field | Verdict |
| --- | --- | --- |
| `database` | `database` | VERIFIED |
| `collections` (string[]) | `collections` | VERIFIED |
| `query` | `query` | VERIFIED |
| `type: "knowledge"` | `type` ∈ knowledge/memory/all | VERIFIED |
| `query_by: "hybrid" \| "text"` | `query_by` ∈ hybrid/text | VERIFIED |
| `mode: "fast" \| "thinking"` | `mode` ∈ fast/thinking/auto | VERIFIED |
| `max_results` | `max_results` | VERIFIED |
| `graph_context` | `graph_context` | VERIFIED |
| `query_forceful_relations` | `query_forceful_relations` | VERIFIED |
| `query_apps` | `query_apps` | VERIFIED |
| `recency_bias` | `recency_bias` | VERIFIED |

**11/11 VERIFIED.** Snake_case is correct here precisely *because* QueueProof bypasses the SDK —
the SDK's camelCase→snake_case mapping does not apply to raw fetch.

Retrieval-mode routing is real: `packages/retrieval/src/index.ts:29-68` emits only
`"fast"` / `"thinking"` and `"hybrid"` / `"text"`, all valid enum members.
`"auto"` is resolved client-side before the call (`app/api/query/route.ts:21`) and never sent,
though it would also be valid.

Never sent (all real, all unused): `additional_context`, `alpha`, `collection`, `ids`,
`metadata_filters`, `num_related_chunks`, `operator`, `graph_vector_prune`,
`graph_vector_prune_spacy_entities`.

Minor: `planRetrieval` computes `queryApps` (`packages/retrieval/src/index.ts:62`) but every
call site hardcodes `query_apps: true` instead of using it.

## 6. `/query` response fields

| Field read | Where | SDK wire field | Verdict |
| --- | --- | --- | --- |
| `root.data` unwrap | `hydradb-shapes.ts:6` | `HandlerEnvelope*.data` | VERIFIED |
| `data.sources[]` | `hydradb-shapes.ts:27` | `sources` | VERIFIED |
| `data.chunks[]` | `hydradb-shapes.ts:28` | `chunks` | VERIFIED |
| `data.graph_context` | `query/route.ts:121` | `graph_context` | VERIFIED |
| `chunk.chunk_content` | `query/route.ts:54`, `queue.ts:79`, `ask/route.ts:67` | `chunk_content` | VERIFIED |
| `chunk.relevancy_score` | `query/route.ts:58` | `relevancy_score` | VERIFIED |
| `chunk.id` | `query/route.ts:56` | `id` | VERIFIED |
| `chunk.source_last_updated_time` | `query/route.ts:60` | `source_last_updated_time` | VERIFIED |
| `chunk.source_upload_time` | `query/route.ts:60` | `source_upload_time` | VERIFIED |
| `source.id` | `query/route.ts:46`, `queue.ts:58,76` | `id` | VERIFIED |
| `source.title` | `query/route.ts:48`, `queue.ts:84` | `title` | VERIFIED |
| `source.timestamp` | `query/route.ts:49`, `queue.ts:98` | `timestamp` | VERIFIED |
| `source.url` | `query/route.ts:50`, `queue.ts:97` | `url` | VERIFIED |
| `source.metadata` | `query/route.ts:51`, `queue.ts:52` | `metadata` | VERIFIED |
| `source.additional_metadata` | `hydradb-shapes.ts:35`, `queue.ts:53`, `verify/route.ts:73` | `additional_metadata` | VERIFIED |
| `source.app_provider` | `hydradb-shapes.ts:33,36` | `app_provider` | VERIFIED |
| `source.description` | `queue.ts:80`, `ask/route.ts:68` | `description` | VERIFIED |
| `source.provider` | `hydradb-shapes.ts:33,36` | real name is `app_provider` | MISMATCHED (harmless — `app_provider` is tried first) |
| `chunk.source_id` / `context_id` / `document_id` / `parent_id` | `queue.ts:60` | real join key is `chunk.id` | **MISMATCHED (load-bearing)** |
| `source.source_id` | `queue.ts:58,76`, `ask/route.ts:71` | real name is `id` | MISMATCHED (harmless — `id` is tried first) |
| `source.context_id` | `queue.ts:58,76` | — | INVENTED (dead fallback) |
| `source.connector_id` | `verify/route.ts:75` | — | **INVENTED (load-bearing)** |
| `source.content` / `text` / `excerpt` | `queue.ts:80`, `ask/route.ts:68` | — | INVENTED (dead fallback) |
| `chunk.content` / `text` / `excerpt` | `queue.ts:79`, `ask/route.ts:67` | — | INVENTED (dead fallback) |
| `source.name` / `subject` / `filename` | `queue.ts:84`, `ask/route.ts:73` | — | INVENTED (dead fallback) |
| `source.source_url` / `web_url` / `permalink` | `queue.ts:97`, `ask/route.ts:76` | — | INVENTED (dead fallback) |
| `source.source_timestamp` / `created_at` / `updated_at` | `queue.ts:98`, `ask/route.ts:75` | — | INVENTED (dead fallback) |
| `source.ingestion_timestamp` / `uploaded_at` / `indexed_at` | `queue.ts:99` | — | **INVENTED (load-bearing)** |
| `metadata.external_id` | `queue.ts:76` | free-form metadata; unconstrained | UNTYPED |

## 7. Connector lifecycle fields

### `POST /connectors` request — `app/api/connectors/route.ts:59-67`

| Field | SDK `HandlerConnectorCreateReq.Raw` | Verdict |
| --- | --- | --- |
| `provider` | `provider` (required) | VERIFIED |
| `name` | `name` | VERIFIED |
| `database` | `database` | VERIFIED |
| `collection` | `collection` | VERIFIED |
| `provider_account_scope` | `provider_account_scope` | VERIFIED |
| `auth_type` | `auth_type` | VERIFIED |
| `credentials` | `credentials` | VERIFIED |

### `POST /connectors` response — `app/api/connectors/route.ts:83`

| Field | SDK | Verdict |
| --- | --- | --- |
| `raw.connector_id` | `ConnectorsConnector.Raw.connector_id` | VERIFIED |
| `raw.id` (fallback) | not present | INVENTED (dead fallback) |

Correctly read *without* envelope unwrapping — `connectors.create` returns the bare
`ConnectorsConnector` (`connectors/client/Client.d.ts:62`).

### `POST /connectors/{id}/configure` request — `packages/hydradb/src/client.ts:143`, `configure/route.ts:35-39`

| Field | SDK | Verdict |
| --- | --- | --- |
| `resources` | `HandlerConfigureReq.Raw.resources` | VERIFIED |
| `lookback_days` | `HandlerConfigureReq.Raw.lookback_days` | VERIFIED |
| `resources[].resource_id` | `HandlerResourceMapping.Raw.resource_id` | VERIFIED |
| `resources[].resource_type` | `...resource_type` | VERIFIED |
| `resources[].name` | `...name` | VERIFIED |

### `GET /connectors/{id}` response — `app/api/connectors/[id]/verify/route.ts:48-50`

| Field | SDK `ConnectorsConnector.Raw` | Verdict |
| --- | --- | --- |
| `sync_status` | `sync_status` | VERIFIED |
| `status` (fallback) | `status` | VERIFIED |
| `last_successful_sync_at` | `last_successful_sync_at` | VERIFIED |
| `last_error` | `last_error` | VERIFIED |
| camelCase fallbacks (`syncStatus`, `lastSuccessfulSyncAt`, `lastError`) | wire is snake_case only | INVENTED (dead fallback) |

### `GET /connectors/{id}/resources` response — `verify/route.ts:36-44`, `hydradb-shapes.ts:22`

| Field | SDK `ConnectorsResource.Raw` | Verdict |
| --- | --- | --- |
| envelope key `resources` | endpoint typed `Record<string, unknown>` | UNTYPED |
| `resource_id` | `resource_id` | VERIFIED |
| `provider_cursor` | `provider_cursor` | VERIFIED |
| `connector_id` | `connector_id` | VERIFIED |
| `resource_type` | `resource_type` | VERIFIED |
| `display_name` | `display_name` | VERIFIED |
| `status` | `status` | VERIFIED |
| `resource.id` (fallback) | not present | INVENTED (dead fallback) |
| `resource.last_synced_at` | **not present at resource level** | **INVENTED (load-bearing)** |
| camelCase fallbacks (`resourceId`, `providerCursor`, `lastSyncedAt`) | wire is snake_case only | INVENTED (dead fallback) |

### `GET /connectors/{id}/discover` response — `app/api/connectors/[id]/discover/route.ts:27`

Consumed via `genericProviderAdapter.formatResources`. The SDK types this endpoint as
`Record<string, unknown>` — UNTYPED, unverifiable.

## 8. Provider catalogue and databases

### `listProviders` response — `app/api/providers/route.ts`, `packages/connectors/src/index.ts:40-47`

The SDK types both `catalog()` and `listProviders()` as `Record<string, unknown>`. The only
field-level authority is the jsdoc at `dist/Client.d.ts:36`, which names
`indexed_object_types`, `searchable_fields`, `filterable_fields` (each carrying `filter_key`),
`credential_schema`, and `setup_guide`, and describes "availability, maturity, category, sync engine".

| Field read | Verdict |
| --- | --- |
| `credential_schema` | VERIFIED (jsdoc) |
| `indexed_object_types` | VERIFIED (jsdoc) |
| `searchable_fields` | VERIFIED (jsdoc) |
| `filterable_fields` | VERIFIED (jsdoc) |
| `setup_guide` | VERIFIED (jsdoc) |
| `available`, `status`, `maturity`, `category`, `sync_engine` | UNTYPED (concepts named in prose, exact keys unconfirmed) |
| envelope keys `providers` / `connectors` / `items` / `catalog` (`hydradb-shapes.ts:11`) | UNTYPED |
| `auth_types` / `supported_auth_types` (`providers/route.ts:103`) | **INVENTED (load-bearing)** |

### `GET /databases` response — `app/api/databases/route.ts:9`

| Field | SDK `TenantsTenantIdsResponse.Raw` | Verdict |
| --- | --- | --- |
| `databases` | `databases` | VERIFIED |
| `tenant_ids` | `tenant_ids` (deprecated alias) | VERIFIED |
| `tenantIds` (camel fallback) | wire is snake_case only | INVENTED (dead fallback) |

### `POST /databases` request — `packages/hydradb/src/client.ts:112`

| Field | SDK `TenantsTenantCreateRequest.Raw` | Verdict |
| --- | --- | --- |
| `database` | `database` | VERIFIED |

### `GET /databases/status` query param — `packages/hydradb/src/client.ts:118`

| Param | SDK | Verdict |
| --- | --- | --- |
| `database` | `database` (`databases/client/Client.js:477-486`) | VERIFIED |

## 9. Load-bearing defects

These five produce wrong or null data at runtime rather than being harmless fallbacks.

1. **`resource.last_synced_at` does not exist** — `app/api/connectors/[id]/verify/route.ts:43`.
   `ConnectorsResource` has no per-resource last-sync timestamp; the nearest real field is
   connector-level `last_successful_sync_at`. Effect: `connector_resources.last_synced_at` is
   always written NULL (`verify/route.ts:129`), and the proof endpoint always reports
   `lastSyncedAt: null`.

2. **`source.ingestion_timestamp` / `uploaded_at` / `indexed_at` do not exist** —
   `lib/server/queue.ts:99`. Effect: `Evidence.ingestionTimestamp` is always `null`, is persisted
   as NULL (`queue.ts:335,340`), and is surfaced through the contract schema
   (`packages/contracts/src/index.ts:29`) and the UI (`app/QueueProofApp.tsx:43`).
   The real source timestamp is `source.timestamp`, already used for the separate `timestamp` field.

3. **Chunk↔source join uses non-existent keys** — `lib/server/queue.ts:57-66` matches on
   `chunk.source_id | context_id | document_id | parent_id`. None exist on `SearchV2Chunk`;
   the real parent-source key is `chunk.id` (which `app/api/query/route.ts:56` already uses
   correctly). Effect: `matchingChunk` never finds an exact match and always falls through to
   the positional `chunks[index] ?? chunks[0]`. Since `sources` is a *deduplicated source list*
   and `chunks` is a *ranked chunk list*, the two arrays are not positionally aligned, so
   evidence excerpts can be attached to the wrong source. The same positional pairing appears at
   `app/api/ask/route.ts:66`.

4. **`provider.auth_types` / `supported_auth_types` do not exist** —
   `app/api/providers/route.ts:103`. Neither appears in the SDK types or the `listProviders`
   jsdoc. Effect: `authTypes` is always `[]`, so the connector-create flow never surfaces a
   provider's supported auth methods even though `auth_type` is a real create-request field.

5. **`source.connector_id` does not exist** — `app/api/connectors/[id]/verify/route.ts:75-76`.
   The guard is `!sourceConnector || String(sourceConnector) === connector.hydradb_connector_id`,
   so with the field permanently absent the check always passes. Effect: the canary query's
   connector-scoping is inert — any source from the right provider counts as proof, regardless of
   which connector produced it. `ConnectorsResource.metadata` documentation states the system
   *does* inject `connector_id` into synced objects' **tenant** metadata, so the correct lookup is
   `source.metadata.connector_id`; the code checks `source.additional_metadata.connector_id`,
   the wrong metadata layer.

## 10. Document / PDF ingestion

**Not implemented.** No file in the repo (excluding `node_modules`) calls `/context/ingest`
or any other `/context/*` endpoint, and `HydraDbClient` (`packages/hydradb/src/client.ts:89-163`)
exposes no ingest, list, status, inspect, relations, or delete method.

- The only `FormData` reference is a defensive Content-Type branch at
  `packages/hydradb/src/client.ts:40` that no caller ever exercises.
- `scripts/generate-large-pdf.mjs:1` is a stub that prints
  `"Large-PDF generation is test-only."`.
- `db/schema.ts:450` (`memories`) and `lib/server/store.ts:81` are QueueProof's own local
  SQLite/D1 tables, not HydraDB ingestion.

QueueProof is retrieval- and connector-only: all data reaches HydraDB via provider connectors
(`/connectors/*` sync), never via direct document upload.

## 11. Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `HYDRADB_API_KEY` | `.env.example:17`, `scripts/doctor.mjs:7`, `scripts/live-acceptance.mjs:13` | Script-only; the web app never reads it |
| `QUEUEPROOF_ENCRYPTION_KEY` | `.env.example:2` | Encrypts the stored HydraDB key at rest |
| `QUEUEPROOF_TEST_MODE` | `.env.example:12` | Lets `doctor.mjs` pass without a real key |
| `QUEUEPROOF_LIVE_TEST`, `QUEUEPROOF_URL` | `.env.example:13-14` | Gate the live-acceptance script |

**There is no env var for the HydraDB API key or base URL in the running application.**
Both are per-workspace database columns (`hydradb_accounts.encrypted_api_key`,
`hydradb_accounts.base_url`), written by `app/api/hydradb/configure/route.ts:41-55` and read by
`lib/server/hydradb-account.ts:20-23`. The base URL defaults to `https://api.hydradb.com`
at `app/api/hydradb/configure/route.ts:17` and `packages/hydradb/src/client.ts:17`.
