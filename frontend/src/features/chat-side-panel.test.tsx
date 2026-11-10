import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { useChatPanel } from "@/state/chat-panel";
import { setLocalePreference } from "@/i18n";
import { ChatWorkspace, ChatPanelToggle } from "./chat-side-panel";

vi.mock("@/api/context", () => ({
  useApi: () => ({
    list: async () => ({
      items: [{ id: "team-a", name: "Team A" }],
      total: 1,
      offset: 0,
      limit: 20,
    }),
  }),
  useEntity: (resource: string) => ({
    data:
      resource === "teams"
        ? { name: "Team A", leaderId: "leader" }
        : { version: 1 },
  }),
}));
vi.mock("@/components/shared", () => ({
  QueryState: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("./leader-chat", () => ({
  LeaderChat: () => <textarea aria-label="Draft" defaultValue="" />,
}));

it("preserves mounted chat draft through navigation, side change and collapse", async () => {
  setLocalePreference("en");
  useChatPanel.getState().openTeam("team-a");
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={client}>
      <ChatWorkspace>
        <main>Boards</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  const draft = screen.getByRole("textbox", { name: "Draft" });
  await userEvent.type(draft, "Keep my draft");
  act(() => useChatPanel.getState().setSide("left"));
  view.rerender(
    <QueryClientProvider client={client}>
      <ChatWorkspace>
        <main>Tasks</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  expect(screen.getByRole("textbox", { name: "Draft" })).toBe(draft);
  await userEvent.click(
    screen.getByRole("button", { name: "Close chat panel" }),
  );
  expect(screen.queryByRole("textbox", { name: "Draft" })).toBeNull();
  act(() => useChatPanel.getState().openTeam("team-a"));
  expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue(
    "Keep my draft",
  );
});

it("opens chat without a previously selected team", async () => {
  setLocalePreference("en");
  useChatPanel.setState({ teamId: null, open: false });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChatPanelToggle />
      <ChatWorkspace>
        <main>Agent details</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Chat with the leader" }),
  );
  await userEvent.click(await screen.findByRole("button", { name: "Team A" }));
  expect(screen.getByRole("textbox", { name: "Draft" })).toBeVisible();
});
it("restores the selected team and panel visibility after reload", async () => {
  useChatPanel.getState().openTeam("team-a");
  const saved = localStorage.getItem("beeteam-chat-panel");
  expect(JSON.parse(saved!).state).toMatchObject({
    teamId: "team-a",
    open: true,
  });
  act(() => useChatPanel.setState({ teamId: null, open: false }));
  localStorage.setItem("beeteam-chat-panel", saved!);
  await act(() => useChatPanel.persist.rehydrate());
  expect(useChatPanel.getState()).toMatchObject({
    teamId: "team-a",
    open: true,
  });
});
