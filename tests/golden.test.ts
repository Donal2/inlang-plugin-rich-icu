import { describe, expect, it } from "vitest";
import { messageToImport } from "../src/icu-to-inlang.js";
import { RICH } from "./fixtures/messages.js";

describe("M4 golden fixtures", () => {
  for (const [key, source] of Object.entries(RICH)) {
    it(`snapshot AST: ${key}`, () => {
      expect(messageToImport({ source, bundleId: key, locale: "fr" })).toMatchSnapshot();
    });
  }
});
