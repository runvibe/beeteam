import { setLocalePreference } from "@/i18n";
import { afterEach, expect, it, vi } from "vitest";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DataTransferPanel, DataTransferSettings } from "./data-transfer";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(Element.prototype, "scrollIntoView");
  localStorage.clear();
  vi.unstubAllGlobals();
});
function mount() {
  render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { queries: { retry: false } } })
      }
    >
      <DataTransferPanel />
    </QueryClientProvider>,
  );
}
it("resumes a persisted preview and requires precision approval and confirmation", async () => {
  localStorage.setItem("bee-transfer-job", "job");
  const fetcher = vi.fn(async (input: string) => ({
    ok: true,
    json: async () =>
      input.endsWith("/jobs/job")
        ? {
            id: "job",
            kind: "import",
            state: "ready",
            stage: "validated",
            records: 2,
            preview: {
              manifest: {
                sourceDriver: "sqlite",
                snapshotAt: "today",
                entries: {},
              },
              destinationDriver: "postgres",
              destinationEmpty: true,
              precisionChanges: 2,
              confirmationToken: "token",
              archiveSha256: "hash",
              destinationId: "destination",
            },
          }
        : {
            enabled: true,
            limits: {
              compressed: 1000,
              expanded: 2000,
              entries: 100,
              line: 100,
              seconds: 60,
            },
            retentionSeconds: 3600,
          },
  }));
  vi.stubGlobal("fetch", fetcher);
  mount();
  const restore = await screen.findByRole("button", {
    name: "Restaurar dados",
  });
  expect(restore).toBeDisabled();
  await userEvent.click(
    screen.getByRole("checkbox", { name: /Confirmo a restauração/ }),
  );
  expect(restore).toBeDisabled();
  await userEvent.click(
    screen.getByRole("checkbox", { name: /Aceito truncar/ }),
  );
  expect(restore).toBeEnabled();
  await userEvent.click(restore);
  await waitFor(() =>
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining("/imports/job/restore"),
      expect.objectContaining({
        body: expect.stringContaining(
          '"timestampPolicy":"truncate_to_microseconds"',
        ),
      }),
    ),
  );
});
it("shows disabled state without enabling import controls", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => ({ enabled: false }) })),
  );
  mount();
  expect(
    await screen.findByText(/Transferência desativada/),
  ).toBeInTheDocument();
  expect(screen.queryByLabelText("Arquivo de importação")).toBeNull();
});

it.each(["getter", "methods"])(
  "keeps the real global Settings language selector usable with denied storage (%s)",
  async (denial) => {
    setLocalePreference("en");
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: () => {},
    });
    const denied = () => {
      throw new DOMException("Storage denied", "SecurityError");
    };
    if (denial === "getter")
      vi.spyOn(window, "localStorage", "get").mockImplementation(denied);
    else {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(denied);
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(denied);
    }
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ enabled: false }) })),
    );
    render(
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <ApiProvider api={createMockApi({ delay: 0 })}>
          <DataTransferSettings />
        </ApiProvider>
      </QueryClientProvider>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Global settings" }),
    );
    const selector = await screen.findByRole("combobox", { name: "Language" });
    fireEvent.keyDown(selector, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: "Português" }));
    expect(
      await screen.findByRole("combobox", { name: "Idioma" }),
    ).toHaveTextContent("Português");
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(await screen.findByText(/Transferência desativada/)).toBeVisible();
  },
);

it("retains a successful export in the session when storage persistence is denied", async () => {
  setLocalePreference("en");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Storage denied", "SecurityError");
  });
  const job = {
    id: "session-export",
    kind: "export",
    state: "ready",
    stage: "ready",
    records: 1,
    bytes: 1,
    error: null,
    preview: null,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => ({
      ok: true,
      json: async () =>
        input.endsWith("/exports") || input.endsWith("/jobs/session-export")
          ? job
          : {
              enabled: true,
              limits: {
                compressed: 1000,
                expanded: 2000,
                entries: 100,
                line: 100,
                seconds: 60,
              },
              retentionSeconds: 3600,
            },
    })),
  );
  mount();
  await userEvent.click(
    await screen.findByRole("button", { name: "Export data" }),
  );
  expect(
    await screen.findByRole("link", { name: "Download .beeteam.zip" }),
  ).toHaveAttribute("href", expect.stringContaining("session-export"));
  expect(screen.queryByRole("alert")).toBeNull();
});
