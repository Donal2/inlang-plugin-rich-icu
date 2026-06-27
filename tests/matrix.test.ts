import { describe, expect, it } from "vitest";
import { messageToImport } from "../src/icu-to-inlang.js";

const imp = (source: string) => messageToImport({ source, bundleId: "m", locale: "fr" });

describe("M1 matrix", () => {
  it("plural cardinal → local-variable plural + 2 variants", () => {
    const r = imp("{count, plural, one {# pomme} other {# pommes}}");
    expect(r.selectors).toEqual([{ type: "variable-reference", name: "countPlural" }]);
    expect(r.declarations).toContainEqual({
      type: "local-variable",
      name: "countPlural",
      value: {
        type: "expression",
        arg: { type: "variable-reference", name: "count" },
        annotation: { type: "function-reference", name: "plural", options: [] },
      },
    });
    expect(r.variants).toHaveLength(2);
    expect(r.variants[0].matches).toEqual([
      { type: "literal-match", key: "countPlural", value: "one" },
    ]);
    expect(r.variants[1].matches).toEqual([{ type: "catchall-match", key: "countPlural" }]);
  });

  it("# in a plural → icu:pound expression on the arg", () => {
    const r = imp("{count, plural, other {#}}");
    expect(r.variants[0].pattern).toEqual([
      {
        type: "expression",
        arg: { type: "variable-reference", name: "count" },
        annotation: { type: "function-reference", name: "icu:pound", options: [] },
      },
    ]);
  });

  it("selectordinal → type:ordinal option, Ordinal name", () => {
    const r = imp("{n, selectordinal, one {#er} other {#e}}");
    expect(r.selectors[0].name).toBe("nOrdinal");
    // biome-ignore lint/suspicious/noExplicitAny: test helper — navigates dynamic AST
    const decl = r.declarations.find((d: any) => d.name === "nOrdinal");
    expect(decl.value.annotation.options).toContainEqual({
      name: "type",
      value: { type: "literal", value: "ordinal" },
    });
  });

  it("offset:2 → option offset", () => {
    const r = imp("{count, plural, offset:2 other {#}}");
    expect(r.selectors[0].name).toBe("countPluralOffset2");
    // biome-ignore lint/suspicious/noExplicitAny: test helper — navigates dynamic AST
    const decl = r.declarations.find((d: any) => d.name === "countPluralOffset2");
    expect(decl.value.annotation.options).toContainEqual({
      name: "offset",
      value: { type: "literal", value: "2" },
    });
  });

  it("=0 exact → Exact selector FIRST + combined matches (icu1 parity)", () => {
    const r = imp("{count, plural, =0 {rien} one {#} other {#}}");
    // icu1: exact selector first, plural selector second; exact name = `${pluralName}Exact`
    // biome-ignore lint/suspicious/noExplicitAny: test helper — navigates dynamic AST
    expect(r.selectors.map((s: any) => s.name)).toEqual(["countPluralExact", "countPlural"]);
    // biome-ignore lint/suspicious/noExplicitAny: test helper — navigates dynamic AST
    const v0 = r.variants.find((v: any) =>
      v.matches.some(
        // biome-ignore lint/suspicious/noExplicitAny: test helper — navigates dynamic AST
        (m: any) => m.type === "literal-match" && m.key === "countPluralExact" && m.value === "0",
      ),
    );
    // biome-ignore lint/style/noNonNullAssertion: v0 guaranteed to exist by preceding assertion logic
    expect(v0!.matches).toEqual([
      { type: "literal-match", key: "countPluralExact", value: "0" },
      { type: "catchall-match", key: "countPlural" },
    ]);
  });

  it("select gender", () => {
    const r = imp("{g, select, male {il} female {elle} other {iel}}");
    expect(r.selectors).toEqual([{ type: "variable-reference", name: "g" }]);
    expect(r.declarations).toContainEqual({ type: "input-variable", name: "g" });
    expect(r.variants).toHaveLength(3);
  });
});
