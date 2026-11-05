import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "./context";
import { createMockApi } from "./mock";
import { ids } from "./seed";
import type { ChangeSource } from "./live-refresh";
import { useQuery } from "@tanstack/react-query";
it("refreshes local data while keeping the public manifest cache", async () => {
  const local = vi.fn(async () => "local");
  const published = vi.fn(async () => "public");
  let events!: Parameters<ChangeSource>[0];
  function Probe() {
    useQuery({ queryKey: ["boards"], queryFn: local });
    useQuery({
      queryKey: ["public-install-manifest"],
      queryFn: published,
      meta: { scope: "public" },
      staleTime: 300000,
    });
    return null;
  }
  render(
    <ApiProvider
      api={createMockApi({ delay: 0 })}
      changes={(handlers) => {
        events = handlers;
        return () => {};
      }}
    >
      <Probe />
    </ApiProvider>,
  );
  await waitFor(() => expect(published).toHaveBeenCalledTimes(1));
  act(() => events.change());
  await waitFor(() => expect(local).toHaveBeenCalledTimes(2));
  expect(published).toHaveBeenCalledTimes(1);
});
it("refreshes an external edit without replacing a focused draft or URL and rejects stale overwrite", async () => {
  const api = createMockApi({ delay: 0 });
  const agent = await api.get("agents", ids.agent);
  window.history.replaceState(
    {},
    "",
    `/agents/${agent.slug}/settings?agent.tab=activities&activities.offset=2&from=%2Fagents`,
  );
  window.dispatchEvent(new PopStateEvent("popstate"));
  let events!: Parameters<ChangeSource>[0];
  const close = vi.fn();
  const source: ChangeSource = (h) => {
    events = h;
    return close;
  };
  const view = render(
    <ApiProvider api={api} changes={source}>
      <App />
    </ApiProvider>,
  );
  const field = await screen.findByLabelText("Estilo de trabalho");
  await userEvent.clear(field);
  await userEvent.type(field, "Meu rascunho");
  const url = location.href;
  const node = field;
  await api.patch("agents", agent.id, { name: "Nome remoto" }, agent.version);
  act(() => events.change());
  await waitFor(() =>
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Nome remoto"),
  );
  expect(screen.getByLabelText("Estilo de trabalho")).toBe(node);
  expect(field).toHaveValue("Meu rascunho");
  expect(field).toHaveFocus();
  expect(location.href).toBe(url);
  await userEvent.tab();
  await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
  expect((await api.get("agents", agent.id)).name).toBe("Nome remoto");
  expect(field).toHaveValue("Meu rascunho");
  view.unmount();
  expect(close).toHaveBeenCalledOnce();
});
it("refetches visible board data on reconnect without navigation", async () => {
  const api = createMockApi({ delay: 0 });
  window.history.replaceState({}, "", "/boards?boards.limit=1");
  window.dispatchEvent(new PopStateEvent("popstate"));
  let events!: Parameters<ChangeSource>[0];
  render(
    <ApiProvider
      api={api}
      changes={(h) => {
        events = h;
        return () => {};
      }}
    >
      <App />
    </ApiProvider>,
  );
  await screen.findByRole("link", { name: "Lançamento do produto" });
  const url = location.href;
  const board = await api.get("boards", ids.board);
  await api.patch(
    "boards",
    board.id,
    { name: "Atualização remota" },
    board.version,
  );
  act(() => events.open());
  await screen.findByRole("link", { name: "Atualização remota" });
  expect(location.href).toBe(url);
});
it("reads a post-event snapshot even when an initial request was already in flight", async () => {
  const api = createMockApi({ delay: 0 });
  const original = api.list.bind(api);
  let release!: () => void;
  let started!: () => void;
  const ready = new Promise<void>((r) => (started = r));
  let first = true;
  api.list = (async (...args: Parameters<typeof api.list>) => {
    const result = await original(...args);
    if (args[0] === "boards" && first) {
      first = false;
      started();
      await new Promise<void>((r) => (release = r));
    }
    return result;
  }) as typeof api.list;
  window.history.replaceState({}, "", "/boards");
  window.dispatchEvent(new PopStateEvent("popstate"));
  let events!: Parameters<ChangeSource>[0];
  render(
    <ApiProvider
      api={api}
      changes={(h) => {
        events = h;
        return () => {};
      }}
    >
      <App />
    </ApiProvider>,
  );
  await ready;
  const board = await api.get("boards", ids.board);
  await api.patch("boards", board.id, { name: "Após evento" }, board.version);
  act(() => events.change());
  await new Promise((r) => setTimeout(r, 200));
  await act(async () => release());
  expect(
    await screen.findByRole("link", { name: "Após evento" }),
  ).toBeVisible();
});
