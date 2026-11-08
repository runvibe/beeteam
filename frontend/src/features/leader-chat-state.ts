import type {
  Approval,
  ChatEvent,
  Message,
  Snapshot,
  Turn,
} from "@/api/leader-chat-types";
type ChatState = Snapshot & { approvalVersions?: Record<string, number> };
export function mergeMessages(current: Message[], incoming: Message[]) {
  const map = new Map(current.map((m) => [m.id, m]));
  for (const m of incoming)
    if (!map.has(m.id) || map.get(m.id)!.revision < m.revision)
      map.set(m.id, m);
  return [...map.values()].sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}
export function turnBlocksSending(status?: Turn["status"]) {
  return !!status && !["completed", "cancelled", "failed"].includes(status);
}
export function applyApproval(state: ChatState, approval: Approval): ChatState {
  const version =
    state.approvalVersions?.[approval.id] ??
    state.pendingApprovals.find((a) => a.id === approval.id)?.version ??
    0;
  if (version >= approval.version) return state;
  return {
    ...state,
    approvalVersions: {
      ...state.approvalVersions,
      [approval.id]: approval.version,
    },
    pendingApprovals: [
      ...state.pendingApprovals.filter((a) => a.id !== approval.id),
      ...(approval.status === "pending" ? [approval] : []),
    ],
  };
}
export function applyTurn(state: ChatState, turn: Turn): ChatState {
  const current = state.activeTurn;
  if (
    current &&
    (current.id === turn.id
      ? current.version >= turn.version
      : current.createdAt > turn.createdAt ||
        (current.createdAt === turn.createdAt && current.id > turn.id))
  )
    return state;
  return { ...state, activeTurn: turn };
}
export function applyChatEvent(state: ChatState, event: ChatEvent): ChatState {
  if (event.chatId !== state.chat.id) return state;
  let next = { ...state, eventCursor: event.id };
  switch (event.type) {
    case "message.updated":
      next.messages = mergeMessages(state.messages, [event.data.message]);
      break;
    case "turn.updated": {
      next = applyTurn(next, event.data.turn);
      break;
    }
    case "tool.updated": {
      const tool = event.data.tool,
        existing = state.toolActivities.find((t) => t.id === tool.id);
      if (!existing || existing.revision < tool.revision)
        next.toolActivities = [
          ...state.toolActivities.filter((t) => t.id !== tool.id),
          tool,
        ];
      break;
    }
    case "approval.updated": {
      next = applyApproval(next, event.data.approval);
      break;
    }
  }
  return next;
}
