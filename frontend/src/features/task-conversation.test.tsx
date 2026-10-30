import { useQueryClient } from "@tanstack/react-query";
import { navigate } from "@/routing/location";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, uuid } from "@/api/seed";
import { TaskConversation } from "./task-conversation";

it("opens latest comments, prepends previous pages and renders safe Markdown with current roles", async () => {
  history.replaceState({}, "", "/tasks/test?tab=comments&comments.limit=2");
  const seed = makeSeed();
  seed.agents[0].bindings.leaderTeamId = uuid(123);
  seed.agents[0].bindings.collaboratorTeamId = uuid(124);
  const taskId = seed.tasks[0].id;
  seed.comments = Array.from({ length: 5 }, (_, index) => ({
    id: uuid(8000 + index),
    taskId,
    actorKind: index === 4 ? ("human" as const) : ("agent" as const),
    actorId: seed.agents[0].id,
    body:
      index === 3
        ? "**Texto seguro**\n\n<script>alert(1)</script>\n\n```js\nconst x = 1\n```"
        : `Mensagem ${index}`,
    createdAt: `2026-10-30T12:00:0${index}Z`,
    deletedAt: null,
  }));
  const api = createMockApi({ delay: 0, seed });
  render(
    <ApiProvider api={api}>
      <TaskConversation taskId={taskId} />
    </ApiProvider>,
  );
  await screen.findByText("Texto seguro");
  expect(screen.queryByText("Mensagem 0")).toBeNull();
  expect(screen.getByText("Texto seguro").tagName).toBe("STRONG");
  expect(document.querySelector("script")).toBeNull();
  await waitFor(() =>
    expect(screen.getByText("Texto seguro").closest("article")).toHaveAttribute(
      "data-side",
      "right",
    ),
  );
  expect(screen.getByText("Mensagem 4").closest("article")).toHaveAttribute(
    "data-side",
    "left",
  );
  expect(screen.getByText("Leader · papel atual")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Carregar anteriores" }));
  await screen.findByText("Mensagem 1");
  fireEvent.click(screen.getByRole("button", { name: "Carregar anteriores" }));
  await screen.findByText("Mensagem 0");
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Carregar anteriores" }),
    ).toBeNull(),
  );
  expect(document.querySelectorAll("article[data-comment-id]")).toHaveLength(5);
});

it("preserves an explicit legacy offset and loads following comments on demand", async () => {
  history.replaceState(
    {},
    "",
    "/tasks/legacy?tab=comments&comments.offset=0&comments.limit=1",
  );
  const seed = makeSeed();
  const taskId = seed.tasks[0].id;
  seed.comments = [0, 1, 2].map((index) => ({
    id: uuid(9000 + index),
    taskId,
    actorKind: "human" as const,
    actorId: null,
    body: `Legacy ${index}`,
    createdAt: `2026-10-30T12:00:0${index}Z`,
    deletedAt: null,
  }));
  const api = createMockApi({ delay: 0, seed });
  const list = vi.spyOn(api, "list");
  render(
    <ApiProvider api={api}>
      <TaskConversation taskId={taskId} />
    </ApiProvider>,
  );
  await screen.findByText("Legacy 0");
  expect(screen.queryByText("Legacy 2")).toBeNull();
  expect(location.search).toContain("comments.offset=0");
  fireEvent.click(
    screen.getByRole("button", { name: /Ver mensagens seguintes/ }),
  );
  await screen.findByText("Legacy 1");
  expect(list.mock.calls.some((call) => call[0] === "comments")).toBe(true);
});

it("retains existing messages on previous-page errors and retries the same range", async () => {
  history.replaceState({}, "", "/tasks/retry?tab=comments&comments.limit=1");
  const seed = makeSeed();
  const taskId = uuid(9900);
  seed.comments = [0, 1].map((index) => ({
    id: uuid(9901 + index),
    taskId,
    actorKind: "human" as const,
    actorId: null,
    body: `Retry ${index}`,
    createdAt: `2026-10-30T12:00:0${index}Z`,
    deletedAt: null,
  }));
  const api = createMockApi({ delay: 0, seed });
  const original = api.list;
  let fail = true;
  vi.spyOn(api, "list").mockImplementation((...args) => {
    if (
      args[0] === "comments" &&
      args[2]?.sortOrder === "asc" &&
      args[2]?.offset === 0 &&
      fail
    ) {
      fail = false;
      return Promise.reject(new Error("offline"));
    }
    return original(...args);
  });
  render(
    <ApiProvider api={api}>
      <TaskConversation taskId={taskId} />
    </ApiProvider>,
  );
  await screen.findByText("Retry 1");
  fireEvent.click(screen.getByRole("button", { name: "Carregar anteriores" }));
  await screen.findByRole("alert");
  expect(screen.getByText("Retry 1")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  await screen.findByText("Retry 0");
});

it("filters the entire server conversation by literal text and author before pagination", async () => {
  const seed = makeSeed();
  const taskId = uuid(9700),
    author = seed.agents[0].id;
  history.replaceState(
    {},
    "",
    `/tasks/search?tab=comments&comments.limit=1&comments.actorKind=agent&comments.actorId=${author}&comments.text=${encodeURIComponent("100%_literal")}`,
  );
  seed.comments = Array.from({ length: 15 }, (_, index) => ({
    id: uuid(9701 + index),
    taskId,
    actorKind: "agent" as const,
    actorId: index === 1 ? seed.agents[1].id : author,
    body: index < 3 ? `Alvo 100%_literal ${index}` : `Distante ${index}`,
    createdAt: `2026-10-30T12:00:${String(index).padStart(2, "0")}Z`,
    deletedAt: null,
  }));
  const api = createMockApi({ delay: 0, seed });
  const list = vi.spyOn(api, "list");
  render(
    <ApiProvider api={api}>
      <TaskConversation taskId={taskId} />
    </ApiProvider>,
  );
  await screen.findByText("Alvo 100%_literal 2");
  expect(screen.queryByText("Distante 14")).toBeNull();
  expect(screen.queryByText("Alvo 100%_literal 1")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Carregar anteriores" }));
  await screen.findByText("Alvo 100%_literal 0");
  expect(
    list.mock.calls
      .filter((call) => call[0] === "comments")
      .every(
        (call) =>
          call[2]?.text === "100%_literal" &&
          call[2]?.actorId === author &&
          call[2]?.actorKind === "agent",
      ),
  ).toBe(true);
});

it("cancels obsolete comment requests when the filter identity changes", async () => {
  history.replaceState(
    {},
    "",
    "/tasks/cancel?tab=comments&comments.offset=0&comments.text=old",
  );
  const api = createMockApi({ delay: 0 });
  const original = api.list;
  let signal: AbortSignal | undefined;
  vi.spyOn(api, "list").mockImplementation((...args) => {
    if (args[0] !== "comments") return original(...args);
    if (args[2]?.text === "old") {
      signal = args[3];
      return new Promise(() => {});
    }
    return Promise.resolve({
      items: [],
      offset: 0,
      limit: 10,
      total: 0,
      hasMore: false,
      nextOffset: null,
    });
  });
  render(
    <ApiProvider api={api}>
      <TaskConversation taskId={uuid(9600)} />
    </ApiProvider>,
  );
  await waitFor(() => expect(signal).toBeDefined());
  act(() =>
    navigate("/tasks/cancel?tab=comments&comments.offset=0&comments.text=new"),
  );
  await screen.findByText("Nenhum comentário registrado");
  expect(signal?.aborted).toBe(true);
});

it("keeps the current DOM on refresh and offers new messages without replacing the reading window", async () => {
  history.replaceState({}, "", "/tasks/live?tab=comments&comments.limit=1");
  const api = createMockApi({ delay: 0 });
  const original = api.list;
  const taskId = uuid(9500);
  const rows = [
    {
      id: uuid(9501),
      taskId,
      actorKind: "human" as const,
      actorId: null,
      body: "Live first",
      createdAt: "2026-10-30T12:00:00Z",
      deletedAt: null,
    },
  ];
  vi.spyOn(api, "list").mockImplementation((...args) => {
    if (args[0] !== "comments") return original(...args);
    const offset = args[2]?.offset ?? 0,
      limit = args[2]?.limit ?? 1;
    const ordered = args[2]?.sortOrder === "desc" ? [...rows].reverse() : rows;
    const items = ordered.slice(offset, offset + limit);
    return Promise.resolve({
      items,
      offset,
      limit,
      total: rows.length,
      hasMore: offset + items.length < rows.length,
      nextOffset:
        offset + items.length < rows.length ? offset + items.length : null,
    });
  });
  function Refresh() {
    const client = useQueryClient();
    return (
      <button
        onClick={() =>
          void client.invalidateQueries({ queryKey: ["comments", taskId] })
        }
      >
        Refresh comments
      </button>
    );
  }
  render(
    <ApiProvider api={api}>
      <Refresh />
      <TaskConversation taskId={taskId} />
    </ApiProvider>,
  );
  const first = await screen.findByText("Live first");
  rows.push({
    ...rows[0],
    id: uuid(9502),
    body: "Live next",
    createdAt: "2026-10-30T12:01:00Z",
  });
  fireEvent.click(screen.getByRole("button", { name: "Refresh comments" }));
  const next = await screen.findByRole("button", {
    name: "Novas mensagens (1)",
  });
  expect(screen.getByText("Live first")).toBe(first);
  expect(screen.queryByText("Live next")).toBeNull();
  fireEvent.click(next);
  await screen.findByText("Live next");
  expect(screen.getByText("Live first")).toBe(first);
});
