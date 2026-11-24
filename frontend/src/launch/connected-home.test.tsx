import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createMockApi } from "@/api/mock";
import { ApiProvider } from "@/api/context";
import { setLocalePreference } from "@/i18n";
import { ConnectedApp } from "./connected-app";
import { LaunchRoot } from "./launch-root";
import { appVersion } from "@/app-version";
import { goBack, navigate } from "@/routing/location";
import { useChatPanel } from "@/state/chat-panel";
import { ids, makeSeed } from "@/api/seed";
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
  useChatPanel.setState(useChatPanel.getInitialState());
});
afterEach(() => {
  vi.unstubAllGlobals();
  history.replaceState({}, "", "/boards");
});
function locationAt(url: string) {
  history.replaceState({}, "", url);
  dispatchEvent(new PopStateEvent("popstate"));
}
async function reloadChatPanel() {
  const saved = localStorage.getItem("beeteam-chat-panel")!;
  useChatPanel.setState(useChatPanel.getInitialState());
  localStorage.setItem("beeteam-chat-panel", saved);
  await useChatPanel.persist.rehydrate();
}
it("opens only the chat at the connected root, preserving the selected conversation", async () => {
  locationAt("/?boards.name=preserved");
  useChatPanel.setState({
    teamId: ids.team,
    conversationId: "saved-conversation",
    open: false,
    contentOpen: true,
  });
  const api = createMockApi({ delay: 0 });
  render(
    <ApiProvider api={api}>
      <ConnectedApp />
    </ApiProvider>,
  );
  const chat = await screen.findByRole("complementary", { name: "Chat com o líder" });
  expect(chat).toBeVisible();
  expect(chat).not.toHaveAttribute("data-floating");
  expect(document.querySelector("#content-panel")).not.toBeVisible();
  expect(document.querySelector(".connected-home")).toBeNull();
  expect(useChatPanel.getState()).toMatchObject({
    teamId: ids.team,
    conversationId: "saved-conversation",
    open: true,
    contentOpen: false,
  });
  expect(location.pathname).toBe("/home");
  expect(location.search).toContain("boards.name=preserved");
  expect(screen.getByRole("link", { name: "Documentação" })).toHaveAttribute(
    "href",
    "https://getbee.team/guide/?theme=default&mode=light",
  );
  fireEvent.click(screen.getByRole("button", { name: "Hive" }));
  await screen.findByRole("link", { name: "Lançamento do produto" });
  expect(location.pathname).toBe("/boards");
  expect(document.querySelector("#content-panel")).toBeVisible();
});
it("shows only chat when navigating to Home without resetting the conversation", async () => {
  locationAt("/boards");
  useChatPanel.setState({ teamId: ids.team, conversationId: "saved-conversation" });
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <ConnectedApp />
    </ApiProvider>,
  );
  expect(document.querySelector("#content-panel")).toBeVisible();
  act(() => navigate("/home"));
  expect(screen.getByRole("complementary", { name: "Chat com o líder" })).toBeVisible();
  expect(document.querySelector("#content-panel")).not.toBeVisible();
  expect(document.querySelector(".connected-home")).toBeNull();
  expect(useChatPanel.getState()).toMatchObject({
    teamId: ids.team,
    conversationId: "saved-conversation",
    contentOpen: false,
  });
});
it.each(["entry", "Home button"])("opens a direct Hive link after chat-only %s", async (source) => {
  const api = createMockApi({ delay: 0 });
  locationAt("/home");
  const home = render(
    <ApiProvider api={api}>
      <ConnectedApp />
    </ApiProvider>,
  );
  expect(document.querySelector("#content-panel")).not.toBeVisible();
  if (source === "Home button")
    fireEvent.click(screen.getByRole("button", { name: "Início" }));
  home.unmount();
  await reloadChatPanel();

  locationAt("/boards");
  render(
    <ApiProvider api={api}>
      <ConnectedApp />
    </ApiProvider>,
  );
  expect(document.querySelector("#content-panel")).toBeVisible();
  expect(await screen.findByRole("link", { name: "Lançamento do produto" })).toBeVisible();
});
it("preserves an explicitly closed content panel when reloading its route", async () => {
  const api = createMockApi({ delay: 0 });
  locationAt("/boards");
  const page = render(
    <ApiProvider api={api}>
      <ConnectedApp />
    </ApiProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Hive" }));
  expect(document.querySelector("#content-panel")).not.toBeVisible();
  page.unmount();
  await reloadChatPanel();

  render(
    <ApiProvider api={api}>
      <ConnectedApp />
    </ApiProvider>,
  );
  expect(document.querySelector("#content-panel")).not.toBeVisible();
});
it("returns to the chat-only Home through browser history", async () => {
  locationAt("/home");
  useChatPanel.setState({ teamId: ids.team, conversationId: "saved-conversation" });
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <ConnectedApp />
    </ApiProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Hive" }));
  await screen.findByRole("link", { name: "Lançamento do produto" });
  act(() => history.back());
  await waitFor(() => expect(location.pathname).toBe("/home"));
  expect(screen.getByRole("complementary", { name: "Chat com o líder" })).toBeVisible();
  expect(document.querySelector("#content-panel")).not.toBeVisible();
  expect(document.querySelector(".connected-home")).toBeNull();
  expect(useChatPanel.getState()).toMatchObject({
    teamId: ids.team,
    conversationId: "saved-conversation",
    contentOpen: false,
  });
});
it("checks the local API on app entry and retries before opening the panel", async () => {
  locationAt("/app/");
  const api = createMockApi({ delay: 0 });
  api.info = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValue({
      apiVersion: appVersion,
      supportedContractVersions: ["v2"],
      capabilities: ["roles.worker"],
    });
  render(<LaunchRoot api={api} />);
  await screen.findByText("Não foi possível verificar a aplicação local.");
  expect(api.info).toHaveBeenCalledOnce();
  fireEvent.click(
    screen.getByRole("button", { name: "Verificar conexão novamente" }),
  );
  await screen.findByRole("complementary", { name: "Chat com o líder" });
  expect(location.pathname).toBe("/app/");
  expect(document.querySelector("#content-panel")).not.toBeVisible();
  expect(document.querySelector(".connected-home")).toBeNull();
  act(() => setLocalePreference("en"));
  expect(screen.getByRole("complementary", { name: "Chat with the leader" })).toBeVisible();
});
it("keeps the original task route when entering through the logo and activating Home repeatedly", async () => {
  const requested = `/tasks/${makeSeed().tasks[0].slug}?tab=plans&comments.offset=10`;
  locationAt(requested);
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <ConnectedApp />
    </ApiProvider>,
  );
  const logo = await screen.findByRole("link", {
    name: "Bee Team - ir para o início",
  });
  fireEvent.click(logo);
  await waitFor(() => expect(location.pathname).toBe("/home"));
  expect(useChatPanel.getState()).toMatchObject({ freshConversation: true, contentOpen: false });
  expect(new URLSearchParams(location.search).get("from")).toBe(requested);
  const home = location.pathname + location.search;
  const entries = history.length;
  fireEvent.click(screen.getByRole("button", { name: "Início" }));
  fireEvent.click(
    screen.getByRole("link", { name: "Bee Team - ir para o início" }),
  );
  expect(location.pathname + location.search).toBe(home);
  expect(history.length).toBe(entries);
  act(() => goBack());
  await waitFor(() =>
    expect(location.pathname + location.search).toBe(requested),
  );
});
