import { type MessageFormatElement, parse } from "@formatjs/icu-messageformat-parser";

/** Parse une chaîne ICU MessageFormat 1 en AST FormatJS, balises markup activées. */
export function parseIcu(source: string): MessageFormatElement[] {
  return parse(source, { ignoreTag: false, requiresOtherClause: false });
}
