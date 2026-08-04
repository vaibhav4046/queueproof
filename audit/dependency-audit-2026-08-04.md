# Dependency advisory audit — 4 August 2026

Command: `pnpm audit --json`

Final locked result:

| Severity | Count | Release impact |
| --- | ---: | --- |
| Critical | 0 | none |
| High | 0 | none |
| Moderate | 1 advisory | development tooling only |
| Low | 0 | none |

The remaining advisory is `GHSA-67mh-4wv8-2f99` in esbuild 0.18.20, reached only
through Drizzle Kit's deprecated `@esbuild-kit/esm-loader` dependency. The vulnerable
operation is esbuild's development server. QueueProof does not run that transitive
development server in production, tests, migrations, or the documented local workflow.
Drizzle Kit 0.31.10 is the current release and still carries that dependency; a forced
incompatible esbuild override is intentionally not used.

The release updated Next.js, React, Vite, Vitest, Wrangler, and the Cloudflare Vite
plugin, removed unused React Three and MCP Node packages, and locked patched `fast-uri`,
`hono`, `postcss`, and `undici` transitive versions. The complete application and build
suite was rerun after the upgrades.
