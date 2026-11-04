import { render, screen, within, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { OverviewUsageCards } from "./overview-usage-cards";

it("keeps both cards empty while paging, then shows named icons and presence rather than tokens", async () => {
  const api = createMockApi({ delay: 0 });
  let finish!: (value: unknown) => void;
  vi.spyOn(api, "usage").mockImplementation(
    async () =>
      (await new Promise((resolve) => {
        finish = resolve;
      })) as never,
  );
  render(
    <ApiProvider api={api}>
      <OverviewUsageCards taskId="task" version={1} />
    </ApiProvider>,
  );
  expect(
    screen.getByRole("region", { name: "Harnesses utilizados" }),
  ).toBeVisible();
  expect(
    screen.getByRole("region", { name: "Modelos utilizados" }),
  ).toBeVisible();
  expect(screen.queryByRole("meter")).toBeNull();
  await act(async () =>
    finish({
      timeline: {
        items: [
          {
            summaryId: "s",
            usageReport: {
              entries: [
                {
                  observation: {
                    harness: "Codex CLI",
                    modelId: "model-A",
                    totalTokens: "900000000",
                  },
                },
                { observation: { harness: "Codex", modelId: "model-A" } },
                { observation: { harness: "Custom", modelId: null } },
              ],
            },
          },
        ],
        total: 1,
        offset: 0,
        limit: 100,
        truncated: false,
      },
    }),
  );
  expect(await screen.findByRole("button", { name: "Codex" })).toBeVisible();
  expect(screen.getAllByRole("button", { name: "Codex" })).toHaveLength(1);
  expect(
    within(screen.getByRole("button", { name: "Custom" })).queryByRole("img"),
  ).toBeNull();
  expect(
    screen.getByRole("meter", { name: "Presença de model-A" }),
  ).toHaveAttribute("aria-valuenow", "1");
  expect(screen.queryByText(/900/)).toBeNull();
  await userEvent.hover(screen.getByRole("button", { name: "Codex" }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Codex");
});

it("preserves both structures for legitimate empty evidence", async () => {
  const api = createMockApi({ delay: 0 });
  vi.spyOn(api, "usage").mockResolvedValue({
    timeline: { items: [], total: 0, offset: 0, limit: 100, truncated: false },
  } as never);
  render(
    <ApiProvider api={api}>
      <OverviewUsageCards taskId="empty" version={1} />
    </ApiProvider>,
  );
  expect(await screen.findByText("Nenhum harness registrado")).toBeVisible();
  expect(screen.getByText("Nenhum modelo registrado")).toBeVisible();
});
