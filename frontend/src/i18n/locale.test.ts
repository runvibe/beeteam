import { afterEach, describe, expect, it, vi } from "vitest";
import {
  i18n,
  t,
  locale,
  formatNumber,
  readPreference,
  resolveLocale,
  setLocalePreference,
  getLocalePreference,
  localeStorageKey,
} from "./index";
import { browserStorage } from "./preference";
import { tokenCount } from "@/features/usage-format";
import { formatAttachmentSize } from "@/features/attachment-presentation";
import { categories } from "@/features/attachment-item";
import { modeLabels } from "@/components/shared";
import { eventLabels } from "@/features/timeline-labels";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("locale resolution", () => {
  it.each(["pt", "pt-BR", "pt-PT", "pt-AO", "PT-br"])(
    "detects Portuguese dialect %s",
    (language) => {
      expect(resolveLocale("auto", [language])).toBe("pt");
    },
  );
  it.each([
    { languages: [] },
    { languages: ["en-US"] },
    { languages: ["es", "pt-BR"] },
    { languages: ["ptx"] },
  ])("uses English fallback for %j", ({ languages }) => {
    expect(resolveLocale("auto", languages)).toBe("en");
  });
  it("gives a persisted explicit setting priority over browser language", () => {
    expect(resolveLocale("en", ["pt-BR"])).toBe("en");
    expect(resolveLocale("pt", ["en"])).toBe("pt");
    for (const preference of ["auto", "en", "pt"] as const) {
      expect(readPreference({ getItem: () => preference })).toBe(preference);
    }
  });
  it("tolerates absent, invalid and unavailable storage", () => {
    expect(readPreference()).toBe("auto");
    expect(readPreference({ getItem: () => null })).toBe("auto");
    expect(readPreference({ getItem: () => '{"language":"pt"}' })).toBe("auto");
    expect(readPreference({ getItem: () => "es" })).toBe("auto");
    expect(
      readPreference({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).toBe("auto");
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(browserStorage()).toBeUndefined();
    expect(() => setLocalePreference("en")).not.toThrow();
    expect(locale()).toBe("en-US");
  });
  it("keeps the session choice when persistence fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => setLocalePreference("en")).not.toThrow();
    expect(getLocalePreference()).toBe("en");
    expect(t("settings.language")).toBe("Language");
  });
  it("follows browser changes only in automatic mode", () => {
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["pt-PT"]);
    setLocalePreference("en");
    window.dispatchEvent(new Event("languagechange"));
    expect(locale()).toBe("en-US");
    setLocalePreference("auto");
    expect(locale()).toBe("pt-BR");
    vi.spyOn(navigator, "languages", "get").mockReturnValue(["fr"]);
    window.dispatchEvent(new Event("languagechange"));
    expect(locale()).toBe("en-US");
    expect(localStorage.getItem(localeStorageKey)).toBe("auto");
  });
});
it("uses English when a Portuguese key is unavailable", () => {
  i18n.addResource("en", "translation", "__fallbackTest", "English fallback");
  try {
    expect(t("__fallbackTest", { lng: "pt" })).toBe("English fallback");
  } finally {
    delete (i18n.store.data.en.translation as Record<string, unknown>)
      .__fallbackTest;
  }
});
it("formats huge counters without losing precision and refreshes helpers/constants", () => {
  const huge = "9007199254740993123456789";
  setLocalePreference("en");
  expect(tokenCount(huge)).toBe("9,007,199,254,740,993,123,456,789");
  expect(formatNumber(1234.5)).toBe("1,234.5");
  expect(formatAttachmentSize(1200)).toBe("1.2 KB");
  expect(categories.image.label).toBe("Image");
  expect(modeLabels.standard).toBe("Standard");
  expect(eventLabels["task.created"]).toBe("Task created");
  setLocalePreference("pt");
  expect(tokenCount(huge)).toBe("9.007.199.254.740.993.123.456.789");
  expect(formatNumber(1234.5)).toBe("1.234,5");
  expect(formatAttachmentSize(1200)).toBe("1,2 KB");
  expect(categories.image.label).toBe("Imagem");
  expect(modeLabels.standard).toBe("Padrão");
  expect(eventLabels["task.created"]).toBe("Task criada");
});
it("supports grammatical plural and numeric interpolation", () => {
  setLocalePreference("en");
  expect(
    t("teams.collaborators", { count: 1, name: "Equipe do usuário" }),
  ).toBe("1 collaborator in team Equipe do usuário");
  expect(
    t("teams.collaborators", { count: 1000, name: "Equipe do usuário" }),
  ).toBe("1,000 collaborators in team Equipe do usuário");
  setLocalePreference("pt");
  expect(t("teams.collaborators", { count: 0, name: "My team" })).toBe(
    "0 colaboradores do time My team",
  );
  expect(t("teams.collaborators", { count: 1, name: "My team" })).toBe(
    "1 colaborador do time My team",
  );
});
