import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import type { ManagedAgentApi } from "@/api/managed-agents";
import { ApiError } from "@/api/types";
import { i18n } from "@/i18n";
import { editPlainText } from "@/test/editable";
import { ManagedAgentChat } from "./managed-agent-chat";

beforeEach(async () => {
  await i18n.changeLanguage("en");
  Element.prototype.scrollIntoView = vi.fn();
});
function setup() {
  const api = {
    config: vi.fn().mockResolvedValue({ version: 1, configuration: null }),
    conversations: vi.fn().mockResolvedValue({ items: [{ id: "saved", title: "Saved chat" }], nextCursor: null }),
    requests: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
    messages: vi.fn().mockResolvedValue({ items: [{ id: "old", role: "agent", content: "Saved history" }], nextCursor: null }),
    conversation: vi.fn().mockResolvedValue({ id: "saved", title: "Saved chat", agentId: "leader", teamId: "team" }),
    send: vi.fn(),
    snapshot: vi.fn(),
  } as unknown as ManagedAgentApi;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onConversationChange = vi.fn();
  const view = (generation: number, selected: string | null = null) => (
    <QueryClientProvider client={client}>
      <ManagedAgentChat agentId="leader" teamId="team" api={api} starters
        resetGeneration={generation} freshConversation={!selected}
        conversationId={selected} onConversationChange={onConversationChange} />
    </QueryClientProvider>
  );
  return { api, view, onConversationChange };
}
it("resets draft repeatedly without creating or restoring a session", async () => {
  const { api, view } = setup();
  const mounted = render(view(1));
  const box = await screen.findByRole("textbox", { name: "Message to agent" });
  editPlainText(box, "Unsent draft");
  mounted.rerender(view(2));
  expect(box).toHaveTextContent("");
  editPlainText(box, "Another draft");
  mounted.rerender(view(3));
  expect(box.textContent).toBe("");
  expect(api.messages).not.toHaveBeenCalled();
  expect(api.send).not.toHaveBeenCalled();
  expect(api.snapshot).not.toHaveBeenCalled();
});
it("clears saved history without deleting or changing the saved session", async () => {
  const { api, view, onConversationChange } = setup();
  const mounted = render(view(0, "saved"));
  await screen.findByText("Saved history");
  mounted.rerender(view(1));
  expect(screen.queryByText("Saved history")).toBeNull();
  expect(screen.getByText("Create a team")).toBeVisible();
  expect(onConversationChange).not.toHaveBeenCalled();
  expect(api.send).not.toHaveBeenCalled();
});
it.each(["success", "failure"])("keeps a late first-send %s out of the new blank chat", async (outcome) => {
  const { api, view, onConversationChange } = setup();
  let resolve!: (value: unknown) => void;
  let reject!: (error: unknown) => void;
  vi.mocked(api.send).mockReturnValue(new Promise((yes, no) => { resolve = yes; reject = no; }) as ReturnType<ManagedAgentApi["send"]>);
  const mounted = render(view(1));
  const box = await screen.findByRole("textbox", { name: "Message to agent" });
  editPlainText(box, "First message");
  fireEvent.keyDown(box, { key: "Enter" });
  await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1));
  mounted.rerender(view(2));
  expect(box.textContent).toBe("");
  await act(async () => {
    if (outcome === "success") resolve({ id: "late", conversationId: "created" });
    else reject(new TypeError("Old connection failed"));
  });
  expect(onConversationChange).not.toHaveBeenCalled();
  expect(box.textContent).toBe("");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(api.snapshot).not.toHaveBeenCalled();
  expect(screen.queryByRole("button", { name: "Check send with the same key" })).toBeNull();
  fireEvent.click(screen.getByText("Create a team"));
  expect(api.send).toHaveBeenCalledTimes(2);
});

it("ignores an older-history page that arrives after resetting Home", async () => {
  const { api, view } = setup();
  let resolve!: (value: unknown) => void;
  vi.mocked(api.messages).mockResolvedValueOnce({ items: [], nextCursor: "older" });
  vi.mocked(api.messages).mockReturnValueOnce(new Promise(yes => { resolve = yes; }) as ReturnType<ManagedAgentApi["messages"]>);
  const mounted = render(view(0, "saved"));
  fireEvent.click(await screen.findByRole("button", { name: "Earlier messages" }));
  await waitFor(() => expect(api.messages).toHaveBeenCalledTimes(2));
  mounted.rerender(view(1));
  await act(async () => resolve({ items: [{ id: "late-old", role: "agent", content: "Late old history" }], nextCursor: null }));
  expect(screen.queryByText("Late old history")).toBeNull();
});

it("sends from Home while the previous first message is still pending", async () => {
  const { api, view, onConversationChange } = setup();
  let completeOld!: (value: unknown) => void;
  vi.mocked(api.send).mockReturnValueOnce(new Promise(resolve => { completeOld = resolve; }) as ReturnType<ManagedAgentApi["send"]>)
    .mockReturnValueOnce(new Promise(() => {}));
  const mounted = render(view(1));
  const box = await screen.findByRole("textbox", { name: "Message to agent" });
  editPlainText(box, "Old pending message");
  fireEvent.keyDown(box, { key: "Enter" });
  await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1));
  mounted.rerender(view(2));
  expect(box).toHaveAttribute("contenteditable", "plaintext-only");
  editPlainText(box, "Independent new message");
  fireEvent.keyDown(box, { key: "Enter" });
  await waitFor(() => expect(api.send).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.send).mock.calls[1][1]).toMatchObject({ content: "Independent new message", teamId: "team" });
  expect(vi.mocked(api.send).mock.calls[1][2]).not.toBe(vi.mocked(api.send).mock.calls[0][2]);
  await act(async () => completeOld({ id: "old-request", conversationId: "old-created" }));
  expect(onConversationChange).not.toHaveBeenCalled();
  expect(box.textContent).toBe("Independent new message");
});

it("retains a saved conversation retry across Home and clears it after acknowledgement", async () => {
  const { api, view } = setup();
  vi.mocked(api.send).mockRejectedValueOnce(new TypeError("Receipt lost"))
    .mockResolvedValue({ id: "retry-request", conversationId: "saved" } as Awaited<ReturnType<ManagedAgentApi["send"]>>);
  vi.mocked(api.snapshot).mockResolvedValue({ request: { id: "retry-request", state: "running" }, messages: { items: [] }, approvals: [] } as Awaited<ReturnType<ManagedAgentApi["snapshot"]>>);
  const mounted = render(view(1, "saved"));
  await screen.findByText("Saved history");
  const box = screen.getByRole("textbox", { name: "Message to agent" });
  editPlainText(box, "Original saved request");
  fireEvent.keyDown(box, { key: "Enter" });
  await screen.findByRole("button", { name: "Check send with the same key" });
  mounted.rerender(view(2));
  expect(box.textContent).toBe("");
  mounted.rerender(view(2, "saved"));
  fireEvent.click(await screen.findByRole("button", { name: "Check send with the same key" }));
  await waitFor(() => expect(api.send).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.send).mock.calls[1]).toEqual(vi.mocked(api.send).mock.calls[0]);
  await waitFor(() => expect(box.textContent).toBe(""));
});
it("shows a saved conversation rejection received while Home was active when reopening it", async () => {
  const { api, view } = setup();
  let reject!: (error: unknown) => void;
  vi.mocked(api.send).mockReturnValue(new Promise((_yes, no) => { reject = no; }));
  const mounted = render(view(1, "saved"));
  await screen.findByText("Saved history");
  const box = screen.getByRole("textbox", { name: "Message to agent" });
  editPlainText(box, "Rejected saved request");
  fireEvent.keyDown(box, { key: "Enter" });
  await waitFor(() => expect(api.send).toHaveBeenCalledTimes(1));
  mounted.rerender(view(2));
  await act(async () => reject(new ApiError(422, "invalid_request", "Original request rejected")));
  expect(screen.queryByRole("alert")).toBeNull();
  mounted.rerender(view(2, "saved"));
  expect(await screen.findByRole("alert")).toHaveTextContent("Original request rejected");
  expect(box.textContent).toBe("Rejected saved request");
});
