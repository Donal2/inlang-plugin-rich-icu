import { type MarkupPart, markupPartToTag } from "./markup.js";
import { orderCaseKeys } from "./order-cases.js";

export function bundleToMessageString(args: {
  bundle: { id: string; declarations: unknown[] };
  message: { selectors: Array<{ name: string }> };
  variants: Array<{ matches: unknown[]; pattern: unknown[] }>;
}): string {
  const { bundle, message, variants } = args;
  if (variants.length === 0) return "";
  if (message.selectors.length === 0) return patternToString(variants[0].pattern, false);
  const icuSelectors = resolveIcuSelectors(message, bundle);
  return reconstruct(icuSelectors, variants, false);
}

interface IcuSelector {
  arg: string;
  kind: "plural" | "selectordinal" | "select";
  offset: number;
  pluralKey?: string;
  exactKey?: string;
  selectKey?: string;
}

// biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
function declMap(bundle: { declarations: unknown[] }): Map<string, any> {
  // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
  return new Map((bundle.declarations as any[]).map((d: any) => [d.name, d]));
}

function resolveIcuSelectors(
  message: { selectors: Array<{ name: string }> },
  bundle: { declarations: unknown[] },
): IcuSelector[] {
  const decls = declMap(bundle);
  const names = message.selectors.map((s) => s.name);
  const consumed = new Set<string>();
  const out: IcuSelector[] = [];

  // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
  function resolvePlural(pluralDecl: any, pluralKey: string, exactKey: string | undefined): void {
    const arg: string = pluralDecl.value.arg.name;
    const ordinal = pluralDecl.value.annotation.options?.some(
      // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
      (o: any) => o.name === "type" && o.value.value === "ordinal",
    );
    const offset: number = Number(
      // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
      pluralDecl.value.annotation.options?.find((o: any) => o.name === "offset")?.value.value ?? 0,
    );
    out.push({ arg, kind: ordinal ? "selectordinal" : "plural", offset, pluralKey, exactKey });
  }

  for (const name of names) {
    if (consumed.has(name)) continue;
    // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
    const decl: any = decls.get(name);
    const isPlural = decl?.type === "local-variable" && decl.value?.annotation?.name === "plural";
    // exact companion: local-variable with same-arg expression, no annotation
    const isExactCompanion =
      decl?.type === "local-variable" && decl.value && !decl.value.annotation;

    if (isPlural) {
      // Look for an exact companion (any remaining selector that is a no-annotation
      // local-variable with the same arg). Handles both plural-first and exact-first order.
      const arg: string = decl.value.arg.name;
      const exactKey = names.find((n) => {
        if (consumed.has(n) || n === name) return false;
        // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
        const d: any = decls.get(n);
        return d?.type === "local-variable" && d.value?.arg?.name === arg && !d.value?.annotation;
      });
      if (exactKey) consumed.add(exactKey);
      resolvePlural(decl, name, exactKey);
    } else if (isExactCompanion) {
      // Exact comes before plural in selectors (icu1 ordering). Find the plural companion.
      const arg: string = decl.value.arg.name;
      const pluralKey = names.find((n) => {
        if (consumed.has(n) || n === name) return false;
        // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
        const d: any = decls.get(n);
        return (
          d?.type === "local-variable" &&
          d.value?.annotation?.name === "plural" &&
          d.value?.arg?.name === arg
        );
      });
      if (pluralKey) {
        consumed.add(pluralKey);
        // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
        resolvePlural(decls.get(pluralKey) as any, pluralKey, name);
      } else {
        // Standalone (no plural companion) — treat as select
        out.push({ arg: name, kind: "select", offset: 0, selectKey: name });
      }
    } else {
      out.push({ arg: name, kind: "select", offset: 0, selectKey: name });
    }
  }
  return out;
}

// biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
function caseFor(sel: IcuSelector, matches: any[]): string {
  if (sel.kind === "select") {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
    const m = matches.find((x: any) => x.key === sel.selectKey);
    return m?.type === "literal-match" ? (m.value as string) : "other";
  }
  // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
  const exact = sel.exactKey ? matches.find((x: any) => x.key === sel.exactKey) : undefined;
  if (exact?.type === "literal-match") return `=${exact.value as string}`;
  // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
  const plural = matches.find((x: any) => x.key === sel.pluralKey);
  return plural?.type === "literal-match" ? (plural.value as string) : "other";
}

function reconstruct(
  selectors: IcuSelector[],
  variants: Array<{ matches: unknown[]; pattern: unknown[] }>,
  ancestorInPlural: boolean,
): string {
  const [sel, ...rest] = selectors;
  // `#` is literal text only when no ancestor selector is a plural; keep this sticky
  // across nesting levels so a select nested under a plural still escapes literal `#`.
  const inPlural = ancestorInPlural || sel.kind !== "select";
  const groups = new Map<string, Array<{ matches: unknown[]; pattern: unknown[] }>>();
  for (const v of variants) {
    // biome-ignore lint/suspicious/noExplicitAny: dynamic inlang AST
    const c = caseFor(sel, v.matches as any[]);
    let group = groups.get(c);
    if (!group) {
      group = [];
      groups.set(c, group);
    }
    group.push(v);
  }
  const offsetStr = sel.offset ? `offset:${sel.offset} ` : "";
  const head = `${sel.arg}, ${sel.kind}, ${offsetStr}`;
  const body = orderCaseKeys([...groups.keys()], (k) => k.startsWith("="))
    .map((c) => {
      const grp = groups.get(c) ?? [];
      const inner =
        rest.length === 0
          ? patternToString(grp[0].pattern, inPlural)
          : reconstruct(rest, grp, inPlural);
      return `${c} {${inner}}`;
    })
    .join(" ");
  return `{${head}${body}}`;
}

export function patternToString(pattern: unknown[], inPlural: boolean): string {
  return pattern
    .map((part) => {
      const p = part as {
        type: string;
        value?: string;
        name?: string;
        arg?: { name?: string; value?: string };
        annotation?: {
          name?: string;
          options?: Array<{ name: string; value: { value?: string } }>;
        };
      };
      switch (p.type) {
        case "text":
          return escapeText(p.value ?? "", inPlural);
        case "expression":
          return expressionToString(p);
        case "markup-start":
        case "markup-end":
        case "markup-standalone":
          return markupPartToTag(p as unknown as MarkupPart);
        default:
          throw new Error(`Unknown pattern part: ${p.type}`);
      }
    })
    .join("");
}

function expressionToString(expr: {
  arg?: { name?: string; value?: string };
  annotation?: { name?: string; options?: Array<{ name: string; value: { value?: string } }> };
}): string {
  const ann = expr.annotation;
  if (ann?.name === "icu:pound") return "#";
  const name = expr.arg?.name ?? expr.arg?.value;
  if (!ann) return `{${name}}`;
  const style = ann.options?.find((o) => o.name === "style")?.value?.value;
  return style ? `{${name}, ${ann.name}, ${style}}` : `{${name}, ${ann.name}}`;
}

function escapeText(s: string, inPlural: boolean): string {
  let out = s.replace(/'/g, "''");
  // `<` must be quoted so it is not re-parsed as a markup tag on round-trip
  out = out.replace(inPlural ? /[{}#<]/g : /[{}<]/g, (m) => `'${m}'`);
  return out;
}
