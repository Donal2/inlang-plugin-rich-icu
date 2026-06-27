import { describe, expect, it } from "vitest";
import { messageToImport } from "../src/icu-to-inlang.js";
import { bundleToMessageString } from "../src/inlang-to-icu.js";
import { richIcuPlugin } from "../src/plugin.js";

const imp = (source: string) => messageToImport({ source, bundleId: "m", locale: "fr" });
// biome-ignore lint/suspicious/noExplicitAny: test helper — AST inlang dynamique
const stringify = (a: any) =>
  bundleToMessageString({
    bundle: { id: "m", declarations: a.declarations },
    message: { selectors: a.selectors },
    variants: a.variants,
  });

describe("corrections post-revue", () => {
  it("#1 sélecteur DANS une balise markup — n'explose pas et garde le markup", () => {
    const a = imp("<b>{count, plural, one {# item} other {# items}}</b>");
    expect(a.variants).toHaveLength(2);
    // chaque variant est enveloppé par <b>…</b>
    for (const v of a.variants) {
      expect(v.pattern[0]).toEqual({ type: "markup-start", name: "b" });
      expect(v.pattern.at(-1)).toEqual({ type: "markup-end", name: "b" });
    }
    expect(stringify(a)).toBe("{count, plural, one {<b># item</b>} other {<b># items</b>}}");
  });

  it("#2 skeleton number/date préservé (pas de [object Object])", () => {
    const num = imp("{price, number, ::currency/USD}");
    expect(num.variants[0].pattern[0].annotation.options[0].value.value).toBe("::currency/USD");
    expect(stringify(num)).toBe("{price, number, ::currency/USD}");

    const date = imp("{d, date, ::yyyyMMdd}");
    expect(date.variants[0].pattern[0].annotation.options[0].value.value).toBe("::yyyyMMdd");
    expect(stringify(date)).toBe("{d, date, ::yyyyMMdd}");

    // style nommé (string simple) inchangé
    const pct = imp("{v, number, percent}");
    expect(pct.variants[0].pattern[0].annotation.options[0].value.value).toBe("percent");
  });

  it("#3 déclarations fusionnées entre locales — export plural non corrompu", async () => {
    const settings = {
      baseLocale: "ja",
      locales: ["ja", "en"],
      "plugin.donal2.richIcu": { pathPattern: "./messages/{locale}.json" },
    } as never;
    const files = [
      {
        locale: "ja",
        content: new TextEncoder().encode(JSON.stringify({ items: "{count}個" })),
      },
      {
        locale: "en",
        content: new TextEncoder().encode(
          JSON.stringify({ items: "{count, plural, one {# item} other {# items}}" }),
        ),
      },
    ];
    const importFiles = richIcuPlugin.importFiles;
    const exportFiles = richIcuPlugin.exportFiles;
    if (!importFiles || !exportFiles) throw new Error("plugin methods missing");
    const imported = await importFiles({ files, settings });
    const exported = await exportFiles({ ...imported, settings } as never);
    const byLocale = Object.fromEntries(
      exported.map((f) => [f.locale, JSON.parse(new TextDecoder().decode(f.content))]),
    );
    expect(byLocale.en.items).toBe("{count, plural, one {# item} other {# items}}");
    expect(byLocale.ja.items).toBe("{count}個");
  });

  it("#5 plural/select sans `other` → throw", () => {
    expect(() => imp("{g, select, male {il}}")).toThrow();
    expect(() => imp("{count, plural, one {une pomme}}")).toThrow();
  });

  it("#6 littéral entre apostrophes ressemblant à une balise — non corrompu", () => {
    const a = imp("'<br/>'");
    expect(a.variants[0].pattern.every((p: { type: string }) => p.type === "text")).toBe(true);
    expect(a.variants[0].pattern.map((p: { value: string }) => p.value).join("")).toBe("<br/>");
    // round-trip : reste du texte, ne devient jamais une balise markup
    const b = imp(stringify(a));
    expect(b.variants[0].pattern.every((p: { type: string }) => p.type === "text")).toBe(true);
    expect(b.variants[0].pattern.map((p: { value: string }) => p.value).join("")).toBe("<br/>");
  });

  it("#7 sélecteurs frères — ordre source préservé (count externe, g interne)", () => {
    const a = imp(
      "{count, plural, one {# chat} other {# chats}} et {g, select, male {lui} other {eux}}",
    );
    expect(a.selectors.map((s: { name: string }) => s.name)).toEqual(["countPlural", "g"]);
    const str = stringify(a);
    expect(str.startsWith("{count, plural,")).toBe(true);
    // re-import : ordre stable
    const b = imp(str);
    expect(b.selectors.map((s: { name: string }) => s.name)).toEqual(["countPlural", "g"]);
  });

  it("#8 balise paire vide <b></b> → start + end (pas standalone)", () => {
    expect(imp("<b></b>").variants[0].pattern).toEqual([
      { type: "markup-start", name: "b" },
      { type: "markup-end", name: "b" },
    ]);
  });

  it("#9 tableau de variants vide → chaîne vide (pas de crash)", () => {
    expect(
      bundleToMessageString({
        bundle: { id: "m", declarations: [] },
        message: { selectors: [] },
        variants: [],
      }),
    ).toBe("");
  });
});
