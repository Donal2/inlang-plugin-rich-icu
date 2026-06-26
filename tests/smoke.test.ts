import { describe, expect, it } from "vitest";
import { parseIcu } from "../src/parse.js";
import { richIcuPlugin } from "../src/plugin.js";

describe("M0 smoke", () => {
  it("plugin a la bonne clé", () => {
    expect(richIcuPlugin.key).toBe("plugin.donal2.richIcu");
  });

  it("parse un message plat avec un argument", () => {
    const ast = parseIcu("Bonjour {name}.");
    expect(ast).toHaveLength(3); // literal, argument, literal
  });

  it("round-trip d'un message plat (texte + arg)", async () => {
    const files = [
      {
        locale: "fr",
        content: new TextEncoder().encode(JSON.stringify({ hi: "Bonjour {name}." })),
      },
    ];
    const settings = {
      baseLocale: "fr",
      locales: ["fr"],
      "plugin.donal2.richIcu": { pathPattern: "./messages/{locale}.json" },
    } as never;
    const importFiles = richIcuPlugin.importFiles;
    const exportFiles = richIcuPlugin.exportFiles;
    if (!importFiles || !exportFiles) throw new Error("plugin methods missing");
    const imported = await importFiles({ files, settings });
    const exported = await exportFiles({ ...imported, settings } as never);
    const out = JSON.parse(new TextDecoder().decode(exported[0].content));
    expect(out.hi).toBe("Bonjour {name}.");
  });
});
