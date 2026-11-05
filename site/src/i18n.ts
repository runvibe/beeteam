import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { resources } from "./i18n/resources";
export const i18n = i18next.createInstance();
void i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en",
    fallbackLng: "en",
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
export function t(key: string, options?: Record<string, unknown>): string {
  return i18n.t(key, options);
}
export function locale() {
  return i18n.language === "pt" ? "pt-BR" : "en-US";
}
export function useLocale() {
  useTranslation(undefined, { i18n });
  return locale();
}
export function configureLocale(path: string) {
  const lang = path.startsWith("/pt/") || path === "/pt" ? "pt" : "en";
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
}
export function setLocalePreference(value: string) {
  if (typeof location === "undefined") return;
  try {
    localStorage.setItem("beeteam.locale", value);
  } catch {}
  const path = location.pathname.replace(/^\/pt(?=\/|$)/, "") || "/";
  location.assign(
    (value === "pt" ? "/pt" : "") + path + location.search + location.hash,
  );
}

export function message(key: string, options?: Record<string, unknown>) {
  return { key, options };
}
export class LocalizedError extends Error {}
