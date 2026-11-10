import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { useChatPanel } from "@/state/chat-panel";
import { setLocalePreference } from "@/i18n";
import { ChatWorkspace, ChatPanelToggle } from "./chat-side-panel";

const systemTeams = vi.hoisted(() => ({
  items: [{ id: "hq", name: "Bee Team HQ", system: true }] as unknown[],
}));
vi.mock("@/api/context", () => ({
  useApi: () => ({
    list: async (_resource: string, _scope: string, filters?: { system?: boolean }) => {
      const items = filters?.system
        ? systemTeams.items
        : [{ id: "team-a", name: "Team A" }];
      return { items, total: items.length, offset: 0, limit: 20 };
    },
  }),
  useEntity: (resource: string, id: string) => ({
    data:
      resource === "teams"
        ? { name: id === "hq" ? "Bee Team HQ" : "Team A", leaderId: "leader", system: id === "hq" }
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

it("opens the Bee Team HQ guide by default and still lets users choose a team", async () => {
  setLocalePreference("en");
  systemTeams.items = [{ id: "hq", name: "Bee Team HQ", system: true }];
  useChatPanel.setState({ teamId: null, picking: false, open: false });
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
  expect(await screen.findByText("Bee Team HQ")).toBeVisible();
  expect(screen.getByRole("textbox", { name: "Draft" })).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Choose team" }));
  await userEvent.click(await screen.findByRole("button", { name: "Team A" }));
  expect(useChatPanel.getState()).toMatchObject({ teamId: "team-a", picking: false });
  expect(screen.getByRole("textbox", { name: "Draft" })).toBeVisible();
});
it("falls back to the team picker when the API has no system team", async () => {
  setLocalePreference("en");
  systemTeams.items = [];
  useChatPanel.setState({ teamId: null, picking: false, open: true });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChatWorkspace>
        <main>Agent details</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  await userEvent.click(await screen.findByRole("button", { name: "Team A" }));
  expect(screen.getByRole("textbox", { name: "Draft" })).toBeVisible();
});
it("opens the panel on first visit", async () => {
  localStorage.removeItem("beeteam-chat-panel");
  useChatPanel.setState(useChatPanel.getInitialState());
  expect(useChatPanel.getState()).toMatchObject({ open: true, teamId: null, picking: false });
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
