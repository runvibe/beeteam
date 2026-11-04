export type Locale = "en" | "pt";
export type LocalePreference = "auto" | Locale;
export const localeStorageKey = "bee-locale";
export function isPreference(value: unknown): value is LocalePreference {
  return value === "auto" || value === "en" || value === "pt";
}
export function resolveLocale(
  preference: LocalePreference,
  languages: readonly string[],
): Locale {
  if (preference !== "auto") return preference;
  return /^pt(?:-|$)/i.test(languages[0] ?? "") ? "pt" : "en";
}
export function readPreference(
  storage?: Pick<Storage, "getItem">,
): LocalePreference {
  try {
    const value = storage?.getItem(localeStorageKey);
    return isPreference(value) ? value : "auto";
  } catch {
    return "auto";
  }
}
export function browserLanguages(): readonly string[] {
  return typeof navigator === "undefined"
    ? []
    : navigator.languages?.length
      ? navigator.languages
      : [navigator.language];
}
export function browserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
