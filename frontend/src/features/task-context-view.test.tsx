import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids } from "@/api/seed";
afterEach(() => vi.unstubAllGlobals());
it("keeps error feedback visible on a direct details view without task data", async () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  window.history.replaceState({}, "", `/tasks/${ids.task}?task.view=details`);
  const api = createMockApi({ delay: 0 });
  vi.spyOn(api, "get").mockRejectedValue(new Error("Task indisponível"));
  render(<ApiProvider api={api}><App /></ApiProvider>);
  expect(await screen.findByText("Task indisponível")).toBeVisible();
});
function setup(details = false) {
  let mobile = true;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (q: string) => ({
    get matches() {
      return q.includes("max-width: 1055")
        ? mobile
        : q.includes("min-width: 1056")
          ? !mobile
          : false;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  }));
  window.history.replaceState(
    {},
    "",
    `/tasks/${ids.task}?tab=comments&comments.offset=10&from=%2Fboards${details ? "&task.view=details" : ""}`,
  );
  render(
    <ApiProvider api={createMockApi({ delay: 0 })}>
      <App />
    </ApiProvider>,
  );
  return {
    resize: (value: boolean) =>
      act(() => {
        mobile = value;
        listeners.forEach((fn) => fn());
      }),
  };
}
it("opens a separate view without remounting task content, and supports history return", async () => {
  setup();
  await screen.findByRole("tab", { name: "Conversa" });
  const primary = document.querySelector(".task-detail-primary")!;
  await userEvent.click(
    screen.getByRole("button", { name: "Detalhes da tarefa" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Detalhes da tarefa" }),
  ).toHaveFocus();
  expect(primary).toHaveAttribute("hidden");
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(new URLSearchParams(location.search).get("comments.offset")).toBe(
    "10",
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Voltar à tarefa" }),
  );
  await waitFor(() => expect(primary).not.toHaveAttribute("hidden"));
  expect(document.querySelector(".task-detail-primary")).toBe(primary);
  expect(
    screen.getByRole("button", { name: "Detalhes da tarefa" }),
  ).toHaveFocus();
});
it("supports direct links and preserves the same context controls across resize", async () => {
  const { resize } = setup(true);
  const autonomy = await screen.findByRole("combobox", {
    name: "Configuração individual",
  });
  resize(false);
  expect(document.querySelector(".task-detail-primary")).not.toHaveAttribute(
    "hidden",
  );
  expect(
    screen.getByRole("combobox", { name: "Configuração individual" }),
  ).toBe(autonomy);
  resize(true);
  await userEvent.click(
    screen.getByRole("button", { name: "Voltar à tarefa" }),
  );
  await waitFor(() =>
    expect(new URLSearchParams(location.search).has("task.view")).toBe(false),
  );
  expect(new URLSearchParams(location.search).get("tab")).toBe("comments");
  expect(new URLSearchParams(location.search).get("from")).toBe("/boards");
});
