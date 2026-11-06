import { fireEvent, render, waitFor, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { setLocalePreference } from "@/i18n";
import { ReleaseNotice } from "./release-notice";

vi.mock("@/launch/public-manifest", () => ({
  usePublicManifest: () => ({ data: { appVersion: "1.2.4", artifacts: [] } }),
}));

it.each([
  ["pt", "Versão em uso: 1.2.3 · Versão disponível: 1.2.4"],
  ["en", "Current version: 1.2.3 · Available version: 1.2.4"],
] as const)("shows installed and available versions in %s", async (locale, text) => {
  setLocalePreference(locale);
  render(<ReleaseNotice installedVersion="1.2.3" />);
  expect(screen.queryByText(text)).toBeNull();
  fireEvent.click(screen.getByRole("button"));
  await waitFor(() => expect(screen.getByText(text)).toBeVisible());
});

it("confirms a successful copy inside the button and replays on another click", async () => {
  setLocalePreference("en");
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<ReleaseNotice installedVersion="1.2.3" />);
  fireEvent.click(screen.getByRole("button"));
  const button = await screen.findByRole("button", { name: "Copy request" });
  fireEvent.click(button);
  await waitFor(() => expect(button).toHaveTextContent("Prompt copied."));
  const first = button.querySelector("svg");
  expect(first).toHaveAttribute("stroke-width", "1.15");
  fireEvent.click(button);
  await waitFor(() => expect(button.querySelector("svg")).not.toBe(first));
  expect(writeText).toHaveBeenCalledTimes(2);
});
