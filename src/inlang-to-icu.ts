export function bundleToMessageString(args: {
  bundle: unknown;
  message: { selectors: unknown[] };
  variants: Array<{ pattern: unknown[] }>;
}): string {
  if (args.message.selectors.length === 0) return patternToString(args.variants[0].pattern, false);
  throw new Error("M0: export avec sélecteurs — Task 7");
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
          return `<${p.name}>`;
        case "markup-end":
          return `</${p.name}>`;
        case "markup-standalone":
          return `<${p.name}/>`;
        default:
          throw new Error(`part inconnue: ${p.type}`);
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
  out = out.replace(inPlural ? /[{}#]/g : /[{}]/g, (m) => `'${m}'`);
  return out;
}
