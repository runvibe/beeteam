import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { useChatPanel } from "@/state/chat-panel";
import { setLocalePreference } from "@/i18n";
import { ChatWorkspace, ChatPanelToggle } from "./chat-side-panel";

const systemTeams = vi.hoisted(() => ({
  managed: false,
  items: [{ id: "hq", name: "Bee Team HQ", system: true }] as unknown[],
  listCalls: vi.fn(),
}));
vi.mock("@/api/context", () => ({
  useList: () => ({ data: undefined }),
  useApi: () => ({
    managedAgents: systemTeams.managed ? {} : undefined,
    list: async (
      _resource: string,
      _scope: string,
      filters?: { system?: boolean },
    ) => {
      systemTeams.listCalls(filters);
      const items = filters?.system
        ? systemTeams.items
        : [{ id: "team-a", name: "Team A" }];
      return { items, total: items.length, offset: 0, limit: 20 };
    },
  }),
  useEntity: (resource: string, id: string) => ({
    data:
      resource === "teams"
        ? {
            name: id === "hq" ? "Bee Team HQ" : "Team A",
            leaderId: "leader",
            system: id === "hq",
          }
        : { version: 1 },
  }),
}));
vi.mock("@/components/shared", () => ({
  QueryState: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("./leader-chat", () => ({
  LeaderChat: () => <section className="managed-agent-chat">
    <div className="assistant-thread">Saved messages</div>
    <div className="managed-voice-chat" data-call-active="true">
      <div className="voice-avatar-overlay" aria-label="Active voice" />
      <textarea aria-label="Draft" defaultValue="" />
    </div>
  </section>,
}));
vi.mock("./managed-agent-chat", () => ({
  ManagedAgentChat: () => <textarea aria-label="Draft" />,
}));
vi.mock("./chat-session-information", () => ({
  sessionInformationMode: () => "inline",
  ChatSessionInformation: () => <div id="chat-session-information">Session information</div>,
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
  await userEvent.click(screen.getByRole("button", { name: "Float chat" }));
  expect(screen.getByRole("textbox", { name: "Draft" })).toBe(draft);
  expect(draft.closest("#leader-chat-panel")).toHaveAttribute(
    "data-floating",
    "true",
  );
  act(() => useChatPanel.getState().openTeam("team-a"));
  expect(screen.getByRole("textbox", { name: "Draft" })).toHaveValue(
    "Keep my draft",
  );
});

it("preserves the default HQ draft when the chat is closed and reopened", async () => {
  setLocalePreference("en");
  systemTeams.items = [{ id: "hq", name: "Bee Team HQ", system: true }];
  useChatPanel.setState({ teamId: null, picking: false, open: true });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChatPanelToggle />
      <ChatWorkspace>
        <main>Boards</main>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  const draft = await screen.findByRole("textbox", { name: "Draft" });
  await userEvent.type(draft, "Keep the HQ draft");
  const toggle = screen.getByRole("button", { name: "Chat with the leader" });
  await userEvent.click(toggle);
  expect(screen.getByRole("textbox", { name: "Draft" })).toBe(draft);
  expect(draft.closest("#leader-chat-panel")).toHaveAttribute(
    "data-floating",
    "true",
  );
  await userEvent.click(toggle);
  expect(await screen.findByRole("textbox", { name: "Draft" })).toBe(draft);
  expect(draft).toHaveValue("Keep the HQ draft");
});

it.each([
  ["default team", false, "Bee Team HQ", { system: true }],
  ["team picker", true, "Team A", { limit: 20 }],
])(
  "loads the %s immediately when restoring a floating chat",
  async (_label, picking, name, filters) => {
    setLocalePreference("en");
    systemTeams.items = [{ id: "hq", name: "Bee Team HQ", system: true }];
    systemTeams.listCalls.mockClear();
    useChatPanel.setState({ teamId: null, picking, open: false });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChatPanelToggle />
        <ChatWorkspace>
          <main>Boards</main>
        </ChatWorkspace>
      </QueryClientProvider>,
    );
    await act(async () => {});
    expect(await screen.findByText(name)).toBeVisible();
    expect(document.querySelector("#leader-chat-panel")).toHaveAttribute(
      "data-floating",
      "true",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Chat with the leader" }),
    );
    expect(await screen.findByText(name)).toBeVisible();
    expect(systemTeams.listCalls).toHaveBeenCalledWith(
      expect.objectContaining(filters),
    );
  },
);

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
  expect(useChatPanel.getState()).toMatchObject({
    teamId: "team-a",
    picking: false,
  });
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
  expect(useChatPanel.getState()).toMatchObject({
    open: true,
    teamId: null,
    picking: false,
  });
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

it("keeps the team and chat content in a centered, readable-width column", () => {
  setLocalePreference("en");
  useChatPanel.setState({ teamId: "team-a", open: true });
  const style = document.createElement("style");
  style.textContent = readFileSync("src/features/chat-side-panel.css", "utf8");
  document.head.append(style);
  try {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChatWorkspace>
          <main>Boards</main>
        </ChatWorkspace>
      </QueryClientProvider>,
    );
    const content = document.querySelector(".chat-panel-content");
    expect(content).toContainElement(screen.getByText("Team A"));
    expect(content).toContainElement(
      screen.getByRole("textbox", { name: "Draft" }),
    );
    expect(getComputedStyle(content!).maxWidth).toBe("48rem");
    expect(getComputedStyle(content!).marginInline).toBe("auto");
  } finally {
    style.remove();
  }
});

it("toggles compact without remounting history, voice or draft, and restores expanded size", async()=>{
  setLocalePreference("en");
  useChatPanel.setState({teamId:"team-a",open:false,floatingSize:{width:440,height:600},floatingPosition:{x:12,y:12}});
  const rect=vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockImplementation(function(this:HTMLElement){
    if(this.id==="leader-chat-panel")return {x:12,y:12,left:12,top:12,right:452,bottom:612,width:440,height:600} as DOMRect;
    return {x:0,y:0,left:0,top:0,right:1000,bottom:800,width:1000,height:800} as DOMRect;
  });
  const view=render(<QueryClientProvider client={new QueryClient()}><ChatWorkspace><main>Content</main></ChatWorkspace></QueryClientProvider>);
  const panel=document.getElementById("leader-chat-panel")!;
  const heading=panel.querySelector(".chat-panel-heading")!;
  const draft=screen.getByRole("textbox",{name:"Draft"});
  const voice=screen.getByLabelText("Active voice");
  const history=screen.getByText("Saved messages");
  await userEvent.type(draft,"Do not lose this");
  fireEvent.doubleClick(screen.getByRole("button", {name:"Dock chat"}));
  expect(panel).not.toHaveAttribute("data-floating-compact");
  await userEvent.dblClick(heading);
  expect(panel).toHaveAttribute("data-floating-compact","true");
  expect(useChatPanel.getState().floatingSize?.height).toBe(600);
  expect(screen.getByRole("textbox",{name:"Draft"})).toBe(draft);
  expect(screen.getByLabelText("Active voice")).toBe(voice);
  expect(screen.getByText("Saved messages")).toBe(history);
  await userEvent.dblClick(heading);
  expect(panel).not.toHaveAttribute("data-floating-compact");
  expect(panel.style.height).toBe("600px");
  expect(draft).toHaveValue("Do not lose this");
  await userEvent.dblClick(heading);
  act(()=>useChatPanel.getState().show());
  expect(panel).not.toHaveAttribute("data-floating-compact");
  view.unmount();rect.mockRestore();
});

it("expands compact mode before opening session information",async()=>{
  setLocalePreference("en");systemTeams.managed=true;
  useChatPanel.setState({teamId:"team-a",open:false,floatingSize:null,floatingPosition:null});
  const view=render(<QueryClientProvider client={new QueryClient()}><ChatWorkspace><main>Content</main></ChatWorkspace></QueryClientProvider>);
  const panel=document.getElementById("leader-chat-panel")!;
  const heading=panel.querySelector(".chat-panel-heading")!;
  const info=panel.querySelector<HTMLButtonElement>('button[aria-controls="chat-session-information"]')!;
  await userEvent.click(info);
  expect(info).toHaveAttribute("aria-expanded","true");
  await userEvent.dblClick(heading);
  expect(panel).toHaveAttribute("data-floating-compact","true");
  expect(info).toHaveAttribute("aria-expanded","false");
  await userEvent.click(info);
  expect(panel).not.toHaveAttribute("data-floating-compact");
  expect(info).toHaveAttribute("aria-expanded","true");
  expect(document.getElementById("chat-session-information")).toBeInTheDocument();
  view.unmount();systemTeams.managed=false;
});
