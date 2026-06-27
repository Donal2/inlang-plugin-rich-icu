import { type MessageFormatElement, TYPE, parse } from "@formatjs/icu-messageformat-parser";

/** Marqueur interne injecté comme unique enfant d'une balise <tag/> auto-fermante,
 *  pour la distinguer d'une paire vide <tag></tag> après parsing FormatJS. */
export const SELF_CLOSE_MARK = "";

const SELF_CLOSE_RE = /<([\w][\w-]*)\s*\/>/y;

/** Réécrit <tag/> en <tag>{marqueur}</tag>, en respectant les littéraux ICU
 *  entre apostrophes (qui ne doivent jamais être réécrits). */
function normalizeSelfClosingTags(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "'") {
      // '' = apostrophe littérale échappée
      if (source[i + 1] === "'") {
        out += "''";
        i += 2;
        continue;
      }
      // ' devant un caractère spécial ICU ouvre un littéral quoté jusqu'à la prochaine '
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

/** Remplace les styles skeleton (objets FormatJS pour `::...`) par leur texte
 *  brut, extrait via la location, pour préserver le skeleton au round-trip. */
// biome-ignore lint/suspicious/noExplicitAny: AST ICU FormatJS dynamique
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

/** Parse une chaîne ICU MessageFormat 1 en AST FormatJS, balises markup activées. */
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
