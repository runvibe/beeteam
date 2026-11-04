import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, ids, uuid } from "@/api/seed";

afterEach(() => vi.restoreAllMocks());
it("combines real chat filters before pagination and clears without losing origin or limit", async () => {
  const seed = makeSeed(),
    base = seed.chats[0];
  seed.chats = [
    {
      ...base,
      id: uuid(901),
      label: "Alpha old",
      harness: "Codex",
      createdAt: "2026-10-26T12:00:00.000Z",
      archivedAt: "2026-10-27T00:00:00Z",
    },
    {
      ...base,
      id: uuid(902),
      label: "Alpha match",
      harness: "Codex",
      createdAt: "2026-10-27T12:00:00.000Z",
      archivedAt: "2026-10-27T00:00:00Z",
    },
    {
      ...base,
      id: uuid(903),
      label: "Alpha other",
      harness: "Cursor",
      createdAt: "2026-10-27T12:00:00.000Z",
      archivedAt: "2026-10-27T00:00:00Z",
    },
    {
      ...base,
      id: uuid(904),
      label: "Alpha active",
      harness: "Codex",
      createdAt: "2026-10-27T12:00:00.000Z",
    },
  ];
  const api = createMockApi({ delay: 0, seed }),
    list = vi.spyOn(api, "list");
  history.replaceState(
    {},
    "",
    `/agents/${ids.agent}?agent.tab=chats&chats.label=Alpha&chats.harness=Codex&chats.archived=true&chats.createdFrom=2026-10-27&chats.createdUntil=2026-10-27&chats.limit=1&chats.offset=20&from=%2Fagents`,
  );
  render(
    <ApiProvider api={api}>
      <App />
    </ApiProvider>,
  );
  expect(await screen.findByText("Alpha match")).toBeVisible();
  expect(screen.queryByText("Alpha old")).toBeNull();
  const call = list.mock.calls.find((c) => c[0] === "chats")!;
  expect(call[2]).toMatchObject({
    label: "Alpha",
    harness: "Codex",
    archived: true,
    offset: 0,
    limit: 1,
    createdFrom: new Date(2026, 9, 27).toISOString(),
    createdBefore: new Date(2026, 9, 28).toISOString(),
  });
  await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  await screen.findByText("Alpha active");
  const q = new URLSearchParams(location.search);
  expect(q.get("chats.limit")).toBe("1");
  expect(q.get("from")).toBe("/agents");
  expect(q.get("chats.label")).toBeNull();
  expect(q.get("chats.offset")).toBeNull();
  await waitFor(() =>
    expect(
      list.mock.calls.filter((c) => c[0] === "chats").at(-1)?.[2],
    ).toMatchObject({ archived: false, offset: 0 }),
  );
});

it("blocks reversed date queries and allows clearing the error", async () => {
  const api = createMockApi({ delay: 0 }),
    list = vi.spyOn(api, "list");
  history.replaceState(
    {},
    "",
    `/agents/${ids.agent}?agent.tab=chats&chats.createdFrom=2026-10-28&chats.createdUntil=2026-10-27`,
  );
  render(
    <ApiProvider api={api}>
      <App />
    </ApiProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Informe datas válidas",
  );
  expect(list.mock.calls.filter((c) => c[0] === "chats")).toHaveLength(0);
  await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  await screen.findByText("Descoberta do produto");
  expect(screen.queryByRole("alert")).toBeNull();
});
it("resets loaded chat pages on name edits and restores combined filters on back after clear", async () => {
  const seed = makeSeed(),
    base = seed.chats[0];
  seed.chats = Array.from({ length: 3 }, (_, i) => ({
    ...base,
    id: uuid(920 + i),
    label: `Match ${i}`,
  }));
  const api = createMockApi({ delay: 0, seed }),
    list = vi.spyOn(api, "list");
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: 0,
    bottom: 60,
    height: 60,
    left: 0,
    right: 400,
    width: 400,
  } as DOMRect);
  history.replaceState(
    {},
    "",
    `/agents/${ids.agent}?agent.tab=chats&chats.limit=1&chats.harness=Codex`,
  );
  render(
    <ApiProvider api={api}>
      <App />
    </ApiProvider>,
  );
  await screen.findByText("Match 2");
  await userEvent.click(screen.getByRole("button", { name: "Nome do chat" }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Nome do chat" }), {
    target: { value: "Match 1" },
  });
  await waitFor(() => expect(screen.queryByText("Match 2")).toBeNull());
  expect(await screen.findByText("Match 1")).toBeVisible();
  expect(
    list.mock.calls
      .filter((c) => c[0] === "chats" && c[2]?.label === "Match 1")
      .map((c) => c[2]?.offset),
  ).toEqual([0]);
  const before = location.search;
  await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  await screen.findByText("Match 2");
  history.back();
  await waitFor(() => expect(location.search).toBe(before));
  await waitFor(() => expect(screen.queryByText("Match 2")).toBeNull());
  expect(await screen.findByText("Match 1")).toBeVisible();
});

it("retries a failed filtered query without dropping its parameters", async () => {
  const api = createMockApi({ delay: 0 }),
    original = api.list.bind(api);
  let attempts = 0;
  const list = vi
    .spyOn(api, "list")
    .mockImplementation(async (r, s, f, signal) => {
      if (r === "chats" && ++attempts === 1)
        throw Error("Temporary chat error");
      return original(r, s, f, signal);
    });
  history.replaceState(
    {},
    "",
    `/agents/${ids.agent}?agent.tab=chats&chats.label=Missing&chats.harness=Codex&chats.limit=1`,
  );
  render(
    <ApiProvider api={api}>
      <App />
    </ApiProvider>,
  );
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Temporary chat error",
  );
  await userEvent.click(
    screen.getByRole("button", { name: /Tentar novamente/i }),
  );
  expect(
    await screen.findByText("Nenhum chat corresponde aos filtros"),
  ).toBeVisible();
  expect(
    list.mock.calls.filter((c) => c[0] === "chats").map((c) => c[2]),
  ).toEqual([
    expect.objectContaining({
      label: "Missing",
      harness: "Codex",
      offset: 0,
      limit: 1,
    }),
    expect.objectContaining({
      label: "Missing",
      harness: "Codex",
      offset: 0,
      limit: 1,
    }),
  ]);
});
