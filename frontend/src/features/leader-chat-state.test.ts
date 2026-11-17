import { expect, it } from "vitest";
import {
  mergeMessages,
  applyChatEvent,
  applyApproval,
  turnBlocksSending,
} from "./leader-chat-state";
import type {
  Message,
  Snapshot,
  ChatEvent,
  Approval,
} from "@/api/leader-chat-types";
const message = (revision: number, content: string): Message => ({
  id: "m",
  chatId: "c",
  turnId: "t",
  role: "assistant",
  content,
  revision,
  taskId: null,
  clientMessageId: null,
  createdAt: "2026-11-08T00:00:00Z",
});
it("does not overwrite streamed content with older paginated history", () => {
  expect(mergeMessages([message(3, "new")], [message(1, "old")])).toEqual([
    message(3, "new"),
  ]);
});
it("ignores events for another chat and deduplicates revisions", () => {
  const snapshot = {
    chat: { id: "c" },
    messages: [message(3, "new")],
    toolActivities: [],
    pendingApprovals: [],
    activeTurn: null,
    eventCursor: "1",
  } as unknown as Snapshot;
  const event = {
    schemaVersion: 1,
    id: "2",
    chatId: "other",
    turnId: "t",
    type: "message.updated",
    data: { message: message(4, "foreign") },
    createdAt: "2026-11-08T00:00:00Z",
  } as ChatEvent;
  expect(applyChatEvent(snapshot, event)).toBe(snapshot);
});
it("keeps uncertain and approval waiting turns blocked, but allows confirmed terminal outcomes", () => {
  expect(turnBlocksSending("uncertain")).toBe(true);
  expect(turnBlocksSending("waiting_approval")).toBe(true);
  expect(turnBlocksSending("completed")).toBe(false);
  expect(turnBlocksSending("cancelled")).toBe(false);
});
it("does not resurrect a decided approval from a delayed pending event", () => {
  const state = {
    chat: { id: "c" },
    pendingApprovals: [],
  } as unknown as Snapshot;
  const approved = {
    id: "a",
    chatId: "c",
    version: 2,
    status: "accepted",
  } as Approval;
  const pending = { ...approved, version: 1, status: "pending" } as Approval;
  expect(
    applyApproval(applyApproval(state, approved), pending).pendingApprovals,
  ).toEqual([]);
});
it("does not downgrade a completed tool from replayed older state", () => {
  const tool = {
    id: "tool",
    turnId: "t",
    name: "search",
    status: "completed" as const,
    summary: "done",
    revision: 2,
  };
  const state = {
    chat: { id: "c" },
    toolActivities: [tool],
  } as unknown as Snapshot;
  const event = {
    id: "2",
    chatId: "c",
    type: "tool.updated",
    data: { tool: { ...tool, status: "running", revision: 1 } },
  } as ChatEvent;
  expect(applyChatEvent(state, event).toolActivities).toEqual([tool]);
});
