type MarkupType = "markup-start" | "markup-end" | "markup-standalone";
export interface MarkupPart {
  type: MarkupType;
  name: string;
}

export const markupStart = (name: string): MarkupPart => ({ type: "markup-start", name });
export const markupEnd = (name: string): MarkupPart => ({ type: "markup-end", name });
export const markupStandalone = (name: string): MarkupPart => ({ type: "markup-standalone", name });

/** Serialize a markup part back to its ICU tag. */
export function markupPartToTag(part: MarkupPart): string {
  switch (part.type) {
    case "markup-start":
      return `<${part.name}>`;
    case "markup-end":
      return `</${part.name}>`;
    case "markup-standalone":
      return `<${part.name}/>`;
  }
}
