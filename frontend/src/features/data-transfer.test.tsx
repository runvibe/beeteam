import { afterEach, expect, it, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DataTransferPanel } from "./data-transfer";
afterEach(() => {
  cleanup();
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
