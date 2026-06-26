import { describe, expect, it } from "vitest";
import { messageToImport } from "../src/icu-to-inlang.js";
import { markupPartToTag, markupStandalone, markupStart } from "../src/markup.js";

const imp = (source: string) =>
  messageToImport({ source, bundleId: "m", locale: "fr" }).variants[0].pattern;

describe("M2 import markup", () => {
  it("balise paire → markup-start + texte + markup-end", () => {
    expect(imp("a <b>x</b> c")).toEqual([
      { type: "text", value: "a " },
      { type: "markup-start", name: "b" },
      { type: "text", value: "x" },
      { type: "markup-end", name: "b" },
      { type: "text", value: " c" },
    ]);
  });

  it("balise auto-fermante → markup-standalone", () => {
    expect(imp("a<br/>b")).toEqual([
      { type: "text", value: "a" },
      { type: "markup-standalone", name: "br" },
      { type: "text", value: "b" },
    ]);
  });

  it("balises imbriquées", () => {
    expect(imp("<a><b>x</b></a>")).toEqual([
      { type: "markup-start", name: "a" },
      { type: "markup-start", name: "b" },
      { type: "text", value: "x" },
      { type: "markup-end", name: "b" },
      { type: "markup-end", name: "a" },
    ]);
  });

  it("balise enroulant # dans un plural", () => {
    const pat = messageToImport({
      source: "{c, plural, other {<b>#</b>}}",
      bundleId: "m",
      locale: "fr",
    }).variants[0].pattern;
    expect(pat).toEqual([
      { type: "markup-start", name: "b" },
      {
        type: "expression",
        arg: { type: "variable-reference", name: "c" },
        annotation: { type: "function-reference", name: "icu:pound", options: [] },
      },
      { type: "markup-end", name: "b" },
    ]);
  });

  it("constructeurs et sérialisation", () => {
    expect(markupStart("strong")).toEqual({ type: "markup-start", name: "strong" });
    expect(markupStandalone("br")).toEqual({ type: "markup-standalone", name: "br" });
    expect(markupPartToTag({ type: "markup-end", name: "b" })).toBe("</b>");
  });
});
