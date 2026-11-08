import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { LeaderChat } from "./leader-chat";
import type { LeaderChatApi } from "@/api/leader-chat";
import type { Snapshot } from "@/api/leader-chat-types";
import { ApiError } from "@/api/types";
vi.mock("@/components/names", () => ({
  AgentName: ({ id }: { id: string }) => <span>{id}</span>,
}));
const snapshot: Snapshot = {
  chat: {
    id: "chat",
    teamId: "team",
    leaderAgentId: "leader",
    bindingId: "binding",
    title: "Planning",
    version: 1,
    createdAt: "2026-11-08T00:00:00Z",
    updatedAt: "2026-11-08T00:00:00Z",
  },
  messages: [],
  activeTurn: null,
  pendingApprovals: [],
  toolActivities: [],
  olderMessagesCursor: null,
  eventCursor: "cursor",
};
function api(): LeaderChatApi {
  return {
    runtime: vi.fn().mockResolvedValue({
      agentId: "leader",
      mode: "integrated",
      bindingId: "binding",
      harness: "codex",
      readiness: "ready",
      capabilities: { interrupt: true },
    }),
    list: vi
      .fn()
      .mockResolvedValue({ items: [snapshot.chat], nextCursor: null }),
    snapshot: vi.fn().mockResolvedValue(snapshot),
    stream: vi
      .fn()
      .mockImplementation(
        (_c, _cursor, signal) =>
          new Promise((resolve) =>
            signal.addEventListener("abort", resolve, { once: true }),
          ),
      ),
    send: vi.fn().mockResolvedValue({
      message: {
        id: "message",
        chatId: "chat",
        turnId: "turn",
        role: "user",
        content: "Olá",
        revision: 1,
        taskId: null,
        clientMessageId: "client",
        createdAt: "2026-11-08T00:00:00Z",
      },
      turn: {
        id: "turn",
        chatId: "chat",
        bindingId: "binding",
        status: "queued",
        version: 1,
        failure: null,
        createdAt: "2026-11-08T00:00:00Z",
        updatedAt: "2026-11-08T00:00:00Z",
      },
    }),
    create: vi.fn(),
    createSession: vi.fn(),
    messages: vi.fn(),
    cancel: vi.fn(),
    decide: vi.fn(),
  };
}
it("sends one message, retains focus, and blocks a second send while turn is queued", async () => {
  const transport = api();
  render(
    <LeaderChat
      api={transport}
      teamId="team"
      leaderAgentId="leader"
      leaderVersion={1}
    />,
  );
  const composer = await screen.findByRole("textbox", {
    name: "Mensagem para o líder",
  });
  fireEvent.change(composer, { target: { value: "Olá" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
  await waitFor(() => expect(transport.send).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(composer).toHaveValue(""));
  expect(
    screen.getByRole("button", { name: "Enviar mensagem" }),
  ).toBeDisabled();
  expect(transport.create).not.toHaveBeenCalled();
});
it("keeps external mode explicit and never starts a session automatically", async () => {
  const transport = api();
  vi.mocked(transport.runtime).mockResolvedValue({
    agentId: "leader",
    mode: "external",
    bindingId: "external",
    harness: "codex",
    readiness: "external",
  } as never);
  vi.mocked(transport.list).mockResolvedValue({ items: [], nextCursor: null });
  render(
    <LeaderChat
      api={transport}
      teamId="team"
      leaderAgentId="leader"
      leaderVersion={1}
    />,
  );
  expect(
    await screen.findByText(
      "Continue usando seu assistente com MCP e skills. O Bee Team não controla esse chat externo.",
    ),
  ).toBeInTheDocument();
  expect(transport.createSession).not.toHaveBeenCalled();
});
it("does not fabricate chat support when transport is unavailable", () => {
  render(<LeaderChat teamId="team" leaderAgentId="leader" leaderVersion={1} />);
  expect(
    screen.getByText("O chat integrado requer uma API Bee Team compatível."),
  ).toBeInTheDocument();
});
it("routes a worker approval by its ID and keeps a delayed pending event dismissed", async () => {
  const approval = {
    id: "approval",
    chatId: "chat",
    turnId: "worker-turn",
    bindingId: "worker-binding",
    agentId: "worker",
    taskId: null,
    kind: "command" as const,
    title: "Run tests",
    description: "npm test",
    command: "npm test",
    host: null,
    paths: [],
    status: "pending" as const,
    version: 1,
    expiresAt: "2026-11-08T15:00:00Z",
  };
  const transport = api();
  let emit: Parameters<LeaderChatApi["stream"]>[3] | undefined;
  vi.mocked(transport.snapshot).mockResolvedValue({
    ...snapshot,
    pendingApprovals: [approval],
  });
  vi.mocked(transport.stream).mockImplementation(
    (_id, _cursor, signal, onEvent) => {
      emit = onEvent;
      return new Promise((resolve) =>
        signal.addEventListener("abort", () => resolve(), { once: true }),
      );
    },
  );
  vi.mocked(transport.decide).mockResolvedValue({
    ...approval,
    status: "accepted",
    version: 2,
  });
  render(
    <LeaderChat
      api={transport}
      teamId="team"
      leaderAgentId="leader"
      leaderVersion={1}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Aprovar esta ação" }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Aprovar esta ação" }),
    ).not.toBeInTheDocument(),
  );
  expect(vi.mocked(transport.decide).mock.calls[0].slice(0, 3)).toEqual([
    "chat",
    approval,
    "accept",
  ]);
  act(() =>
    emit?.({
      schemaVersion: 1,
      id: "late",
      chatId: "chat",
      turnId: "worker-turn",
      createdAt: "2026-11-08T00:00:00Z",
      type: "approval.updated",
      data: { approval },
    }),
  );
  expect(
    screen.queryByRole("button", { name: "Aprovar esta ação" }),
  ).not.toBeInTheDocument();
});
it("allows editing a definitively rejected message rather than retrying the old payload", async () => {
  const transport = api();
  vi.mocked(transport.send).mockRejectedValueOnce(
    new ApiError(409, "turn_in_progress", "busy"),
  );
  render(
    <LeaderChat
      api={transport}
      teamId="team"
      leaderAgentId="leader"
      leaderVersion={1}
    />,
  );
  const composer = await screen.findByRole("textbox", {
    name: "Mensagem para o líder",
  });
  fireEvent.change(composer, { target: { value: "first" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
  await screen.findByText("Aguarde o término da execução atual.");
  expect(composer).toBeEnabled();
  fireEvent.change(composer, { target: { value: "second" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
  await waitFor(() => expect(transport.send).toHaveBeenCalledTimes(2));
  expect(vi.mocked(transport.send).mock.calls[1][1].content).toBe("second");
  expect(vi.mocked(transport.send).mock.calls[0][2]).not.toBe(
    vi.mocked(transport.send).mock.calls[1][2],
  );
});
it("retries the exact identity after an ambiguous transport failure", async () => {
  const transport = api();
  vi.mocked(transport.send).mockRejectedValueOnce(
    new ApiError(0, "network_error", "offline"),
  );
  render(
    <LeaderChat
      api={transport}
      teamId="team"
      leaderAgentId="leader"
      leaderVersion={1}
    />,
  );
  const composer = await screen.findByRole("textbox", {
    name: "Mensagem para o líder",
  });
  fireEvent.change(composer, { target: { value: "same" } });
  fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Verificar envio anterior" }),
  );
  await waitFor(() => expect(transport.send).toHaveBeenCalledTimes(2));
  expect(vi.mocked(transport.send).mock.calls[0]).toEqual(
    vi.mocked(transport.send).mock.calls[1],
  );
});
it("requires explicit replacement and sends configured tools when creating an integrated session", async () => {
  const transport = api();
  vi.mocked(transport.runtime).mockResolvedValue({
    agentId: "leader",
    mode: "external",
    bindingId: "external",
    harness: "codex",
    readiness: "external",
  } as never);
  vi.mocked(transport.list).mockResolvedValue({ items: [], nextCursor: null });
  vi.mocked(transport.createSession).mockResolvedValue({
    agentId: "leader",
    bindingId: "new",
    harness: "codex",
    mode: "integrated",
    externalId: "thread",
    projectRoot: "C:\\project",
  });
  render(
    <LeaderChat
      api={transport}
      teamId="team"
      leaderAgentId="leader"
      leaderVersion={4}
    />,
  );
  fireEvent.change(
    await screen.findByLabelText("Diretório do projeto neste computador"),
    { target: { value: "C:\\project" } },
  );
  expect(
    screen.getByRole("button", { name: "Criar sessão integrada" }),
  ).toBeDisabled();
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: "Quero substituir o vínculo atual do agente por uma nova sessão integrada, preservando o histórico.",
    }),
  );
  fireEvent.change(
    screen.getByLabelText(
      "Nomes dos servidores MCP configurados, um por linha",
    ),
    { target: { value: "docs\ndocs\nsearch" } },
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Criar sessão integrada" }),
  );
  await waitFor(() => expect(transport.createSession).toHaveBeenCalledTimes(1));
  expect(vi.mocked(transport.createSession).mock.calls[0].slice(0, 3)).toEqual([
    "leader",
    {
      projectRoot: "C:\\project",
      expectedBindingId: "external",
      toolProfile: {
        webSearch: "live",
        networkAccess: true,
        enabledMcpServers: ["docs", "search"],
        skillRoots: [],
      },
    },
    4,
  ]);
});
it("does not reuse another team chat when the selected team changes", async () => {
  const transport = api();
  const view = render(
    <LeaderChat
      api={transport}
      teamId="team"
      leaderAgentId="leader"
      leaderVersion={1}
    />,
  );
  await screen.findByRole("textbox", { name: "Mensagem para o líder" });
  const second = {
    ...snapshot,
    chat: {
      ...snapshot.chat,
      id: "second",
      teamId: "other",
      leaderAgentId: "other-leader",
    },
  };
  vi.mocked(transport.list).mockResolvedValue({
    items: [second.chat],
    nextCursor: null,
  });
  vi.mocked(transport.snapshot).mockResolvedValue(second);
  view.rerender(
    <LeaderChat
      api={transport}
      teamId="other"
      leaderAgentId="other-leader"
      leaderVersion={1}
    />,
  );
  await waitFor(() =>
    expect(transport.snapshot).toHaveBeenLastCalledWith(
      "second",
      expect.any(AbortSignal),
    ),
  );
});
it.each([['session_busy', false], ['session_creation_uncertain', true]] as const)('handles bootstrap %s without losing the project or retry identity', async (code, uncertain) => {
  const transport = api();
  vi.mocked(transport.runtime).mockResolvedValue({agentId:'leader', mode:'external', bindingId:null, harness:'codex', readiness:'external'} as never);
  vi.mocked(transport.list).mockResolvedValue({items:[],nextCursor:null});
  vi.mocked(transport.createSession).mockRejectedValue(new ApiError(409, code, 'bootstrap'));
  render(<LeaderChat api={transport} teamId="team" leaderAgentId="leader" leaderVersion={1}/>);
  const project = await screen.findByLabelText('Diretório do projeto neste computador');
  fireEvent.change(project,{target:{value:'C:\\project'}});
  fireEvent.click(screen.getByRole('button',{name:'Criar sessão integrada'}));
  await screen.findByRole('alert');
  expect(project).toHaveValue('C:\\project');
  if (uncertain) expect(project).toBeDisabled(); else expect(project).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name: uncertain ? 'Verificar criação da sessão' : 'Criar sessão integrada'}));
  await waitFor(()=>expect(transport.createSession).toHaveBeenCalledTimes(2));
  const calls=vi.mocked(transport.createSession).mock.calls;
  if(uncertain) expect(calls[0]).toEqual(calls[1]); else expect(calls[0][3]).not.toEqual(calls[1][3]);
});
