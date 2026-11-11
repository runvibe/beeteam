import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { ApiError } from "@/api/types";
import { ConversationComposer } from "./conversation-composer";
it("selects a team profile by name and submits its stable ID with a navigable mention", async () => {
  const seed = makeSeed(),
    task = seed.tasks[0];
  const api = createMockApi({ delay: 0, seed });
  const post = vi.spyOn(api, "createComment");
  render(
    <ApiProvider api={api}>
      <ConversationComposer taskId={task.id} />
    </ApiProvider>,
  );
  await userEvent.type(screen.getByRole("textbox", { name: "Mensagem" }), "@");
  const team = seed.teams.find(
    (team) =>
      team.id ===
      seed.boards.find((board) => board.id === task.boardId)!.teamId,
  )!;
  const agent = seed.agents.find((agent) => agent.id === team.leaderId)!;
  await userEvent.click(
    await screen.findByRole("button", { name: agent.name }),
  );
  expect(screen.getByRole("textbox")).toHaveFocus();
  await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
  expect(post.mock.calls[0][1].mentionedAgentIds).toEqual([agent.id]);
  expect(post.mock.calls[0][1].body).toContain(`/agents/${agent.slug}`);
  await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));
});
it("retries a failed result with the exact original payload, version and idempotency key", async () => {
  const seed = makeSeed(),
    task = seed.tasks[0],
    api = createMockApi({ delay: 0, seed });
  const original = api.createComment.bind(api);
  const post = vi
    .spyOn(api, "createComment")
    .mockRejectedValueOnce(new Error("isolated request failure"))
    .mockImplementation(original);
  render(
    <ApiProvider api={api}>
      <ConversationComposer taskId={task.id} />
    </ApiProvider>,
  );
  await userEvent.type(
    screen.getByRole("textbox", { name: "Mensagem" }),
    "Keep the same request",
  );
  await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await screen.findByRole("alert");
  await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
  expect(post.mock.calls[1]).toEqual(post.mock.calls[0]);
});
it("refreshes the version after a definitive conflict without losing the draft", async () => {
  const seed = makeSeed(),
    task = seed.tasks[0],
    api = createMockApi({ delay: 0, seed });
  const original = api.createComment.bind(api);
  const post = vi
    .spyOn(api, "createComment")
    .mockImplementationOnce(async (_id, _input, version) => {
      await api.patch(
        "tasks",
        task.id,
        { description: "Concurrent worker update" },
        version,
      );
      throw new ApiError(412, "version_mismatch", "Isolated version conflict");
    })
    .mockImplementation(original);
  render(
    <ApiProvider api={api}>
      <ConversationComposer taskId={task.id} />
    </ApiProvider>,
  );
  await userEvent.type(
    screen.getByRole("textbox", { name: "Mensagem" }),
    "Preserve this draft",
  );
  await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await screen.findByRole("alert");
  await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));
  expect(post.mock.calls[1][1]).toEqual(post.mock.calls[0][1]);
  expect(post.mock.calls[1][2]).toBeGreaterThan(post.mock.calls[0][2]);
  expect(post.mock.calls[1][3]).not.toBe(post.mock.calls[0][3]);
});
