import { type MessageFormatElement, parse } from "@formatjs/icu-messageformat-parser";

/** Parse une chaîne ICU MessageFormat 1 en AST FormatJS, balises markup activées. */
export function parseIcu(source: string): MessageFormatElement[] {
  // FormatJS ne reconnaît pas <tag/> comme nœud tag — on normalise en <tag></tag>.
  const normalized = source.replace(/<([\w][\w-]*)\s*\/>/g, "<$1></$1>");
  return parse(normalized, { ignoreTag: false, requiresOtherClause: false });
}
