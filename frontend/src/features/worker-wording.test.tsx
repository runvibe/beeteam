import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed, uuid } from "@/api/seed";
import { setLocalePreference } from "@/i18n";
import { TaskConversation } from "./task-conversation";

it.each(["en", "pt"] as const)(
  "uses Worker for the current role while preserving authored text in %s",
  async (locale) => {
    setLocalePreference(locale);
    const seed = makeSeed();
    seed.agents[0].name = "Collaborator escrito pelo usuário";
    const taskId = seed.tasks[0].id;
    seed.comments = [
      {
        id: uuid(9876),
        taskId,
        actorKind: "agent",
        actorId: seed.agents[0].id,
        body: "Texto histórico: colaborador e Collaborator devem permanecer.",
        createdAt: "2026-10-30T12:00:00Z",
        deletedAt: null,
      },
    ];
    render(
      <ApiProvider api={createMockApi({ delay: 0, seed })}>
        <TaskConversation taskId={taskId} />
      </ApiProvider>,
    );
    expect(
      await screen.findByText(
        locale === "en" ? "Worker · current role" : "Worker · papel atual",
      ),
    ).toBeVisible();
    expect(
      screen.getByText("Collaborator escrito pelo usuário"),
    ).toBeVisible();
    expect(
      screen.getByText(
        "Texto histórico: colaborador e Collaborator devem permanecer.",
      ),
    ).toBeVisible();
  },
);
