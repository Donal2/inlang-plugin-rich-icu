import { readFileSync } from "node:fs";

const bundle = readFileSync(new URL("../dist/index.js", import.meta.url), "utf8");
// Safety check: no runtime dep should remain external (non-relative bare import).
const bareImport = /\bfrom\s+["'](?!\.|node:)[^"']+["']/.exec(bundle);
if (bareImport) {
  throw new Error(
    `Unbundled external import detected: ${bareImport[0]} — tsup noExternal misconfigured`,
  );
}
const mod = await import(new URL("../dist/index.js", import.meta.url));
if (mod.default?.key !== "plugin.donal2.richIcu") {
  throw new Error("Bundle does not export the expected plugin as default");
}
console.log("OK: self-contained ESM bundle, plugin export =", mod.default.key);
