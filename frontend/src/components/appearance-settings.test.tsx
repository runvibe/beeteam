import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, afterEach } from "vitest";
import { AppearanceSettings } from "./appearance-settings";
import { themeController } from "@/state/theme-runtime";
import { setLocalePreference } from "@/i18n";
afterEach(() => {
  Reflect.deleteProperty(Element.prototype, "hasPointerCapture");
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  themeController.store.getState().setPreset("default");
});
it("changes palette without losing mode and provides system mode independently", async () => {
  Object.defineProperty(Element.prototype, "hasPointerCapture", {
    configurable: true,
    value: () => false,
  });
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
  setLocalePreference("en");
  themeController.store.getState().setPreference("dark");
  render(<AppearanceSettings />);
  await userEvent.click(
    screen.getByRole("combobox", { name: "Color palette" }),
  );
  await userEvent.click(screen.getByRole("option", { name: "Claude Code" }));
  expect(screen.getByRole("combobox", { name: "Color palette" })).toHaveFocus();
  expect(themeController.store.getState().preset).toBe("claude-code");
  expect(themeController.store.getState().preference).toBe("dark");
  await userEvent.click(screen.getByRole("combobox", { name: "Appearance" }));
  await userEvent.click(screen.getByRole("option", { name: "System" }));
  expect(themeController.store.getState().preference).toBe("system");
  expect(themeController.store.getState().preset).toBe("claude-code");
});
