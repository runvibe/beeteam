import type { ManagedConversation } from "@/api/managed-agents";
import type { SessionGroupKey } from "@/state/sessions-sidebar";

export type SessionNames = {
  team: (id: string) => string;
  board: (id: string | null) => string;
  agent: (id: string) => string;
};
export type SessionGroup = {
  /** Stable path key, e.g. "team:<id>/board:none". */
  key: string;
  kind: SessionGroupKey;
  label: string;
  count: number;
  groups: SessionGroup[];
  items: ManagedConversation[];
};

function value(kind: SessionGroupKey, item: ManagedConversation) {
  if (kind === "team") return item.teamId ?? "none";
  if (kind === "board") return item.boardId ?? "none";
  return item.agentId;
}
function label(kind: SessionGroupKey, id: string, names: SessionNames) {
  if (kind === "team") return names.team(id);
  if (kind === "board") return names.board(id === "none" ? null : id);
  return names.agent(id);
}

/**
 * Groups already-sorted sessions into nested levels. Groups keep the order of
 * their first session, so the server sort also orders the groups.
 */
export function groupSessions(
  items: ManagedConversation[],
  levels: SessionGroupKey[],
  names: SessionNames,
  parent = "",
): SessionGroup[] {
  const [kind, ...rest] = levels;
  if (!kind) return [];
  const buckets = new Map<string, ManagedConversation[]>();
  for (const item of items) {
    const id = value(kind, item);
    const bucket = buckets.get(id);
    if (bucket) bucket.push(item);
    else buckets.set(id, [item]);
  }
  return [...buckets].map(([id, members]) => {
    const key = `${parent}${parent ? "/" : ""}${kind}:${id}`;
    return {
      key,
      kind,
      label: label(kind, id, names),
      count: members.length,
      groups: groupSessions(members, rest, names, key),
      items: rest.length ? [] : members,
    };
  });
}

export function matchesSearch(item: ManagedConversation, search: string) {
  const query = search.trim().toLocaleLowerCase();
  return !query || item.title.toLocaleLowerCase().includes(query);
}
