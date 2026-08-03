import process from "node:process";
const hydraApiKey = process.env.HYDRA_DB_API_KEY ?? process.env.HYDRADB_API_KEY;
const required = ["QUEUEPROOF_LIVE_TEST", "QUEUEPROOF_URL"];
const missing = required.filter((key) => !process.env[key]);
if (!hydraApiKey) missing.push("HYDRA_DB_API_KEY");
if (process.env.QUEUEPROOF_LIVE_TEST !== "true" || missing.length) {
  console.error(`Live acceptance skipped safely. Set QUEUEPROOF_LIVE_TEST=true and: ${missing.join(", ") || "required credentials"}.`);
  process.exit(2);
}
const base = process.env.QUEUEPROOF_URL.replace(/\/$/, "");
const health = await fetch(`${base}/api/health/ready`, { headers: { "Cache-Control": "no-store" } });
if (!health.ok) throw new Error(`Readiness failed with ${health.status}`);
console.log(JSON.stringify({ live: true, readiness: await health.json(),
  note: "Connector creation still requires provider-specific credentials through the encrypted web form." }, null, 2));
