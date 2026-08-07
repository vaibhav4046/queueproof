/**
 * Alias for dynamic client registration at the bare `/register` path.
 *
 * The canonical endpoint advertised in authorization-server metadata is `/oauth/register`,
 * but several MCP clients probe `/register` first out of convention. Without this route
 * Next.js answered that probe with the not-found page — an HTML body under a 200 — which
 * clients parse as a malformed registration response rather than a missing endpoint.
 */
export { POST, OPTIONS } from "../oauth/register/route";
