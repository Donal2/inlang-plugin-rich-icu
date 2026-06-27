import { describe, expect, it } from "vitest";
import { messageToImport } from "../src/icu-to-inlang.js";
import { bundleToMessageString } from "../src/inlang-to-icu.js";

function roundtrip(source: string) {
  const a = messageToImport({ source, bundleId: "m", locale: "fr" });
  const bundle = { id: "m", declarations: a.declarations };
  const message = { id: "m", bundleId: "m", locale: "fr", selectors: a.selectors };
  const variants = a.variants.map((v, i) => ({ id: `v${i}`, messageId: "m", ...v }));
  const str = bundleToMessageString({ bundle, message, variants });
  const b = messageToImport({ source: str, bundleId: "m", locale: "fr" });
  return { str, a, b };
}

describe("M3 round-trip (import→export→import idempotent)", () => {
  for (const src of [
    "Hello {name}.",
    "{count, plural, one {# apple} other {# apples}}",
    "{count, plural, =0 {none} one {#} other {#}}",
    "{count, plural, offset:1 other {#}}",
    "{n, selectordinal, one {#st} other {#th}}",
    "{g, select, male {he} female {she} other {they}}",
    "You have <strong># credit</strong> left.",
    "{count, plural, one {<strong># CV</strong>} other {<strong># CVs</strong>}}",
  ]) {
    it(`idempotent: ${src}`, () => {
      const { a, b } = roundtrip(src);
      expect(b.declarations).toEqual(a.declarations);
      expect(b.selectors).toEqual(a.selectors);
      expect(b.variants).toEqual(a.variants);
    });
  }
});
