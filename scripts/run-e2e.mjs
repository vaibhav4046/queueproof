const base = (process.env.QUEUEPROOF_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const response = await fetch(`${base}/api/health/live`);
if (!response.ok) throw new Error(`QueueProof is not live: ${response.status}`);
const html = await (await fetch(base)).text();
for (const marker of ["QUEUEPROOF", "Command", "Connectors", "Ask"]) {
  if (!html.includes(marker)) throw new Error(`Missing rendered marker: ${marker}`);
}
console.log("PASS  live endpoint and primary shell");
