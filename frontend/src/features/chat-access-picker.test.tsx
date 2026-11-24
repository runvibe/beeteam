import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { ChatAccessPicker } from "./chat-access-picker";
import { useChatAccess, useChatAccessSettings } from "@/state/chat-access";

beforeEach(async () => {
  await i18n.changeLanguage("en");
  useChatAccess.setState({ defaultMode: "standard", byChat: {} });
});

it("changes the access mode for only the selected chat", () => {
  render(<ChatAccessPicker chatId="first" />);
  fireEvent.click(
    screen.getByRole("button", { name: /access mode: standard/i }),
  );
  fireEvent.click(screen.getByRole("radio", { name: /read only/i }));
  expect(useChatAccess.getState().byChat.first).toBe("read_only");
  expect(useChatAccess.getState().byChat.second).toBeUndefined();
  expect(
    screen.getByRole("button", { name: /access mode: read only/i }),
  ).toBeInTheDocument();
});

it("requires confirmation before enabling full access", () => {
  const confirm = vi
    .spyOn(window, "confirm")
    .mockReturnValueOnce(false)
    .mockReturnValueOnce(true);
  render(<ChatAccessPicker chatId="first" />);
  fireEvent.click(
    screen.getByRole("button", { name: /access mode: standard/i }),
  );
  fireEvent.click(screen.getByRole("radio", { name: /^full access/i }));
  expect(useChatAccess.getState().byChat.first).toBeUndefined();
  fireEvent.click(screen.getByRole("radio", { name: /^full access/i }));
  expect(useChatAccess.getState().byChat.first).toBe("full_access");
  confirm.mockRestore();
});

it("moves a new chat's explicit choice to its created conversation", () => {
  const state = useChatAccess.getState();
  state.choose("draft:team:leader", "read_only");
  state.moveChoice("draft:team:leader", "conversation");
  expect(useChatAccess.getState().byChat.conversation).toBe("read_only");
  expect(useChatAccess.getState().byChat["draft:team:leader"]).toBeUndefined();
});

it("opens global settings from the access menu", () => {
  useChatAccessSettings.setState({ open: false });
  render(<ChatAccessPicker chatId="first" />);
  fireEvent.click(screen.getByRole("button", { name: /access mode: standard/i }));
  fireEvent.click(screen.getByRole("button", { name: /set default/i }));
  expect(useChatAccessSettings.getState().open).toBe(true);
});
