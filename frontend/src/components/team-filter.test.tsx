import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import type { BeeApi, Page, Team } from "@/api/types";
import { TeamFilter } from "./team-filter";

it("loads five recent teams, searches globally and ignores an aborted old search", async () => {
  const api = createMockApi({ delay: 0 });
  const sample = (await api.list("teams")).items[0];
  let oldSignal: AbortSignal | undefined;
  let finish: (page: Page<Team>) => void = () => {};
  const list = vi.fn((_resource, _scope, filters, signal) => {
    if (filters.name === "old") {
      oldSignal = signal;
      return new Promise((resolve) => {
        finish = resolve as typeof finish;
      });
    }
    return Promise.resolve({
      items: Array.from({ length: 8 }, (_, index) => ({
        ...sample,
        id: `result-${index}`,
        name: `New ${index}`,
      })),
      total: 8,
      offset: 0,
      limit: 5,
      hasMore: true,
      nextOffset: 5,
    });
  });
  api.list = list as BeeApi["list"];
  render(
    <ApiProvider api={api}>
      <TeamFilter label="Time" value="" onChange={vi.fn()} />
    </ApiProvider>,
  );
  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(5));
  expect(list).toHaveBeenLastCalledWith(
    "teams",
    "",
    { limit: 5, offset: 0, sortBy: "createdAt", sortOrder: "desc" },
    expect.any(AbortSignal),
  );
  const input = screen.getByRole("combobox");
  const user = userEvent.setup();
  await user.type(input, "old");
  await waitFor(() => expect(oldSignal).toBeDefined());
  await user.clear(input);
  await user.type(input, "new");
  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(5));
  expect(oldSignal?.aborted).toBe(true);
  expect(list).toHaveBeenLastCalledWith(
    "teams",
    "",
    { name: "new", limit: 5, offset: 0, sortBy: "name" },
    expect.any(AbortSignal),
  );
  await act(async () =>
    finish({
      items: [{ ...sample, name: "Obsolete" }],
      total: 1,
      offset: 0,
      limit: 5,
      hasMore: false,
      nextOffset: null,
    }),
  );
  expect(
    screen.queryByRole("option", { name: "Obsolete" }),
  ).not.toBeInTheDocument();
  expect(screen.getAllByRole("option")).toHaveLength(5);
  await user.clear(input);
  await waitFor(() =>
    expect(screen.getByText("Times criados mais recentemente.")).toBeVisible(),
  );
  expect(list).toHaveBeenCalledWith(
    "teams",
    "",
    { limit: 5, offset: 0, sortBy: "createdAt", sortOrder: "desc" },
    expect.any(AbortSignal),
  );
});
