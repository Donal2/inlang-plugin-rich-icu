import { TYPE } from "@formatjs/icu-messageformat-parser";
import { parseIcu } from "./parse.js";

export interface ImportedMessage {
  declarations: unknown[];
  selectors: unknown[];
  variants: Array<{ matches: unknown[]; pattern: unknown[] }>;
}

export function messageToImport(args: {
  source: string;
  bundleId: string;
  locale: string;
}): ImportedMessage {
  const ast = parseIcu(args.source);
  const declarations: unknown[] = [];
  const seen = new Set<string>();
  const pattern: unknown[] = [];
  for (const el of ast) {
    if (el.type === TYPE.literal) {
      pattern.push({ type: "text", value: el.value });
    } else if (el.type === TYPE.argument) {
      if (!seen.has(el.value)) {
        seen.add(el.value);
        declarations.push({ type: "input-variable", name: el.value });
      }
      pattern.push({ type: "expression", arg: { type: "variable-reference", name: el.value } });
    } else {
      throw new Error(`M0: type de nœud non supporté (${el.type}) — matrice en Task 5`);
    }
  }
  return { declarations, selectors: [], variants: [{ matches: [], pattern }] };
}
