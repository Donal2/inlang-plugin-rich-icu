import { describe, expect, it } from "vitest";
import { messageToImport } from "../src/icu-to-inlang.js";

describe("M4 errors", () => {
  it("malformed ICU → clear throw (never silently drops a tag)", () => {
    expect(() =>
      messageToImport({ source: "{count, plural, one {", bundleId: "m", locale: "fr" }),
    ).toThrow();
  });

  it("number skeleton passes without crash (deferred, never corrupted)", () => {
    const r = messageToImport({ source: "{v, number, percent}", bundleId: "m", locale: "fr" });
    const expr = r.variants[0].pattern[0];
    expect(expr.annotation.name).toBe("number");
    expect(expr.annotation.options).toContainEqual({
      name: "style",
      value: { type: "literal", value: "percent" },
    });
  });
});
