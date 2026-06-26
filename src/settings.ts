import { type Static, Type } from "@sinclair/typebox";

const pathPatternString = Type.String({
  pattern: ".*\\{locale\\}.*\\.json$",
  examples: ["./messages/{locale}.json"],
});

export const settingsSchema = Type.Object({
  pathPattern: Type.Union([pathPatternString, Type.Array(pathPatternString)], {
    title: "Path to language files",
    description: "Must include `{locale}` and end with `.json`.",
  }),
});

export type RichIcuSettings = Static<typeof settingsSchema>;
