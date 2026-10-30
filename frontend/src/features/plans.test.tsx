import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, ids, uuid } from "@/api/seed";
import { Plans } from "./plans";
const setup = (seed = makeSeed(), query = "") => {
  window.history.replaceState({}, "", `/tasks/${ids.task}?tab=plans${query}`);
  return render(
    <ApiProvider api={createMockApi({ delay: 0, seed })}>
      <Plans task={seed.tasks[0]} />
    </ApiProvider>,
  );
};
it("shows current first, opens historical Markdown and restores selected revision from URL", async () => {
  const view = setup();
  expect(
    await screen.findByRole("heading", { name: "Plano atual" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Histórico de alterações" }),
  ).toBeNull();
  await userEvent.click(
    await screen.findByRole("button", { name: "Ver revisão 1" }),
  );
  expect(
    screen.getByRole("heading", { name: "Versão anterior · Revisão 1" }),
  ).toBeVisible();
  const query = location.search.replace("?tab=plans", "");
  view.unmount();
  setup(makeSeed(), query);
  expect(
    await screen.findByRole("heading", { name: "Versão anterior · Revisão 1" }),
  ).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Voltar ao plano atual" }),
  );
  expect(screen.getByRole("heading", { name: "Plano atual" })).toBeVisible();
});
it("keeps distinct plans separate and supports empty lists", async () => {
  const seed = makeSeed();
  seed.plans.push({
    ...seed.plans[0],
    id: uuid(899),
    planId: uuid(898),
    title: "Outro plano",
    revision: 50,
    content: "# Outro conteúdo",
  });
  setup(seed);
  expect(
    await screen.findByRole("heading", { name: "Plano atual" }),
  ).toBeVisible();
  expect(screen.getByRole("combobox", { name: "Plano" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "Outro conteúdo" })).toBeNull();
  Element.prototype.scrollIntoView = vi.fn();
  screen.getByRole("combobox", { name: "Plano" }).focus();
  await userEvent.keyboard("{ArrowDown}");
  await userEvent.click(screen.getByRole("option", { name: "Outro plano" }));
  expect(
    await screen.findByRole("heading", { name: "Outro conteúdo" }),
  ).toBeVisible();
});
it("shows empty plans explicitly", async () => {
  const seed = makeSeed();
  seed.plans = [];
  setup(seed);
  expect(await screen.findByText("Nenhum plano registrado")).toBeVisible();
});

it("resolves a selected plan outside the current pagination page", async () => {
  const seed = makeSeed();
  seed.plans.push({
    ...seed.plans[0],
    id: uuid(899),
    planId: uuid(898),
    title: "Outro plano",
    revision: 50,
    content: "# Outro conteúdo",
  });
  setup(seed, `&plans.limit=1&plans.selected=${uuid(898)}`);
  expect(
    await screen.findByRole("heading", { name: "Outro conteúdo" }),
  ).toBeVisible();
  expect(screen.getByText("Revisão 50")).toBeVisible();
});
