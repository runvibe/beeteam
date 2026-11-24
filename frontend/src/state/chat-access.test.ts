import { beforeEach, expect, it } from "vitest";
import { useChatAccess } from "./chat-access";

beforeEach(() => {
  localStorage.removeItem("beeteam-chat-access");
  useChatAccess.setState({ defaultMode: "standard", byChat: {} });
});

it("restores the default and each chat's explicit choice after rehydration", async () => {
  useChatAccess.getState().setDefault("codex_config");
  useChatAccess.getState().choose("chat-1", "read_only");
  const saved = localStorage.getItem("beeteam-chat-access");
  useChatAccess.setState({ defaultMode: "standard", byChat: {} });
  localStorage.setItem("beeteam-chat-access", saved!);
  await useChatAccess.persist.rehydrate();
  expect(useChatAccess.getState().defaultMode).toBe("codex_config");
  expect(useChatAccess.getState().byChat["chat-1"]).toBe("read_only");
});
