import { readFile } from "node:fs/promises";
if (process.env.QUEUEPROOF_TEST_MODE !== "true") {
  console.error("Refusing fixture evaluation without QUEUEPROOF_TEST_MODE=true.");
  process.exit(2);
}
const fixtures = JSON.parse(await readFile(new URL("../evals/fixtures/cases.json", import.meta.url)));
console.log(JSON.stringify({ suite: "routing-contract", cases: fixtures.length, fixtureMode: true }, null, 2));
