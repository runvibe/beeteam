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
import { makeSeed } from "@/api/seed";
beforeEach(() =>
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline"))),
);
afterEach(() => {
  vi.unstubAllGlobals();
  history.replaceState({}, "", "/boards");
});
function locationAt(url: string) {
  history.replaceState({}, "", url);
  dispatchEvent(new PopStateEvent("popstate"));
}
it("enters Home from the connected root and leaves direct list links intact", async () => {
  locationAt("/?boards.name=preserved");
  const api = createMockApi({ delay: 0 });
  const list = vi.spyOn(api, "list");
  render(
    <ApiProvider api={api}>
      <ConnectedApp />
    </ApiProvider>,
  );
  await screen.findByRole("heading", {
    name: "O próximo passo começa com uma conversa.",
  });
  expect(location.pathname).toBe("/home");
  expect(document.querySelector(".mobile-context-path")).toHaveTextContent("Início");
  expect(location.search).toContain("boards.name=preserved");
  expect(list).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Abrir boards" }));
  await screen.findByRole("link", { name: "Lançamento do produto" });
  expect(location.pathname).toBe("/boards");
});
it("resumes the original URL including tab and filters from Home", async () => {
  locationAt(
    "/home?from=" +
      encodeURIComponent("/agents?agents.name=Lia&agents.role=worker"),
  );
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <ConnectedApp />
    </ApiProvider>,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Retomar de onde parei" }),
  );
  await waitFor(() =>
    expect(location.pathname + location.search).toBe(
      "/agents?agents.name=Lia&agents.role=worker",
    ),
  );
  expect(
    screen.queryByRole("heading", {
      name: "O próximo passo começa com uma conversa.",
    }),
  ).toBeNull();
});
it("keeps the landing at root after discovery and enters Home on request", async () => {
  locationAt("/");
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
  fireEvent.click(
    screen.getByRole("button", { name: "Verificar conexão novamente" }),
  );
  const open = await screen.findByRole("button", { name: "Abrir meu painel" });
  expect(location.pathname).toBe("/");
  fireEvent.click(open);
  await screen.findByRole("heading", {
    name: "O próximo passo começa com uma conversa.",
  });
  expect(location.pathname).toBe("/app/");
  act(() => setLocalePreference("en"));
  expect(
    screen.getByRole("heading", {
      name: "Your next step starts with a conversation.",
    }),
  ).toBeVisible();
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
  await screen.findByRole("button", { name: "Retomar de onde parei" });
  const home = location.pathname + location.search;
  const entries = history.length;
  fireEvent.click(screen.getByRole("button", { name: "Início" }));
  fireEvent.click(
    screen.getByRole("link", { name: "Bee Team - ir para o início" }),
  );
  expect(location.pathname + location.search).toBe(home);
  expect(history.length).toBe(entries);
  fireEvent.click(
    screen.getByRole("button", { name: "Retomar de onde parei" }),
  );
  await waitFor(() =>
    expect(location.pathname + location.search).toBe(requested),
  );
});
