import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { resources } from "./resources";
import {
  browserLanguages,
  browserStorage,
  isPreference,
  localeStorageKey,
  readPreference,
  resolveLocale,
  type LocalePreference,
} from "./preference";
export { localeStorageKey, resolveLocale, readPreference } from "./preference";
export type { LocalePreference, Locale } from "./preference";

let preference = readPreference(browserStorage());
export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  resources,
  lng: resolveLocale(preference, browserLanguages()),
  fallbackLng: "en",
  supportedLngs: ["en", "pt"],
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
  react: { useSuspense: false },
});
export function t(key: string, options?: Record<string, unknown>): string {
  if (!options) return i18n.t(key);
  // Keep count numeric for plural selection; format only its displayed replacement.
  const replace = Object.fromEntries(
    Object.entries(options).map(([name, value]) => [
      name,
      typeof value === "number" || typeof value === "bigint"
        ? formatNumber(value)
        : value,
    ]),
  );
  return i18n.t(key, { ...options, replace });
}
export function locale() {
  return i18n.resolvedLanguage === "pt" ? "pt-BR" : "en-US";
}
export function useLocale() {
  useTranslation(undefined, { i18n });
  return locale();
}
export function getLocalePreference() {
  return preference;
}
export function setLocalePreference(value: LocalePreference) {
  if (!isPreference(value)) return;
  preference = value;
  try {
    browserStorage()?.setItem(localeStorageKey, value);
  } catch {
    /* Session setting still applies. */
  }
  void i18n.changeLanguage(resolveLocale(value, browserLanguages()));
}
function documentLanguage() {
  if (typeof document !== "undefined") {
    document.documentElement.lang =
      i18n.resolvedLanguage === "pt" ? "pt" : "en";
    document.title = t("settings.documentTitle");
  }
}
i18n.on("languageChanged", documentLanguage);
documentLanguage();
if (typeof window !== "undefined") {
  window.addEventListener("languagechange", () => {
    if (preference === "auto")
      void i18n.changeLanguage(resolveLocale(preference, browserLanguages()));
  });
  window.addEventListener("storage", (event) => {
    if (event.key === localeStorageKey || event.key === null) {
      preference = readPreference(browserStorage());
      void i18n.changeLanguage(resolveLocale(preference, browserLanguages()));
    }
  });
}
/** Rebuild module-owned formatters lazily after a live language change. */
export function localeFormatter<T extends object>(
  create: (language: string) => T,
): T {
  let language = "",
    current: T;
  return new Proxy({} as T, {
    get(_target, key) {
      if (language !== locale()) {
        language = locale();
        current = create(language);
      }
      const value = Reflect.get(current, key, current);
      return typeof value === "function" ? value.bind(current) : value;
    },
  });
}
export interface LocalizedMessage {
  key: string;
  options?: Record<string, unknown>;
}
export function message(
  key: string,
  options?: Record<string, unknown>,
): LocalizedMessage {
  return { key, options };
}
/** Only application-authored messages carry keys. External/user content stays verbatim. */
export class LocalizedError extends Error {
  constructor(value: string | LocalizedMessage) {
    const render = () =>
      typeof value === "string" ? value : t(value.key, value.options);
    super(render());
    Object.defineProperty(this, "message", { configurable: true, get: render });
  }
}

export function formatNumber(value: number | bigint) {
  return new Intl.NumberFormat(locale()).format(value);
}
export function formatPercent(value: number) {
  return `${formatNumber(value)}%`;
}
