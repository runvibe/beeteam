import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids } from "@/api/seed";
function setup(url: string) {
  window.history.replaceState({}, "", url);
  const api = createMockApi({ delay: 0 });
  const get = vi.spyOn(api, "get"),
    resolve = vi.spyOn(api, "resolveSlug");
  render(
    <ApiProvider api={api}>
      <App />
    </ApiProvider>,
  );
  return { api, get, resolve };
}
it("resolves a slug once and keeps UUIDs in API scopes and mutations", async () => {
  const { get, resolve } = setup(
    "/agents/lia?agent.tab=activities&activities.limit=1",
  );
  expect(await screen.findByRole("region", { name: "Agente" })).toBeVisible();
  expect(resolve).toHaveBeenCalledWith("agents", "lia");
  expect(resolve).toHaveBeenCalledTimes(1);
  expect(get.mock.calls.every(([, id]) => /^[0-9a-f-]{36}$/.test(id))).toBe(
    true,
  );
  await userEvent.click(
    await screen.findByRole("button", { name: "Configurar" }),
  );
  expect(location.pathname).toBe("/agents/lia/settings");
  await userEvent.click(await screen.findByRole("button", { name: "Fechar" }));
  expect(location.search).toContain("agent.tab=activities");
});
it("canonicalizes old UUID routes and nested origins without adding history entries", async () => {
  const from = `/agents/${ids.agent}?agent.tab=activities&activities.offset=1`;
  setup(`/tasks/${ids.task}?tab=plans&from=${encodeURIComponent(from)}`);
  const length = history.length;
  await screen.findByRole("heading", { name: "Plano atual" });
  await waitFor(() =>
    expect(location.pathname).toBe("/tasks/mapear-a-jornada-de-primeiro-uso"),
  );
  expect(new URLSearchParams(location.search).get("from")).toBe(
    "/agents/lia?agent.tab=activities&activities.offset=1",
  );
  expect(history.length).toBe(length);
  await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
  expect(await screen.findByRole("region", { name: "Agente" })).toBeVisible();
  expect(location.pathname).toBe("/agents/lia");
  expect(location.search).toContain("activities.offset=1");
});
it("shows missing slugs explicitly without listing unrelated entities", async () => {
  setup("/teams/does-not-exist");
  expect(await screen.findByText("Registro não encontrado.")).toBeVisible();
  expect(screen.queryByRole("region", { name: "Time" })).toBeNull();
});
