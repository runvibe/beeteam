import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { useChatAccess } from "@/state/chat-access";
import { ChatAccessSettings } from "./chat-access-settings";

beforeEach(async () => {
  Object.defineProperty(Element.prototype, "hasPointerCapture", { configurable: true, value: () => false });
  Object.defineProperty(Element.prototype, "scrollIntoView", { configurable: true, value: () => {} });
  await i18n.changeLanguage("en");
  useChatAccess.setState({
    defaultMode: "standard",
    byChat: { existing: "read_only" },
  });
});

it("sets the default without changing an existing chat choice", async () => {
  render(<ChatAccessSettings />);
  await userEvent.click(screen.getByRole("combobox", { name: "Default chat access" }));
  await userEvent.click(screen.getByRole("option", { name: "Codex configuration" }));
  expect(useChatAccess.getState().defaultMode).toBe("codex_config");
  expect(useChatAccess.getState().byChat.existing).toBe("read_only");
});

it("asks before making full access the default", async () => {
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<ChatAccessSettings />);
  await userEvent.click(screen.getByRole("combobox", { name: "Default chat access" }));
  await userEvent.click(screen.getByRole("option", { name: "Full access" }));
  expect(useChatAccess.getState().defaultMode).toBe("standard");
  confirm.mockRestore();
});
