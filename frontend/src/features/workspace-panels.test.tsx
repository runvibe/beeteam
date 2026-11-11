import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Tooltip } from "radix-ui";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { setLocalePreference } from "@/i18n";
import { useChatPanel } from "@/state/chat-panel";
import { useSessionsSidebar } from "@/state/sessions-sidebar";
import { ChatWorkspace } from "./chat-side-panel";
import { SessionsSidebar } from "./sessions-sidebar";
import { WorkspaceLayoutMenu } from "./workspace-layout-menu";

vi.mock("@/api/context", () => ({
  useApi: () => ({
    managedAgents: {
      sessions: async () => ({ items: [], nextCursor: null }),
    },
    list: async () => ({ items: [], total: 0, offset: 0, limit: 100 }),
  }),
  useList: () => ({
    data: { items: [], total: 0, offset: 0, limit: 100 },
    error: null,
    isFetching: false,
    refetch: async () => {},
  }),
  useEntity: (resource: string) => ({
    data:
      resource === "teams"
        ? { name: "Team A", leaderId: "leader", system: false }
        : { version: 1, name: "Leader" },
    error: null,
    isPending: false,
    refetch: async () => {},
  }),
}));
vi.mock("./managed-agent-chat", () => ({
  ManagedAgentChat: () => <textarea aria-label="Chat draft" />,
}));
vi.mock("./team-managed-approvals", () => ({
  TeamManagedApprovals: () => null,
}));

let narrow = false;
beforeEach(() => {
  localStorage.clear();
  narrow = false;
  setLocalePreference("en");
  vi.stubGlobal("innerWidth", 1200);
  vi.stubGlobal("matchMedia", () => ({
    matches: narrow,
    addEventListener() {},
    removeEventListener() {},
  }));
  useChatPanel.setState(useChatPanel.getInitialState());
  useChatPanel.setState({ teamId: "team-a", open: true });
  useSessionsSidebar.setState({ open: true, drawer: false });
});
afterEach(() => vi.unstubAllGlobals());

function renderWorkspace() {
  const view = render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <Tooltip.Provider><WorkspaceLayoutMenu /></Tooltip.Provider>
      <ChatWorkspace sessions={<SessionsSidebar />}>
        <div className="main-shell" data-workspace-panel="content">
          <header className="topbar" data-dock-handle="content">
            <span>Workspace</span>
            <button type="button">Existing filter</button>
          </header>
          <main>
            <input aria-label="Content draft" />
          </main>
        </div>
      </ChatWorkspace>
    </QueryClientProvider>,
  );
  const workspace = view.container.querySelector(".chat-workspace")!;
  const sessions = screen.getByRole("complementary", { name: "Sessions" });
  const content = view.container.querySelector<HTMLElement>(".main-shell")!;
  const chat = screen.getByRole("complementary", {
    name: "Chat with the leader",
  });
  vi.spyOn(workspace, "getBoundingClientRect").mockReturnValue(
    new DOMRect(68, 0, 1132, 800),
  );
  vi.spyOn(sessions, "getBoundingClientRect").mockReturnValue(
    new DOMRect(68, 0, 280, 800),
  );
  vi.spyOn(content, "getBoundingClientRect").mockReturnValue(
    new DOMRect(348, 0, 412, 800),
  );
  vi.spyOn(chat, "getBoundingClientRect").mockReturnValue(
    new DOMRect(760, 0, 440, 800),
  );
  return { workspace, sessions, content, chat };
}

function beginDrag(header: Element, startX: number, endX: number) {
  fireEvent.pointerDown(header, {
    clientX: startX,
    clientY: 20,
    button: 0,
    pointerId: 1,
  });
  fireEvent.pointerMove(window, { clientX: endX, clientY: 40, pointerId: 1 });
}

it("keeps sessions and chat headers draggable without grip icons", () => {
  const { workspace, sessions, chat } = renderWorkspace();
  for (const panel of [sessions, chat]) {
    expect(panel.querySelector(".workspace-panel-grip")).toBeNull();
  }
  beginDrag(sessions.querySelector("header")!, 200, 700);
  expect(document.querySelector(".chat-dock-preview")).toHaveAttribute(
    "data-position",
    "1",
  );
  fireEvent.pointerUp(window, { clientX: 700, clientY: 40, pointerId: 1 });
  expect(workspace).toHaveAttribute(
    "data-panel-order",
    "content,sessions,chat",
  );
});

it("docks sessions between content and chat and saves the arrangement", () => {
  const { workspace, sessions } = renderWorkspace();
  beginDrag(sessions.querySelector("header")!, 200, 700);
  expect(document.querySelector(".chat-dock-preview")).toHaveAttribute(
    "data-position",
    "1",
  );
  fireEvent.pointerUp(window, { clientX: 700, clientY: 40, pointerId: 1 });
  expect(workspace).toHaveAttribute(
    "data-panel-order",
    "content,sessions,chat",
  );
  expect(
    Array.from(workspace.children)
      .map((element) => element.getAttribute("data-workspace-panel"))
      .filter(Boolean),
  ).toEqual(["content", "sessions", "chat"]);
  expect(
    JSON.parse(localStorage.getItem("beeteam-chat-panel")!).state.panelOrder,
  ).toEqual(["content", "sessions", "chat"]);
});

it("moves content past the chat without remounting either draft", async () => {
  const { workspace, content } = renderWorkspace();
  const contentDraft = screen.getByRole("textbox", { name: "Content draft" });
  const chatDraft = screen.getByRole("textbox", { name: "Chat draft" });
  await userEvent.type(contentDraft, "content");
  await userEvent.type(chatDraft, "chat");
  beginDrag(content.querySelector("header")!, 500, 1190);
  expect(document.querySelector(".chat-dock-preview")).toHaveAttribute(
    "data-position",
    "2",
  );
  fireEvent.pointerUp(window, { clientX: 1190, clientY: 40, pointerId: 1 });
  expect(workspace).toHaveAttribute(
    "data-panel-order",
    "sessions,chat,content",
  );
  expect(useChatPanel.getState().side).toBe("left");
  expect(screen.getByRole("textbox", { name: "Content draft" })).toBe(
    contentDraft,
  );
  expect(screen.getByRole("textbox", { name: "Chat draft" })).toBe(chatDraft);
  expect(contentDraft).toHaveValue("content");
  expect(chatDraft).toHaveValue("chat");
});

it("docks the chat between sessions and content", () => {
  const { workspace, chat } = renderWorkspace();
  beginDrag(chat.querySelector("header")!, 1000, 450);
  expect(document.querySelector(".chat-dock-preview")).toHaveAttribute(
    "data-position",
    "1",
  );
  fireEvent.pointerUp(window, { clientX: 450, clientY: 40, pointerId: 1 });
  expect(workspace).toHaveAttribute(
    "data-panel-order",
    "sessions,chat,content",
  );
  expect(useChatPanel.getState().side).toBe("left");
});

it("applies a layout using the keyboard without moving focus into a panel", async () => {
  const { workspace, sessions } = renderWorkspace();
  const trigger = screen.getByRole("button", { name: "Panel layouts" });
  trigger.focus();
  await userEvent.keyboard("{Enter}");
  const layouts = screen.getByRole("radiogroup", { name: "Panel layouts" });
  const first = within(layouts).getByRole("radio", { name: "Sessions, Content, Chat" });
  const second = within(layouts).getByRole("radio", { name: "Sessions, Chat, Content" });
  const next = within(layouts).getByRole("radio", { name: "Content, Sessions, Chat" });
  expect(first).toHaveFocus();
  await userEvent.keyboard("{ArrowDown>}");
  await waitFor(() => expect(second).toHaveFocus());
  await userEvent.keyboard("{/ArrowDown}");
  await userEvent.keyboard("{ArrowDown>}");
  await waitFor(() => expect(next).toHaveFocus());
  await userEvent.keyboard("{/ArrowDown}");
  expect(workspace).toHaveAttribute(
    "data-panel-order",
    "content,sessions,chat",
  );
  expect(next).toBeChecked();
  expect(next).toHaveFocus();
  expect(within(sessions).queryByRole("button", { name: /Move sessions to the/ })).toBeNull();
  await userEvent.keyboard("{Escape}");
  expect(trigger).toHaveFocus();
});

it.each([
  ["Sessions, Content, Chat", "sessions,content,chat", "right"],
  ["Sessions, Chat, Content", "sessions,chat,content", "left"],
  ["Content, Sessions, Chat", "content,sessions,chat", "right"],
  ["Content, Chat, Sessions", "content,chat,sessions", "right"],
  ["Chat, Sessions, Content", "chat,sessions,content", "left"],
  ["Chat, Content, Sessions", "chat,content,sessions", "left"],
] as const)("applies and persists the %s layout", async (name, order, side) => {
  const { workspace } = renderWorkspace();
  await userEvent.click(screen.getByRole("button", { name: "Panel layouts" }));
  const option = screen.getByRole("radio", { name });
  await userEvent.click(option);
  expect(option).toBeChecked();
  expect(workspace).toHaveAttribute("data-panel-order", order);
  expect(useChatPanel.getState().side).toBe(side);
  expect(JSON.parse(localStorage.getItem("beeteam-chat-panel")!).state.panelOrder)
    .toEqual(order.split(","));
});

it("reflects a dragged panel order in the layout selector", async () => {
  const { sessions } = renderWorkspace();
  beginDrag(sessions.querySelector("header")!, 200, 700);
  fireEvent.pointerUp(window, { clientX: 700, clientY: 40, pointerId: 1 });
  await userEvent.click(screen.getByRole("button", { name: "Panel layouts" }));
  expect(screen.getByRole("radio", { name: "Content, Sessions, Chat" })).toBeChecked();
});

it("retains a hidden chat and its draft when a preset changes panel order", async () => {
  const { workspace } = renderWorkspace();
  const chatDraft = screen.getByRole("textbox", { name: "Chat draft" });
  await userEvent.type(chatDraft, "keep this");
  act(() => useChatPanel.getState().close());
  await userEvent.click(screen.getByRole("button", { name: "Panel layouts" }));
  await userEvent.click(screen.getByRole("radio", { name: "Content, Sessions, Chat" }));
  expect(workspace).toHaveAttribute(
    "data-panel-order",
    "content,sessions,chat",
  );
  act(() => useChatPanel.getState().show());
  expect(screen.getByRole("textbox", { name: "Chat draft" })).toBe(chatDraft);
  expect(chatDraft).toHaveValue("keep this");
  expect(workspace).toHaveAttribute(
    "data-panel-order",
    "content,sessions,chat",
  );
});

it("preserves visible chat and content drafts when applying a layout", async () => {
  const { workspace } = renderWorkspace();
  const contentDraft = screen.getByRole("textbox", { name: "Content draft" });
  const chatDraft = screen.getByRole("textbox", { name: "Chat draft" });
  await userEvent.type(contentDraft, "content");
  await userEvent.type(chatDraft, "chat");
  await userEvent.click(screen.getByRole("button", { name: "Panel layouts" }));
  await userEvent.click(screen.getByRole("radio", { name: "Chat, Sessions, Content" }));
  expect(workspace).toHaveAttribute("data-panel-order", "chat,sessions,content");
  expect(screen.getByRole("textbox", { name: "Content draft" })).toBe(contentDraft);
  expect(screen.getByRole("textbox", { name: "Chat draft" })).toBe(chatDraft);
  expect(contentDraft).toHaveValue("content");
  expect(chatDraft).toHaveValue("chat");
});

it("cancels a sessions drag with Escape and ignores interactive header controls", () => {
  const { workspace, sessions, content } = renderWorkspace();
  beginDrag(sessions.querySelector("header")!, 200, 1100);
  expect(document.querySelector(".chat-dock-preview")).toBeInTheDocument();
  fireEvent.keyDown(window, { key: "Escape" });
  fireEvent.pointerUp(window, { clientX: 1100, pointerId: 1 });
  expect(workspace).toHaveAttribute(
    "data-panel-order",
    "sessions,content,chat",
  );
  beginDrag(
    within(content).getByRole("button", { name: "Existing filter" }),
    500,
    1100,
  );
  expect(document.querySelector(".chat-dock-preview")).toBeNull();
});

it("cancels a drag on viewport resize and ignores other pointers", () => {
  const { workspace, sessions } = renderWorkspace();
  beginDrag(sessions.querySelector("header")!, 200, 1100);
  fireEvent.pointerUp(window, { clientX: 1100, pointerId: 2 });
  expect(document.querySelector(".chat-dock-preview")).toBeInTheDocument();
  fireEvent(window, new Event("resize"));
  expect(document.querySelector(".chat-dock-preview")).toBeNull();
  fireEvent.pointerUp(window, { clientX: 1100, pointerId: 1 });
  expect(workspace).toHaveAttribute(
    "data-panel-order",
    "sessions,content,chat",
  );
});

it("keeps the existing mobile overlays and disables panel dragging", () => {
  narrow = true;
  useSessionsSidebar.setState({ drawer: true });
  const { workspace, sessions } = renderWorkspace();
  beginDrag(sessions.querySelector("header")!, 200, 1100);
  expect(document.querySelector(".chat-dock-preview")).toBeNull();
  fireEvent.pointerUp(window, { clientX: 1100, pointerId: 1 });
  expect(workspace).toHaveAttribute(
    "data-panel-order",
    "sessions,content,chat",
  );
});

it("keeps content usable beside a wide chat and restores the saved width when sessions close", () => {
  useChatPanel.setState({ width: 960 });
  const { workspace, chat } = renderWorkspace();
  Object.defineProperty(workspace, "clientWidth", {
    configurable: true,
    value: 1132,
  });
  fireEvent(window, new Event("resize"));
  const resizer = within(chat).getByRole("separator", {
    name: "Resize chat panel",
  });
  expect(resizer).toHaveAttribute("aria-valuemax", "672");
  expect(resizer).toHaveAttribute("aria-valuenow", "672");
  expect(useChatPanel.getState().width).toBe(960);
  act(() => useSessionsSidebar.getState().setOpen(false));
  expect(resizer).toHaveAttribute("aria-valuemax", "960");
  expect(resizer).toHaveAttribute("aria-valuenow", "960");
});

it("preserves the saved width when the constrained chat cannot grow", () => {
  vi.stubGlobal("innerWidth", 1600);
  useChatPanel.setState({ width: 1200 });
  const { workspace } = renderWorkspace();
  Object.defineProperty(workspace, "clientWidth", {
    configurable: true,
    value: 1200,
  });
  fireEvent(window, new Event("resize"));
  const resizer = screen.getByRole("separator", { name: "Resize chat panel" });
  expect(resizer).toHaveAttribute("aria-valuenow", "740");
  fireEvent.keyDown(resizer, { key: "ArrowLeft" });
  expect(useChatPanel.getState().width).toBe(1200);
  Object.defineProperty(resizer, "hasPointerCapture", { value: () => true });
  fireEvent.pointerMove(resizer, { clientX: 0, pointerId: 1 });
  expect(useChatPanel.getState().width).toBe(1200);
  act(() => useSessionsSidebar.getState().setOpen(false));
  expect(resizer).toHaveAttribute("aria-valuenow", "1200");
});

it("uses the latest width for consecutive resize events before rendering", () => {
  vi.stubGlobal("innerWidth", 1600);
  useChatPanel.setState({ width: 1200 });
  const { workspace } = renderWorkspace();
  Object.defineProperty(workspace, "clientWidth", {
    configurable: true,
    value: 1200,
  });
  fireEvent(window, new Event("resize"));
  const resizer = screen.getByRole("separator", { name: "Resize chat panel" });
  Object.defineProperty(resizer, "hasPointerCapture", { value: () => true });
  act(() => {
    fireEvent.pointerMove(resizer, { clientX: 600, pointerId: 1 });
    fireEvent.pointerMove(resizer, { clientX: 460, pointerId: 1 });
  });
  expect(useChatPanel.getState().width).toBe(740);
  act(() => {
    fireEvent.keyDown(resizer, { key: "ArrowRight" });
    fireEvent.keyDown(resizer, { key: "ArrowRight" });
  });
  expect(useChatPanel.getState().width).toBe(700);
});
