// @ts-expect-error — plugin-icu1 does not necessarily expose types
import icu1 from "@inlang/plugin-icu1";
import { describe, expect, it } from "vitest";
import { richIcuPlugin } from "../src/plugin.js";
import { PLAIN } from "./fixtures/messages.js";

// biome-ignore lint/suspicious/noExplicitAny: test helper — settings shape varies across SDK versions
const settings: any = { baseLocale: "fr", locales: ["fr"] };

/** Normalize for comparison, ignoring generated ids. */
// biome-ignore lint/suspicious/noExplicitAny: test helper — normalizes dynamic AST returned by both plugins
function normalize(r: any) {
  return {
    // biome-ignore lint/suspicious/noExplicitAny: test helper — navigates dynamic AST
    bundles: r.bundles.map((b: any) => ({ id: b.id, declarations: b.declarations })),
    // biome-ignore lint/suspicious/noExplicitAny: test helper — navigates dynamic AST
    messages: r.messages.map((m: any) => ({
      bundleId: m.bundleId,
      locale: m.locale,
      selectors: m.selectors,
    })),
    // biome-ignore lint/suspicious/noExplicitAny: test helper — navigates dynamic AST
    variants: r.variants.map((v: any) => ({ matches: v.matches, pattern: v.pattern })),
  };
}

describe("M4 parity with @inlang/plugin-icu1 (markup-free corpus)", () => {
  for (const [key, source] of Object.entries(PLAIN)) {
    it(`same AST: ${key}`, () => {
      const files = [
        { locale: "fr", content: new TextEncoder().encode(JSON.stringify({ [key]: source })) },
      ];
      const importFiles = richIcuPlugin.importFiles;
      if (!importFiles) throw new Error("richIcuPlugin.importFiles is missing");
      // biome-ignore lint/suspicious/noExplicitAny: cast needed — our settings type is stricter than icu1's
      const ours = normalize(importFiles({ files, settings } as any));
      // biome-ignore lint/style/noNonNullAssertion: icu1 plugin always defines importFiles
      const theirs = normalize((icu1.default ?? icu1).importFiles!({ files, settings }));
      expect(ours).toEqual(theirs);
    });
  }
});
