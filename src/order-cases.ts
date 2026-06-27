/** Order plural/select case keys: exact matches first, then CLDR categories, then `other`. */
export function orderCaseKeys(keys: string[], isExact: (key: string) => boolean): string[] {
  const exacts = keys.filter(isExact);
  const cldr = keys.filter((k) => !isExact(k) && k !== "other");
  const other = keys.includes("other") ? ["other"] : [];
  return [...exacts, ...cldr, ...other];
}
