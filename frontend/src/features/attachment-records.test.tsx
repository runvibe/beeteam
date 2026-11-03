import { App } from "@/App";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, uuid } from "@/api/seed";
import { AttachmentRecords } from "./attachment-records";
afterEach(() => vi.unstubAllGlobals());
it("combines URL filters literally, includes removed metadata and clears standard filters", async () => {
  const seed = makeSeed();
  const row = seed.attachments[0];
  seed.attachments = [
    {
      ...row,
      id: "match",
      originalName: "Relatório_100%.PDF",
      mediaType: "application/pdf",
      deletedAt: "2026-11-03T12:00:00Z",
    },
    {
      ...row,
      id: "other",
      originalName: "Relatório_100%.txt",
      mediaType: "text/plain",
    },
  ];
  const api = createMockApi({ delay: 0, seed });
  const list = vi.spyOn(api, "list");
  window.history.replaceState(
    {},
    "",
    `/tasks/example?attachments.fileName=100%25&attachments.mediaType=application%2Fpdf&attachments.includeRemoved=true`,
  );
  render(
    <ApiProvider api={api}>
      <AttachmentRecords taskId={row.taskId}>
        {(r) => <p>{r.originalName}</p>}
      </AttachmentRecords>
    </ApiProvider>,
  );
  await screen.findByText("Relatório_100%.PDF");
  for (const [name, icon] of [
    ["Nome do arquivo", "search"],
    ["Tipo de arquivo", "file-type"],
    ["Arquivos removidos", "trash-2"],
  ]) {
    const trigger = screen.getByRole("button", { name });
    expect(trigger).toHaveAttribute("data-active", "true");
    expect(trigger.querySelector(`.lucide-${icon}`)).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  }
  expect(screen.queryByText("Relatório_100%.txt")).toBeNull();
  expect(list.mock.calls[0][2]).toMatchObject({
    fileName: "100%",
    mediaType: "application/pdf",
    includeRemoved: true,
    limit: 10,
    offset: 0,
  });
  await userEvent.click(screen.getByRole("button", { name: "Limpar filtros" }));
  await screen.findByText("Relatório_100%.txt");
  await waitFor(() =>
    expect(screen.queryByText("Relatório_100%.PDF")).toBeNull(),
  );
  expect(location.search).not.toContain("attachments.");
});

it("applies an arbitrary exact MIME only on submit and keeps filename search in the URL", async () => {
  window.history.replaceState({}, "", "/tasks/example?tab=attachments");
  const seed = makeSeed();
  const api = createMockApi({ delay: 0, seed });
  const list = vi.spyOn(api, "list");
  render(
    <ApiProvider api={api}>
      <AttachmentRecords taskId={seed.attachments[0].taskId}>
        {(r) => <p>{r.originalName}</p>}
      </AttachmentRecords>
    </ApiProvider>,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Tipo de arquivo" }),
  );
  const input = screen.getByLabelText("Tipo MIME exato");
  await userEvent.type(input, "pdf");
  expect(input).toBeInvalid();
  await userEvent.click(screen.getByRole("button", { name: "Aplicar tipo" }));
  expect(list.mock.calls.every((call) => !call[2]?.mediaType)).toBe(true);
  await userEvent.clear(input);
  await userEvent.type(input, "application/vnd.custom+json");
  expect(list.mock.calls.every((call) => !call[2]?.mediaType)).toBe(true);
  expect(input).toBeValid();
  await userEvent.click(screen.getByRole("button", { name: "Aplicar tipo" }));
  await waitFor(() =>
    expect(list.mock.calls.at(-1)?.[2]?.mediaType).toBe(
      "application/vnd.custom+json",
    ),
  );
  expect(
    new URLSearchParams(location.search).get("attachments.mediaType"),
  ).toBe("application/vnd.custom+json");
});

it.each([true, false])(
  "keeps attachment infinite batches and removed downloads safe (desktop=%s)",
  async (desktop) => {
    const seed = makeSeed();
    const task = seed.tasks[0];
    seed.attachments = Array.from({ length: 25 }, (_, i) => ({
      ...seed.attachments[0],
      id: uuid(9300 + i),
      taskId: task.id,
      originalName: `File ${i}`,
      deletedAt: i === 0 ? "2026-11-03T12:00:00Z" : null,
    }));
    window.history.replaceState(
      {},
      "",
      `/tasks/${task.id}?tab=attachments&attachments.includeRemoved=true`,
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query === "(min-width: 1056px)" ? desktop : false,
        addEventListener() {},
        removeEventListener() {},
      })),
    );
    let enter = () => {};
    let root: Element | Document | null | undefined;
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        callback: IntersectionObserverCallback;
        options?: IntersectionObserverInit;
        constructor(
          callback: IntersectionObserverCallback,
          options?: IntersectionObserverInit,
        ) {
          this.callback = callback;
          this.options = options;
        }
        observe(target: Element) {
          if (
            target.getAttribute("data-task-record-sentinel") === "attachments"
          ) {
            root = this.options?.root;
            enter = () =>
              this.callback(
                [{ isIntersecting: true }] as IntersectionObserverEntry[],
                {} as IntersectionObserver,
              );
          }
        }
        disconnect() {}
      },
    );
    const api = createMockApi({ delay: 0, seed });
    const list = vi.spyOn(api, "list");
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    );
    await screen.findByText("File 9");
    expect(
      screen.getAllByRole("button", { name: "Baixar arquivo" })[0],
    ).toBeDisabled();
    expect(root).toBe(
      desktop ? document.querySelector("[data-detail-scroll]") : null,
    );
    act(() => enter());
    await screen.findByText("File 19");
    act(() => enter());
    await screen.findByText("File 24");
    act(() => enter());
    const calls = list.mock.calls.filter((call) => call[0] === "attachments");
    expect(calls.map((call) => call[2]?.offset)).toEqual([0, 10, 20]);
    expect(calls.every((call) => call[2]?.limit === 10)).toBe(true);
    expect(
      screen.getAllByRole("button", { name: "Baixar arquivo" }),
    ).toHaveLength(25);
  },
);
