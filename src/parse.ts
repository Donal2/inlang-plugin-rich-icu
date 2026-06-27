import { type MessageFormatElement, TYPE, parse } from "@formatjs/icu-messageformat-parser";

/** Internal marker injected as the sole child of a self-closing `<tag/>`, so it can
 *  be told apart from an empty paired `<tag></tag>` after FormatJS parsing. */
export const SELF_CLOSE_MARK = String.fromCodePoint(0xe000);

const SELF_CLOSE_RE = /<([\w][\w-]*)\s*\/>/y;

/** Rewrite `<tag/>` to `<tag>{marker}</tag>`, while respecting ICU apostrophe-quoted
 *  literals (which must never be rewritten). */
function normalizeSelfClosingTags(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "'") {
      // '' = escaped literal apostrophe
      if (source[i + 1] === "'") {
        out += "''";
        i += 2;
        continue;
      }
      // an apostrophe before an ICU special char opens a quoted literal until the next '
      const next = source[i + 1];
      if (next === "{" || next === "}" || next === "<" || next === "#") {
        const end = source.indexOf("'", i + 1);
        if (end === -1) {
          out += source.slice(i);
          break;
        }
        out += source.slice(i, end + 1);
        i = end + 1;
        continue;
      }
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "<") {
      SELF_CLOSE_RE.lastIndex = i;
      const m = SELF_CLOSE_RE.exec(source);
      if (m) {
        out += `<${m[1]}>${SELF_CLOSE_MARK}</${m[1]}>`;
        i += m[0].length;
        continue;
      }
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Replace skeleton styles (FormatJS objects for `::...`) with their raw text,
 *  extracted via the location, so the skeleton survives the round-trip. */
// biome-ignore lint/suspicious/noExplicitAny: dynamic FormatJS ICU AST
function normalizeSkeletons(elements: any[], src: string): void {
  for (const el of elements) {
    if (
      (el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) &&
      el.style &&
      typeof el.style === "object"
    ) {
      const loc = el.style.location;
      el.style = loc ? src.slice(loc.start.offset, loc.end.offset) : String(el.style);
    }
    if (el.options) {
      for (const key of Object.keys(el.options)) normalizeSkeletons(el.options[key].value, src);
    }
    if (el.children) normalizeSkeletons(el.children, src);
  }
}

/** Parse an ICU MessageFormat 1 string into a FormatJS AST, with markup tags enabled. */
export function parseIcu(source: string): MessageFormatElement[] {
  const normalized = normalizeSelfClosingTags(source);
  const ast = parse(normalized, {
    ignoreTag: false,
    requiresOtherClause: true,
    captureLocation: true,
  });
  normalizeSkeletons(ast, normalized);
  return ast;
}
