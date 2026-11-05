import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AnalyticsConsent } from "./consent-controls";
import { consentKey } from "./consent-store";
import { setLocalePreference } from "@/i18n";

beforeEach(() => localStorage.removeItem(consentKey));
afterEach(() => { localStorage.removeItem(consentKey); vi.restoreAllMocks(); });

it("rejects analytics without creating a network frame or gating the app", () => {
  const useApp = vi.fn();
  render(<><button onClick={useApp}>Use app</button><AnalyticsConsent product="app" legalReady /></>);
  expect(document.querySelector("iframe")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Use app" }));
  expect(useApp).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Rejeitar analytics" }));
  expect(document.querySelector("iframe")).toBeNull();
  expect(JSON.parse(localStorage.getItem(consentKey)!).analytics).toBe("rejected");
  expect(screen.getByRole("button", { name: "Preferências de cookies" })).toBeVisible();
});

it("waits for legal readiness and allows managing and withdrawing a prior choice", () => {
  const view = render(<AnalyticsConsent product="app" />);
  expect(screen.queryByRole("link", { name: "Aviso de privacidade" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Aceitar analytics" })).toBeNull();
  expect(localStorage.getItem(consentKey)).toBeNull();
  expect(document.querySelector("iframe")).toBeNull();
  view.rerender(<AnalyticsConsent product="app" legalReady />);
  fireEvent.click(screen.getByRole("button", { name: "Aceitar analytics" }));
  expect(document.querySelector("iframe")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Preferências de cookies" }));
  expect(screen.getByRole("checkbox")).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Retirar consentimento" }));
  expect(JSON.parse(localStorage.getItem(consentKey)!).analytics).toBe("rejected");
});

it("keeps core UI available when a consented metrics frame is blocked", () => {
  const useApp = vi.fn();
  render(<><button onClick={useApp}>Use app</button><AnalyticsConsent product="app" legalReady /></>);
  fireEvent.click(screen.getByRole("button", { name: "Aceitar analytics" }));
  expect(document.querySelector("iframe")?.src).toBe("https://metrics.getbee.team/analytics/frame.html");
  // No handshake arrives, as when an extension or browser blocks the frame.
  fireEvent.click(screen.getByRole("button", { name: "Use app" }));
  expect(useApp).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Preferências de cookies" }));
  fireEvent.click(screen.getByRole("button", { name: "Retirar consentimento" }));
  expect(document.querySelector("iframe")).toBeNull();
});

it.each([
  ["en", "Privacy notice", "Terms of use", ""],
  ["pt", "Aviso de privacidade", "Termos de uso", "/pt"],
] as const)("uses the published legal locale for %s", (language, privacy, terms, prefix) => {
  setLocalePreference(language);
  render(<AnalyticsConsent product="app" legalReady />);
  expect(screen.getByRole("link", { name: privacy })).toHaveAttribute("href", `https://getbee.team${prefix}/privacy`);
  expect(screen.getByRole("link", { name: terms })).toHaveAttribute("href", `https://getbee.team${prefix}/terms`);
});
