import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { setLocalePreference } from "@/i18n";
import { useChatPanel } from "@/state/chat-panel";
import { navigate } from "@/routing/location";
import { workspacePanelSizes, workspaceResizeBounds } from "./workspace-panel-sizes";

beforeEach(() => {
  setLocalePreference("en");
  useChatPanel.setState(useChatPanel.getInitialState());
  window.history.replaceState({}, "", "/boards");
  window.dispatchEvent(new PopStateEvent("popstate"));
});
afterEach(() => setLocalePreference("pt"));

it.each([
  ["/home", "Home"],
  ["/boards", "Tasks"],
  ["/agents", "Agent Resources"],
  ["/teams", "Teams"],
])("toggles content from the active %s destination", async (path, label) => {
  window.history.replaceState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  const user = userEvent.setup();
  render(<ApiProvider api={createMockApi({ delay: 0 })}><App homeEnabled /></ApiProvider>);
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  expect(within(nav).queryByRole("button", { name: "Content panel" })).not.toBeInTheDocument();
  const destination = within(nav).getByRole("button", { name: label });
  const content = document.querySelector<HTMLElement>("#content-panel")!;

  expect(destination).toHaveAttribute("data-variant", "secondary");
  expect(destination).toHaveAttribute("aria-current", "page");
  expect(destination).toHaveAttribute("aria-controls", "content-panel");
  expect(destination).toHaveAttribute("aria-expanded", "true");
  expect(content).toBeVisible();
  await user.click(destination);
  expect(content).not.toBeVisible();
  expect(window.location.pathname).toBe(path);
  expect(destination).toHaveAttribute("aria-expanded", "false");
  expect(destination).toHaveAttribute("data-variant", "ghost");
  expect(destination).not.toHaveAttribute("aria-current");
  expect(destination).toBeEnabled();

  await user.click(destination);
  expect(content).toBeVisible();
  expect(window.location.pathname).toBe(path);
  expect(destination).toHaveAttribute("aria-expanded", "true");
  expect(destination).toHaveAttribute("data-variant", "secondary");
  expect(destination).toHaveAttribute("aria-current", "page");
});

it("keeps a detail route when its destination closes and reopens content", async () => {
  window.history.replaceState({}, "", "/teams/team-x");
  window.dispatchEvent(new PopStateEvent("popstate"));
  const user = userEvent.setup();
  render(<ApiProvider api={createMockApi({ delay: 0 })}><App /></ApiProvider>);
  const teams = screen.getByRole("button", { name: "Teams" });
  await user.click(teams);
  expect(useChatPanel.getState().contentOpen).toBe(false);
  await user.click(teams);
  expect(useChatPanel.getState().contentOpen).toBe(true);
  expect(window.location.pathname).toBe("/teams/team-x");
});

it("navigates and opens content when another destination is chosen", async () => {
  const user = userEvent.setup();
  render(<ApiProvider api={createMockApi({ delay: 0 })}><App /></ApiProvider>);
  const content = document.querySelector<HTMLElement>("#content-panel")!;
  await user.click(screen.getByRole("button", { name: "Tasks" }));
  expect(content).not.toBeVisible();
  const agents = screen.getByRole("button", { name: "Agent Resources" });
  await user.click(agents);
  expect(content).toBeVisible();
  expect(window.location.pathname).toBe("/agents");
  expect(agents).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("button", { name: "Tasks" })).not.toHaveAttribute("aria-current");
});

it("closes and reopens content without losing its mounted state, and navigation reopens it", async () => {
  const user = userEvent.setup();
  render(<ApiProvider api={createMockApi({ delay: 0 })}><App /></ApiProvider>);
  const content = document.querySelector<HTMLElement>(".main-shell")!;
  await user.click(await screen.findByRole("button", { name: "Search boards" }));
  const input = await screen.findByRole("searchbox", { name: "Search boards" });
  await user.type(input, "draft");
  const order = useChatPanel.getState().panelOrder;

  await user.click(within(content).getByRole("button", { name: "Close content panel" }));
  expect(content).not.toBeVisible();
  expect(input).toHaveValue("draft");
  const tasks = screen.getByRole("button", { name: "Tasks" });
  expect(tasks).toHaveAttribute("aria-expanded", "false");
  expect(tasks).toHaveFocus();
  expect(JSON.parse(localStorage.getItem("beeteam-chat-panel")!).state.contentOpen).toBe(false);
  await user.click(tasks);
  expect(content).toBeVisible();
  expect(screen.getByRole("searchbox", { name: "Search boards" })).toBe(input);
  expect(input).toHaveValue("draft");
  expect(useChatPanel.getState().panelOrder).toEqual(order);

  await user.click(within(content).getByRole("button", { name: "Close content panel" }));
  navigate("/teams");
  expect(await screen.findByRole("heading", { name: "Teams" })).toBeVisible();
}, 15000);

it.each([
  ["sessions", "chat"],
  ["chat", "sessions"],
] as const)("resizes remaining %s and %s panels when content is hidden", (first, second) => {
  const config = { viewport: 1200, workspace: 1132, visible: [first, second], narrow: false };
  const sizes = workspacePanelSizes(config, 440, 280);
  expect(sizes.sessions).toBe(280);
  expect(sizes.chat).toBe(852);
  expect(sizes.content).toBe(0);
  expect(workspaceResizeBounds(config, sizes, "sessions")).toMatchObject({
    edge: first === "sessions" ? "right" : "left",
    neighbor: "chat",
    min: 200,
    max: 812,
  });
});
