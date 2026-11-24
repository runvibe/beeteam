import { render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids } from "@/api/seed";
import type { ManagedAgentApi } from "@/api/managed-agents";
import { setLocalePreference } from "@/i18n";
import { useChatPanel } from "@/state/chat-panel";

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

it("offers managed execution settings on an agent without replacing external chat references", async () => {
  setLocalePreference("en");
  useChatPanel.setState({ open: false, teamId: null, picking: false });
  const managedAgents = {
    config: vi
      .fn()
      .mockResolvedValue({
        agentId: ids.agent,
        version: 1,
        configuration: null,
      }),
    conversations: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  } as unknown as ManagedAgentApi;
  const api = { ...createMockApi({ delay: 0 }), managedAgents };
  window.history.replaceState({}, "", `/agents/${ids.agent}?agent.tab=chats`);
  render(
    <ApiProvider api={api}>
      <App />
    </ApiProvider>,
  );

  const panel = await screen.findByRole("tabpanel");
  expect(
    await within(panel).findByRole("heading", { name: "Managed execution" }),
  ).toBeVisible();
  expect(
    within(panel).getByRole("button", { name: "Configure agent" }),
  ).toBeVisible();
  expect(
    within(panel).queryByRole("textbox", { name: "Message to agent" }),
  ).toBeNull();
  expect(within(panel).getByText(/external references/i)).toBeVisible();
  expect(
    within(panel).getByText("No managed conversations yet."),
  ).toBeVisible();
  expect(managedAgents.config).toHaveBeenCalledWith(ids.agent);
});
