import type { InlangPlugin } from "@inlang/sdk";
import { messageToImport } from "./icu-to-inlang.js";
import { bundleToMessageString } from "./inlang-to-icu.js";
import { type RichIcuSettings, settingsSchema } from "./settings.js";

export const KEY = "plugin.donal2.richIcu";

type Settings = { [KEY]?: RichIcuSettings } & { baseLocale: string; locales: string[] };

function pathPatterns(settings: Settings): string[] {
  const p = settings[KEY]?.pathPattern ?? "./messages/{locale}.json";
  return Array.isArray(p) ? p : [p];
}

export const richIcuPlugin: InlangPlugin = {
  key: KEY,
  settingsSchema,

  toBeImportedFiles: async ({ settings }) => {
    const s = settings as unknown as Settings;
    return s.locales.flatMap((locale) =>
      pathPatterns(s).map((pattern) => ({ path: pattern.replace("{locale}", locale), locale })),
    );
  },

  importFiles: ({ files }) => {
    // biome-ignore lint/suspicious/noExplicitAny: M0 skeleton — proper types in Task 5
    const bundles: any[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: M0 skeleton — proper types in Task 5
    const messages: any[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: M0 skeleton — proper types in Task 5
    const variants: any[] = [];
    for (const file of files) {
      const json = JSON.parse(new TextDecoder("utf-8").decode(file.content));
      for (const [key, value] of Object.entries(json)) {
        if (key === "$schema" || typeof value !== "string") continue;
        const {
          declarations,
          selectors,
          variants: vs,
        } = messageToImport({
          source: value,
          bundleId: key,
          locale: file.locale,
        });
        if (!bundles.some((b) => b.id === key)) bundles.push({ id: key, declarations });
        messages.push({ bundleId: key, locale: file.locale, selectors });
        for (const v of vs) {
          variants.push({
            messageBundleId: key,
            messageLocale: file.locale,
            matches: v.matches,
            pattern: v.pattern,
          });
        }
      }
    }
    return { bundles, messages, variants };
  },

  exportFiles: ({ bundles, messages, variants, settings }) => {
    const s = settings as unknown as Settings;
    const byLocale: Record<string, Record<string, string>> = {};
    for (const message of messages) {
      const bundle = bundles.find((b) => b.id === message.bundleId);
      if (!bundle) continue;
      const vs = variants.filter((v) => v.messageId === message.id);
      if (!byLocale[message.locale]) byLocale[message.locale] = {};
      byLocale[message.locale][message.bundleId] = bundleToMessageString({
        bundle,
        message,
        variants: vs,
      });
    }
    const pattern = pathPatterns(s)[0];
    return Object.entries(byLocale).map(([locale, map]) => ({
      locale,
      name: pattern.replace("{locale}", locale).split("/").at(-1) ?? locale,
      content: new TextEncoder().encode(`${JSON.stringify(map, null, "\t")}\n`),
    }));
  },
};
