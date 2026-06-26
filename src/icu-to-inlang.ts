import { type MessageFormatElement, TYPE } from "@formatjs/icu-messageformat-parser";
import { markupEnd, markupStandalone, markupStart } from "./markup.js";
import { parseIcu } from "./parse.js";

export interface ImportedMessage {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic AST nodes — typed in §3 api-reference
  declarations: any[];
  // biome-ignore lint/suspicious/noExplicitAny: dynamic AST nodes — typed in §3 api-reference
  selectors: any[];
  // biome-ignore lint/suspicious/noExplicitAny: dynamic AST nodes — typed in §3 api-reference
  variants: Array<{ matches: any[]; pattern: any[] }>;
}

interface Ctx {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic AST nodes — typed in §3 api-reference
  declarations: Map<string, any>; // name -> declaration
  selectorNames: string[]; // ordre d'apparition, dédupliqué
}

const EXACT_RE = /^=-?(?:0|[1-9]\d*)(?:\.\d+)?$/;
const isExact = (k: string) => EXACT_RE.test(k);

export function messageToImport(args: {
  source: string;
  bundleId: string;
  locale: string;
}): ImportedMessage {
  const ast = parseIcu(args.source);
  const ctx: Ctx = { declarations: new Map(), selectorNames: [] };
  const variants = expand(ast, ctx, null);
  return {
    declarations: [...ctx.declarations.values()],
    selectors: ctx.selectorNames.map((name) => ({ type: "variable-reference", name })),
    variants,
  };
}

// biome-ignore lint/suspicious/noExplicitAny: dynamic AST nodes — typed in §3 api-reference
function addDecl(ctx: Ctx, decl: any) {
  if (!ctx.declarations.has(decl.name)) ctx.declarations.set(decl.name, decl);
}
function addSelectorName(ctx: Ctx, name: string) {
  if (!ctx.selectorNames.includes(name)) ctx.selectorNames.push(name);
}

/** Expansion cartésienne : trouve le 1er sélecteur, branche par case, recurse. */
function expand(
  elements: MessageFormatElement[],
  ctx: Ctx,
  poundArg: string | null,
  // biome-ignore lint/suspicious/noExplicitAny: dynamic AST nodes — typed in §3 api-reference
): Array<{ matches: any[]; pattern: any[] }> {
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (el.type === TYPE.plural || el.type === TYPE.select) {
      const beforeParts = mapSimpleList(elements.slice(0, i), ctx, poundArg);
      const afterVariants = expand(elements.slice(i + 1), ctx, poundArg);
      const sel = registerSelector(el, ctx);
      // biome-ignore lint/suspicious/noExplicitAny: dynamic AST nodes — typed in §3 api-reference
      const out: Array<{ matches: any[]; pattern: any[] }> = [];
      for (const caseKey of orderCases(el)) {
        const childPound = el.type === TYPE.plural ? el.value : poundArg;
        // biome-ignore lint/suspicious/noExplicitAny: FormatJS AST cast
        const caseVariants = expand((el as any).options[caseKey].value, ctx, childPound);
        const caseMatches = sel.matchesFor(caseKey);
        for (const cv of caseVariants) {
          for (const av of afterVariants) {
            out.push({
              matches: [...caseMatches, ...cv.matches, ...av.matches],
              pattern: [...beforeParts, ...cv.pattern, ...av.pattern],
            });
          }
        }
      }
      return out;
    }
  }
  return [{ matches: [], pattern: mapSimpleList(elements, ctx, poundArg) }];
}

// biome-ignore lint/suspicious/noExplicitAny: FormatJS AST — union type requires cast
function orderCases(el: any): string[] {
  const keys = Object.keys(el.options);
  const exacts = keys.filter(isExact);
  const cldr = keys.filter((k) => !isExact(k) && k !== "other");
  const other = keys.includes("other") ? ["other"] : [];
  return [...exacts, ...cldr, ...other];
}

// biome-ignore lint/suspicious/noExplicitAny: FormatJS AST — union type requires cast
function registerSelector(el: any, ctx: Ctx): { matchesFor: (c: string) => any[] } {
  const arg: string = el.value;
  if (el.type === TYPE.select) {
    addDecl(ctx, { type: "input-variable", name: arg });
    addSelectorName(ctx, arg);
    return {
      matchesFor: (c) =>
        c === "other"
          ? [{ type: "catchall-match", key: arg }]
          : [{ type: "literal-match", key: arg, value: c }],
    };
  }
  // plural | selectordinal
  const ordinal = el.pluralType === "ordinal";
  const offset: number = el.offset ?? 0;
  const word = ordinal ? "Ordinal" : "Plural";
  const pluralName = `${arg}${word}${offset ? `Offset${offset}` : ""}`;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic AST nodes — typed in §3 api-reference
  const options: any[] = [];
  if (ordinal) options.push({ name: "type", value: { type: "literal", value: "ordinal" } });
  if (offset) options.push({ name: "offset", value: { type: "literal", value: String(offset) } });
  addDecl(ctx, { type: "input-variable", name: arg });
  addDecl(ctx, {
    type: "local-variable",
    name: pluralName,
    value: {
      type: "expression",
      arg: { type: "variable-reference", name: arg },
      annotation: { type: "function-reference", name: "plural", options },
    },
  });
  addSelectorName(ctx, pluralName);

  const hasExact = Object.keys(el.options).some(isExact);
  let exactName: string | undefined;
  if (hasExact) {
    exactName = `${arg}Exact`;
    addDecl(ctx, {
      type: "local-variable",
      name: exactName,
      value: { type: "expression", arg: { type: "variable-reference", name: arg } },
    });
    addSelectorName(ctx, exactName);
  }

  return {
    matchesFor: (c) => {
      const exactCase = isExact(c);
      const isOther = c === "other";
      const pluralMatch =
        isOther || exactCase
          ? { type: "catchall-match", key: pluralName }
          : { type: "literal-match", key: pluralName, value: c };
      if (!exactName) return [pluralMatch];
      const exactMatch = exactCase
        ? { type: "literal-match", key: exactName, value: c.slice(1) }
        : { type: "catchall-match", key: exactName };
      return [exactMatch, pluralMatch];
    },
  };
}

// biome-ignore lint/suspicious/noExplicitAny: dynamic AST nodes — typed in §3 api-reference
function mapSimpleList(els: MessageFormatElement[], ctx: Ctx, poundArg: string | null): any[] {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic AST nodes — typed in §3 api-reference
  const parts: any[] = [];
  for (const el of els) parts.push(...mapSimple(el, ctx, poundArg));
  return parts;
}

// biome-ignore lint/suspicious/noExplicitAny: dynamic AST nodes — typed in §3 api-reference
function mapSimple(el: MessageFormatElement, ctx: Ctx, poundArg: string | null): any[] {
  switch (el.type) {
    case TYPE.literal:
      return [{ type: "text", value: el.value }];
    case TYPE.argument:
      addDecl(ctx, { type: "input-variable", name: el.value });
      return [{ type: "expression", arg: { type: "variable-reference", name: el.value } }];
    case TYPE.pound:
      return poundArg
        ? [
            {
              type: "expression",
              arg: { type: "variable-reference", name: poundArg },
              annotation: { type: "function-reference", name: "icu:pound", options: [] },
            },
          ]
        : [{ type: "text", value: "#" }];
    case TYPE.number:
    case TYPE.date:
    case TYPE.time: {
      // biome-ignore lint/suspicious/noExplicitAny: FormatJS AST — number/date/time nodes carry .value/.style
      const numEl = el as any;
      addDecl(ctx, { type: "input-variable", name: numEl.value });
      const fn = el.type === TYPE.number ? "number" : el.type === TYPE.date ? "date" : "time";
      const style = numEl.style;
      const options = style
        ? [{ name: "style", value: { type: "literal", value: String(style) } }]
        : [];
      return [
        {
          type: "expression",
          arg: { type: "variable-reference", name: numEl.value },
          annotation: { type: "function-reference", name: fn, options },
        },
      ];
    }
    case TYPE.tag: {
      // biome-ignore lint/suspicious/noExplicitAny: FormatJS AST cast — TagElement carries .value/.children
      const name = (el as any).value as string;
      // biome-ignore lint/suspicious/noExplicitAny: FormatJS AST cast — TagElement carries .value/.children
      const children = ((el as any).children ?? []) as MessageFormatElement[];
      if (children.length === 0) return [markupStandalone(name)];
      return [markupStart(name), ...mapSimpleList(children, ctx, poundArg), markupEnd(name)];
    }
    default:
      throw new Error(`mapSimple: type non géré ${el.type} (markup ajouté en Task 6)`);
  }
}
