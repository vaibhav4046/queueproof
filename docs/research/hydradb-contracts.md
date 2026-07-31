# HydraDB contract research

Accessed 2026-07-31. QueueProof implements API version 2 against `https://api.hydradb.com`.

Authoritative sources:

- [HydraDB OpenAPI v2](https://docs.hydradb.com/api-reference/v2/openapi.json)
- [HydraDB API reference](https://docs.hydradb.com/api-reference)
- [`@hydradb/sdk` package](https://www.npmjs.com/package/@hydradb/sdk) — pinned to 2.1.2

Confirmed endpoints: `GET /connector-catalog`, `GET /connectors/providers?id=…`, `POST /connector-discovery`, `GET/POST /connectors`, `GET/DELETE /connectors/{id}`, connector discover/configure/sync/resources operations, `POST /query`, and multipart `POST /context/ingest`.

Connector catalogue and provider descriptors intentionally return open objects. QueueProof stores the raw descriptor plus a contract hash instead of hardcoding provider fields. Raw HTTP uses snake_case and the `API-Version: 2` header. There is no documented dedicated sync-run status endpoint; verification uses connector timestamps/errors/provider cursor plus a canary query. No numeric upload/rate limit was published, so 413 and 429 remain explicit runtime states rather than invented limits.
