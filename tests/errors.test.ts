import { describe, expect, it } from "vitest";
import { messageToImport } from "../src/icu-to-inlang.js";

describe("M4 erreurs", () => {
  it("ICU malformé → throw clair (jamais de tag silencieusement perdu)", () => {
    expect(() =>
      messageToImport({ source: "{count, plural, one {", bundleId: "m", locale: "fr" }),
    ).toThrow();
  });

  it("un skeleton number passe sans crash (déféré, jamais corrompu)", () => {
    const r = messageToImport({ source: "{v, number, percent}", bundleId: "m", locale: "fr" });
    const expr = r.variants[0].pattern[0];
    expect(expr.annotation.name).toBe("number");
    expect(expr.annotation.options).toContainEqual({
      name: "style",
      value: { type: "literal", value: "percent" },
    });
  });
});
