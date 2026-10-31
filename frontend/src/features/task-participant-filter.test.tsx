import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { FilterBar } from "@/components/filter-bar";
import { TaskParticipantFilter } from "./task-participant-filter";
import type { TaskParticipant } from "@/api/types";

it("loads every participant page without global agents or comment-search constraints", async () => {
  const api = createMockApi({ delay: 0 });
  const item = (actorId: string, agentName: string): TaskParticipant => ({
    actorKind: "agent",
    actorId,
    agentName,
    agentArchived: false,
    agentDeleted: false,
  });
  const participants = vi
    .spyOn(api, "participants")
    .mockResolvedValueOnce({
      items: [item("first", "Participante inicial")],
      offset: 0,
      limit: 100,
      total: 3,
      hasMore: true,
      nextOffset: 100,
    })
    .mockResolvedValueOnce({
      items: [
        { ...item("historical", "Participante histórico"), agentDeleted: true },
        {
          actorKind: "human",
          actorId: null,
          agentName: null,
          agentArchived: false,
          agentDeleted: false,
        },
      ],
      offset: 100,
      limit: 100,
      total: 3,
      hasMore: false,
      nextOffset: null,
    });
  const global = vi.spyOn(api, "list");
  const change = vi.fn();
  render(
    <ApiProvider api={api}>
      <FilterBar onClear={() => {}}>
        <TaskParticipantFilter
          taskId="task"
          actorId=""
          actorKind=""
          onChange={change}
        />
      </FilterBar>
    </ApiProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Autor da fala" }));
  await screen.findByRole("radio", {
    name: "Participante histórico (excluído)",
  });
  expect(participants.mock.calls.map((call) => call[1])).toEqual([
    { offset: 0, limit: 100 },
    { offset: 100, limit: 100 },
  ]);
  expect(global).not.toHaveBeenCalled();
  await userEvent.click(
    screen.getByRole("radio", {
      name: "Pessoas (sem identificação individual)",
    }),
  );
  expect(change).toHaveBeenCalledWith("", "human");
  await userEvent.type(
    screen.getByRole("textbox", { name: "Buscar participantes desta tarefa" }),
    "histórico",
  );
  expect(
    screen.queryByRole("radio", { name: "Participante inicial" }),
  ).toBeNull();
  expect(participants).toHaveBeenCalledTimes(2);
});

it("reports malformed continuation instead of looping or showing global fallback", async () => {
  const api = createMockApi({ delay: 0 });
  const request = vi
    .spyOn(api, "participants")
    .mockResolvedValue({
      items: [],
      offset: 0,
      limit: 100,
      total: 2,
      hasMore: true,
      nextOffset: 0,
    });
  render(
    <ApiProvider api={api}>
      <FilterBar onClear={() => {}}>
        <TaskParticipantFilter
          taskId="broken"
          actorId=""
          actorKind=""
          onChange={() => {}}
        />
      </FilterBar>
    </ApiProvider>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Autor da fala" }));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("paginação inválida"),
  );
  expect(request).toHaveBeenCalledTimes(1);
});
