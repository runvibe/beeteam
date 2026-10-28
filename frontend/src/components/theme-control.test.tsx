import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect } from "vitest";
import { ThemeControl } from "./theme-control";
import { themeController } from "@/state/theme-runtime";
it("shows the next theme action and persists keyboard toggles", async () => {
  themeController.store.getState().setPreference("dark");
  render(<ThemeControl />);
  const user = userEvent.setup();
  const light = screen.getByRole("button", {name:"Ativar tema claro"});
  expect(light.textContent).toBe("");
  light.focus();
  await user.keyboard("{Enter}");
  expect(screen.getByRole("button", {name:"Ativar tema escuro"})).toBeVisible();
  expect(localStorage.getItem("beeteam.theme")).toBe("light");
  await user.keyboard(" ");
  expect(screen.getByRole("button", {name:"Ativar tema claro"})).toBeVisible();
  expect(localStorage.getItem("beeteam.theme")).toBe("dark");
});
