import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids, makeSeed } from "@/api/seed";
import { setLocalePreference } from "@/i18n";
import { goBack } from "@/routing/location";
import { TaskContext } from "./task-detail-layout";

afterEach(() => vi.unstubAllGlobals());

async function fixture(mobile = false) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width: 1055") ? mobile : query.includes("min-width: 1056") ? !mobile : false,
    addEventListener() {}, removeEventListener() {},
  }));
  const seed = makeSeed();
  const child = seed.tasks.find((task) => task.parentId === ids.task)!;
  child.boardId = seed.boards[1].id;
  const api = createMockApi({ delay: 0, seed });
  const task = await api.get("tasks", child.id);
  const team = seed.teams.find((team) => team.id === seed.boards[1].teamId)!;
  const url = `/tasks/${task.slug}?tab=specification&from=%2Fboards%3Fboards.name%3Dorigem${mobile ? "&task.view=details" : ""}`;
  window.history.replaceState({}, "", url);
  return { api, task, team, url };
}

it.each([
  ["pt", false, "Time do board atual"],
  ["pt", true, "Time do board atual"],
  ["en", false, "Current board team"],
  ["en", true, "Current board team"],
] as const)("uses the current board team in %s (mobile=%s)", async (locale, mobile, label) => {
  const { api, task, team, url } = await fixture(mobile);
  setLocalePreference(locale);
  const get = vi.spyOn(api, "get");
  render(<ApiProvider api={api}><TaskContext task={task} /></ApiProvider>);
  const row = (await screen.findByText(label)).closest("div")!;
  const link = await within(row).findByRole("link", { name: team.name });
  const destination = new URL(link.getAttribute("href")!, location.origin);
  expect(destination.pathname).toBe(`/teams/${team.slug}`);
  expect(destination.searchParams.get("from")).toBe(url);
  expect(task.executionContext.originBoardId).not.toBe(task.boardId);
  expect((await api.get("agents", task.executorAgentId)).bindings.collaboratorTeamId).not.toBe(team.id);
  expect(get).toHaveBeenCalledWith("teams", team.id);
  expect(get.mock.calls.filter(([resource]) => resource === "teams")).toEqual([["teams", team.id]]);
});

it.each(["boards", "teams"] as const)("shows %s errors and retries without guessing another team", async (resource) => {
  const { api, task, team } = await fixture();
  const original = api.get.bind(api);
  let failed = true;
  vi.spyOn(api, "get").mockImplementation(async (kind, id) => {
    if (failed && kind === resource && id === (resource === "boards" ? task.boardId : team.id)) throw new Error("Relationship unavailable");
    return original(kind, id);
  });
  render(<ApiProvider api={api}><TaskContext task={task} /></ApiProvider>);
  expect(await screen.findByText("Relationship unavailable")).toBeVisible();
  expect(screen.queryByRole("link", { name: team.name })).toBeNull();
  failed = false;
  await userEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
  expect(await screen.findByRole("link", { name: team.name })).toBeVisible();
});

it.each(["boards", "teams"] as const)("waits for %s before offering a team link", async (resource) => {
  const { api, task, team } = await fixture();
  const original = api.get.bind(api);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => { release = resolve; });
  vi.spyOn(api, "get").mockImplementation(async (kind, id) => {
    if (kind === resource && id === (resource === "boards" ? task.boardId : team.id)) await pending;
    return original(kind, id);
  });
  render(<ApiProvider api={api}><TaskContext task={task} /></ApiProvider>);
  const row = screen.getByText("Time do board atual").closest("div")!;
  expect(await within(row).findByRole("status")).toHaveAttribute("aria-busy", "true");
  expect(within(row).queryByRole("link")).toBeNull();
  await act(async () => { release(); });
  expect(await within(row).findByRole("link", { name: team.name })).toBeVisible();
});

it("preserves the mobile details origin after team reload and repeated return", async () => {
  const { api, team, url } = await fixture(true);
  const mount = () => render(<ApiProvider api={api}><App /></ApiProvider>);
  let view = mount();
  for (let i = 0; i < 2; i++) {
    const link = await screen.findByRole("link", { name: team.name });
    expect(new URL(link.getAttribute("href")!, location.origin).searchParams.get("from")).toBe(url);
    await userEvent.click(link);
    expect(await screen.findByRole("heading", { level: 1, name: team.name })).toBeVisible();
    view.unmount();
    window.history.replaceState({}, "", location.pathname + location.search);
    view = mount();
    await screen.findByRole("heading", { level: 1, name: team.name });
    act(() => goBack("/teams"));
    await waitFor(() => expect(location.pathname + location.search).toBe(url));
    expect(await screen.findByRole("heading", { name: "Detalhes da tarefa" })).toBeVisible();
  }
});
