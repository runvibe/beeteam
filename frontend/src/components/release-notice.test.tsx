import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { setLocalePreference } from "@/i18n";
import { ReleaseNotice } from "./release-notice";

vi.mock("@/launch/public-manifest", () => ({
  usePublicManifest: () => ({ data: { appVersion: "1.2.4", artifacts: [] } }),
}));

it.each([
  ["pt", "Versão em uso: 1.2.3 · Versão disponível: 1.2.4"],
  ["en", "Current version: 1.2.3 · Available version: 1.2.4"],
] as const)("shows installed and available versions in %s", (locale, text) => {
  setLocalePreference(locale);
  render(<ReleaseNotice installedVersion="1.2.3" />);
  expect(screen.getByText(text)).toBeVisible();
});
