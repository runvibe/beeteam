import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import {
  ChatSessionInformation,
  sessionInformationMode,
} from "./chat-session-information";
const mock = vi.hoisted(() => ({
  conversation: vi.fn(async (id: string) => ({
    id,
    title: id === "one" ? "First session" : "Second session",
    agentId: "agent",
    boardId: id === "one" ? "board" : null,
    readOnly: false,
    createdAt: "2026-11-23T10:00:00Z",
    updatedAt: "2026-11-23T11:00:00Z",
  })),
}));
vi.mock("@/api/context", () => ({
  useApi: () => ({ managedAgents: { conversation: mock.conversation } }),
  useEntity: (resource: string, id: string) => ({
    data: id
      ? {
          name:
            resource === "teams"
              ? "Design team"
              : id === "board"
                ? "Design board"
                : id === "leader"
                  ? "Team leader"
                  : "Session agent",
          leaderId: "leader",
        }
      : undefined,
    isPending: false,
  }),
}));
it("docks only when the chat has room and exceeds half the window", () => {
  expect(sessionInformationMode(500, 1000)).toBe("floating");
  expect(sessionInformationMode(700, 1000)).toBe("docked");
  expect(sessionInformationMode(320, 320)).toBe("floating");
});
it("shows session data without editing controls and refreshes after switching chats", async () => {
  const close = vi.fn();
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const content = (id: string) => (
    <QueryClientProvider client={client}>
      <ChatSessionInformation
        teamId="team"
        conversationId={id}
        mode="floating"
        onClose={close}
      />
    </QueryClientProvider>
  );
  const view = render(content("one"));
  await screen.findByText("First session");
  expect(screen.getByText("Design team")).toBeInTheDocument();
  expect(screen.getByText("Team leader")).toBeInTheDocument();
  expect(screen.getByText("Session agent")).toBeInTheDocument();
  expect(screen.getByText("Design board")).toBeInTheDocument();
  expect(screen.queryByRole("textbox")).toBeNull();
  view.rerender(content("two"));
  await screen.findByText("Second session");
  expect(screen.queryByText("Design board")).toBeNull();
  expect(screen.getByText("Sem board")).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Fechar informações da sessão" }),
  );
  expect(close).toHaveBeenCalledOnce();
});
