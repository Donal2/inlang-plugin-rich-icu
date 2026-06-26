import { readFileSync } from "node:fs";

const bundle = readFileSync(new URL("../dist/index.js", import.meta.url), "utf8");
// Garde-fou : aucune dep runtime ne doit rester externalisée (import bare non relatif).
const bareImport = /\bfrom\s+["'](?!\.|node:)[^"']+["']/.exec(bundle);
if (bareImport) {
  throw new Error(
    `Import externe non bundlé détecté: ${bareImport[0]} — tsup noExternal mal configuré`,
  );
}
const mod = await import(new URL("../dist/index.js", import.meta.url));
if (mod.default?.key !== "plugin.donal2.richIcu") {
  throw new Error("Le bundle n'exporte pas le plugin attendu en default");
}
console.log("OK: bundle ESM auto-contenu, plugin export =", mod.default.key);
