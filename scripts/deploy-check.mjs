import { readFile } from "node:fs/promises";
const hosting = JSON.parse(await readFile(".openai/hosting.json", "utf8"));
for (const binding of ["d1", "r2"]) if (!hosting[binding]) throw new Error(`Missing ${binding} binding`);
console.log("PASS  Sites bindings declared");
