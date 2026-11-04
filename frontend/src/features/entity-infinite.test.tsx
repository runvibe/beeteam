import userEvent from "@testing-library/user-event";
import { DetailRecordList } from "./detail-record-list";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "@/App";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { ids } from "@/api/seed";

afterEach(() => vi.restoreAllMocks());
it.each(["activities", "chats", "members", "boards"] as const)(
  "automatically appends bounded %s pages without pagers",
  async (resource) => {
    const api = createMockApi({ delay: 0 });
    const original = api.list.bind(api);
    const first = await original(
      resource,
      resource === "members"
        ? ids.team
        : resource === "boards"
          ? ""
          : ids.agent,
      { limit: 1 },
    );
    const row = first.items[0];
    const key =
      resource === "activities"
        ? "taskId"
        : resource === "members"
          ? "agentId"
          : "id";
    const list = vi
      .spyOn(api, "list")
      .mockImplementation(async (kind, scope, filters, signal) => {
        if (kind !== resource) return original(kind, scope, filters, signal);
        const offset = filters?.offset ?? 0;
        return {
          items: [
            {
              ...row,
              [key]: offset
                ? ids.agent + "-next"
                : row[key as keyof typeof row],
              ...(resource === "chats"
                ? { label: offset ? "Next chat" : "First chat" }
                : {}),
            },
          ],
          offset,
          limit: 1,
          total: 2,
          hasMore: offset === 0,
          nextOffset: offset === 0 ? 1 : null,
        } as never;
      });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 60,
      height: 60,
      left: 0,
      right: 400,
      width: 400,
    } as DOMRect);
    const url =
      resource === "activities" || resource === "chats"
        ? `/agents/${ids.agent}?agent.tab=${resource}&${resource}.limit=1&${resource}.offset=8`
        : `/teams/${ids.team}?members.limit=1&managedBoards.limit=1`;
    history.replaceState({}, "", url + "&from=%2Fagents");
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    );
    await waitFor(() =>
      expect(
        list.mock.calls
          .filter((c) => c[0] === resource)
          .map((c) => c[2]?.offset),
      ).toEqual([0, 1]),
    );
    expect(screen.queryByRole("navigation", { name: "Paginação" })).toBeNull();
    expect(new URLSearchParams(location.search).get("from")).toBe("/agents");
  },
);

it.each(["activities", "chats", "members", "boards"] as const)(
  "preserves %s rows, total and order through failed continuation and overlap",
  async (resource) => {
    const api = createMockApi({ delay: 0 });
    const key =
      resource === "activities"
        ? "taskId"
        : resource === "members"
          ? "agentId"
          : "id";
    let attempts = 0;
    const list = vi.spyOn(api, "list").mockImplementation(async (_r, _s, f) => {
      const offset = f?.offset ?? 0;
      if (offset && ++attempts === 1) throw Error("Temporary failure");
      return {
        items: (offset ? ["first", "second"] : ["first"]).map((id) => ({
          [key]: id,
          name: id,
        })),
        offset,
        limit: 1,
        total: 2,
        hasMore: !offset,
        nextOffset: offset ? null : 1,
      } as never;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 0,
      bottom: 60,
      height: 60,
      left: 0,
      right: 400,
      width: 400,
    } as DOMRect);
    render(
      <ApiProvider api={api}>
        <DetailRecordList
          resource={resource}
          scope="test"
          filters={{ limit: 1 }}
          empty="Empty"
          countLabel="records"
        >
          {(row) => <p>{(row as unknown as { name: string }).name}</p>}
        </DetailRecordList>
      </ApiProvider>,
    );
    await screen.findByRole("alert");
    expect(screen.getByText("first")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: /Tentar novamente/i }),
    );
    await screen.findByText("second");
    expect(screen.getAllByText("first")).toHaveLength(1);
    expect(screen.getByText(/2.*2 records/)).toBeVisible();
    expect(list.mock.calls.map((c) => c[2]?.offset)).toEqual([0, 1, 1]);
    expect(
      screen
        .getByText("first")
        .compareDocumentPosition(screen.getByText("second")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  },
);
