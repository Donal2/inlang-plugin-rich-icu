import { describe, expect, it } from "vitest";
import { messageToImport } from "../src/icu-to-inlang.js";
import { bundleToMessageString } from "../src/inlang-to-icu.js";
import { richIcuPlugin } from "../src/plugin.js";

const imp = (source: string) => messageToImport({ source, bundleId: "m", locale: "fr" });
// biome-ignore lint/suspicious/noExplicitAny: test helper — dynamic inlang AST
const stringify = (a: any) =>
  bundleToMessageString({
    bundle: { id: "m", declarations: a.declarations },
    message: { selectors: a.selectors },
    variants: a.variants,
  });

describe("post-review fixes", () => {
  it("#1 selector INSIDE a markup tag — does not crash and preserves markup", () => {
    const a = imp("<b>{count, plural, one {# item} other {# items}}</b>");
    expect(a.variants).toHaveLength(2);
    // each variant is wrapped by <b>…</b>
    for (const v of a.variants) {
      expect(v.pattern[0]).toEqual({ type: "markup-start", name: "b" });
      expect(v.pattern.at(-1)).toEqual({ type: "markup-end", name: "b" });
    }
    expect(stringify(a)).toBe("{count, plural, one {<b># item</b>} other {<b># items</b>}}");
  });

  it("#2 number/date skeleton preserved (no [object Object])", () => {
    const num = imp("{price, number, ::currency/USD}");
    expect(num.variants[0].pattern[0].annotation.options[0].value.value).toBe("::currency/USD");
    expect(stringify(num)).toBe("{price, number, ::currency/USD}");

    const date = imp("{d, date, ::yyyyMMdd}");
    expect(date.variants[0].pattern[0].annotation.options[0].value.value).toBe("::yyyyMMdd");
    expect(stringify(date)).toBe("{d, date, ::yyyyMMdd}");

    // named style (plain string) unchanged
    const pct = imp("{v, number, percent}");
    expect(pct.variants[0].pattern[0].annotation.options[0].value.value).toBe("percent");
  });

  it("#3 declarations merged across locales — plural export not corrupted", async () => {
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

  it("#5 plural/select without `other` → throw", () => {
    expect(() => imp("{g, select, male {il}}")).toThrow();
    expect(() => imp("{count, plural, one {une pomme}}")).toThrow();
  });

  it("#6 literal in apostrophes resembling a tag — not corrupted", () => {
    const a = imp("'<br/>'");
    expect(a.variants[0].pattern.every((p: { type: string }) => p.type === "text")).toBe(true);
    expect(a.variants[0].pattern.map((p: { value: string }) => p.value).join("")).toBe("<br/>");
    // round-trip: remains text, never becomes a markup tag
    const b = imp(stringify(a));
    expect(b.variants[0].pattern.every((p: { type: string }) => p.type === "text")).toBe(true);
    expect(b.variants[0].pattern.map((p: { value: string }) => p.value).join("")).toBe("<br/>");
  });

  it("#7 sibling selectors — source order preserved (count outer, g inner)", () => {
    const a = imp(
      "{count, plural, one {# chat} other {# chats}} et {g, select, male {lui} other {eux}}",
    );
    expect(a.selectors.map((s: { name: string }) => s.name)).toEqual(["countPlural", "g"]);
    const str = stringify(a);
    expect(str.startsWith("{count, plural,")).toBe(true);
    // re-import: order stable
    const b = imp(str);
    expect(b.selectors.map((s: { name: string }) => s.name)).toEqual(["countPlural", "g"]);
  });

  it("#8 empty paired tag <b></b> → start + end (not standalone)", () => {
    expect(imp("<b></b>").variants[0].pattern).toEqual([
      { type: "markup-start", name: "b" },
      { type: "markup-end", name: "b" },
    ]);
  });

  it("#9 empty variants array → empty string (no crash)", () => {
    expect(
      bundleToMessageString({
        bundle: { id: "m", declarations: [] },
        message: { selectors: [] },
        variants: [],
      }),
    ).toBe("");
  });

  it("#10 literal '#' inside a select nested under a plural stays escaped", () => {
    // A select nested under a plural must keep `#` escaping (the plural context is
    // sticky); otherwise the literal `#` would re-parse as the plural count.
    const bundle = {
      id: "m",
      declarations: [
        { type: "input-variable", name: "count" },
        {
          type: "local-variable",
          name: "countPlural",
          value: {
            type: "expression",
            arg: { type: "variable-reference", name: "count" },
            annotation: { type: "function-reference", name: "plural", options: [] },
          },
        },
        { type: "input-variable", name: "g" },
      ],
    };
    const message = { selectors: [{ name: "countPlural" }, { name: "g" }] };
    const variants = [
      {
        matches: [
          { type: "catchall-match", key: "countPlural" },
          { type: "literal-match", key: "g", value: "male" },
        ],
        pattern: [{ type: "text", value: "a#b" }],
      },
      {
        matches: [
          { type: "catchall-match", key: "countPlural" },
          { type: "catchall-match", key: "g" },
        ],
        pattern: [{ type: "text", value: "x" }],
      },
    ];
    const str = bundleToMessageString({ bundle, message, variants });
    expect(str).toBe("{count, plural, other {{g, select, male {a'#'b} other {x}}}}");
  });
});
