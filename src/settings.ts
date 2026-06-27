import { type Static, Type } from "@sinclair/typebox";

export const settingsSchema = Type.Object({
  pathPattern: Type.String({
    pattern: ".*\\{locale\\}.*\\.json$",
    examples: ["./messages/{locale}.json"],
    title: "Path to language files",
    description: "Must include `{locale}` and end with `.json`.",
  }),
});

export type RichIcuSettings = Static<typeof settingsSchema>;
