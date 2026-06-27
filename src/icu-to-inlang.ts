import { type MessageFormatElement, TYPE } from "@formatjs/icu-messageformat-parser";
import { markupEnd, markupStandalone, markupStart } from "./markup.js";
import { orderCaseKeys } from "./order-cases.js";
import { SELF_CLOSE_MARK, parseIcu } from "./parse.js";

export interface ImportedMessage {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
  declarations: any[];
  // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
  selectors: any[];
  // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
  variants: Array<{ matches: any[]; pattern: any[] }>;
}

interface Ctx {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
  declarations: Map<string, any>; // name -> declaration
  selectorNames: string[]; // order of appearance, deduplicated
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

// biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
function addDecl(ctx: Ctx, decl: any) {
  if (!ctx.declarations.has(decl.name)) ctx.declarations.set(decl.name, decl);
}
function addSelectorName(ctx: Ctx, name: string) {
  if (!ctx.selectorNames.includes(name)) ctx.selectorNames.push(name);
}

// biome-ignore lint/suspicious/noExplicitAny: inlang variant { matches, pattern }
type Variant = { matches: any[]; pattern: any[] };

/**
 * Left-to-right cartesian product: each element extends the current set of
 * variants. Selectors (plural/select) and markup tags may appear at any depth —
 * including a selector INSIDE a tag — and the source order of sibling selectors
 * is preserved.
 */
function expand(elements: MessageFormatElement[], ctx: Ctx, poundArg: string | null): Variant[] {
  let variants: Variant[] = [{ matches: [], pattern: [] }];
  for (const el of elements) {
    const next: Variant[] = [];
    for (const v of variants) {
      for (const ext of extendVariant(v, el, ctx, poundArg)) next.push(ext);
    }
    variants = next;
  }
  return variants;
}

function extendVariant(
  v: Variant,
  el: MessageFormatElement,
  ctx: Ctx,
  poundArg: string | null,
): Variant[] {
  if (el.type === TYPE.plural || el.type === TYPE.select) {
    const sel = registerSelector(el, ctx);
    const out: Variant[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: FormatJS AST cast
    for (const caseKey of orderCaseKeys(Object.keys((el as any).options), isExact)) {
      const childPound = el.type === TYPE.plural ? el.value : poundArg;
      const caseMatches = sel.matchesFor(caseKey);
      // biome-ignore lint/suspicious/noExplicitAny: FormatJS AST cast
      for (const cv of expand((el as any).options[caseKey].value, ctx, childPound)) {
        out.push({
          matches: [...v.matches, ...caseMatches, ...cv.matches],
          pattern: [...v.pattern, ...cv.pattern],
        });
      }
    }
    return out;
  }

  if (el.type === TYPE.tag) {
    // biome-ignore lint/suspicious/noExplicitAny: FormatJS AST — TagElement carries .value/.children
    const name = (el as any).value as string;
    // biome-ignore lint/suspicious/noExplicitAny: FormatJS AST — TagElement carries .value/.children
    const children = ((el as any).children ?? []) as MessageFormatElement[];
    if (isSelfClosing(children)) {
      return [{ matches: v.matches, pattern: [...v.pattern, markupStandalone(name)] }];
    }
    const out: Variant[] = [];
    for (const cv of expand(children, ctx, poundArg)) {
      out.push({
        matches: [...v.matches, ...cv.matches],
        pattern: [...v.pattern, markupStart(name), ...cv.pattern, markupEnd(name)],
      });
    }
    return out;
  }

  return [{ matches: v.matches, pattern: [...v.pattern, ...mapSimple(el, ctx, poundArg)] }];
}

function isSelfClosing(children: MessageFormatElement[]): boolean {
  return (
    children.length === 1 &&
    children[0].type === TYPE.literal &&
    // biome-ignore lint/suspicious/noExplicitAny: FormatJS literal carries .value
    (children[0] as any).value === SELF_CLOSE_MARK
  );
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
  // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
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

  // exactName = `${pluralName}Exact` (matches icu1 naming, e.g. countPluralExact)
  const hasExact = Object.keys(el.options).some(isExact);
  const exactName = hasExact ? `${pluralName}Exact` : undefined;
  if (exactName) {
    addDecl(ctx, {
      type: "local-variable",
      name: exactName,
      value: { type: "expression", arg: { type: "variable-reference", name: arg } },
    });
    // icu1 puts the exact selector FIRST, then the plural
    addSelectorName(ctx, exactName);
  }
  addSelectorName(ctx, pluralName);

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

// biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
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
      // biome-ignore lint/suspicious/noExplicitAny: FormatJS AST — number/date/time carry .value/.style
      const numEl = el as any;
      addDecl(ctx, { type: "input-variable", name: numEl.value });
      const fn = el.type === TYPE.number ? "number" : el.type === TYPE.date ? "date" : "time";
      // after normalizeSkeletons (parse.ts), style is always a string or undefined
      const style: string | undefined = numEl.style;
      const options = style ? [{ name: "style", value: { type: "literal", value: style } }] : [];
      return [
        {
          type: "expression",
          arg: { type: "variable-reference", name: numEl.value },
          annotation: { type: "function-reference", name: fn, options },
        },
      ];
    }
    default:
      throw new Error(`Unsupported ICU element type: ${el.type}`);
  }
}
