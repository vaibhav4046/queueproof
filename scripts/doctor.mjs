import { access } from "node:fs/promises";
import process from "node:process";

const checks = [
  ["Node >=22.13", Number(process.versions.node.split(".")[0]) >= 22],
  ["D1 migration", await access("drizzle/0000_bent_living_mummy.sql").then(() => true, () => false)],
  ["HydraDB API key", Boolean(process.env.HYDRADB_API_KEY || process.env.QUEUEPROOF_TEST_MODE === "true")],
  ["Encryption key", Boolean(process.env.QUEUEPROOF_ENCRYPTION_KEY || process.env.QUEUEPROOF_TEST_MODE === "true")],
];
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "NEEDS ACTION"}  ${name}`);
if (!checks[0][1] || !checks[1][1]) process.exitCode = 1;
