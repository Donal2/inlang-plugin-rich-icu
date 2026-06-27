import { describe, expect, it } from "vitest";
import { messageToImport } from "../src/icu-to-inlang.js";
import { markupPartToTag, markupStandalone, markupStart } from "../src/markup.js";

const imp = (source: string) =>
  messageToImport({ source, bundleId: "m", locale: "fr" }).variants[0].pattern;

describe("M2 import markup", () => {
  it("paired tag → markup-start + text + markup-end", () => {
    expect(imp("a <b>x</b> c")).toEqual([
      { type: "text", value: "a " },
      { type: "markup-start", name: "b" },
      { type: "text", value: "x" },
      { type: "markup-end", name: "b" },
      { type: "text", value: " c" },
    ]);
  });

  it("self-closing tag → markup-standalone", () => {
    expect(imp("a<br/>b")).toEqual([
      { type: "text", value: "a" },
      { type: "markup-standalone", name: "br" },
      { type: "text", value: "b" },
    ]);
  });

  it("nested tags", () => {
    expect(imp("<a><b>x</b></a>")).toEqual([
      { type: "markup-start", name: "a" },
      { type: "markup-start", name: "b" },
      { type: "text", value: "x" },
      { type: "markup-end", name: "b" },
      { type: "markup-end", name: "a" },
    ]);
  });

  it("tag wrapping # in a plural", () => {
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

  it("constructors and serialization", () => {
    expect(markupStart("strong")).toEqual({ type: "markup-start", name: "strong" });
    expect(markupStandalone("br")).toEqual({ type: "markup-standalone", name: "br" });
    expect(markupPartToTag({ type: "markup-end", name: "b" })).toBe("</b>");
  });
});
