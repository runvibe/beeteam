import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useApi } from "@/api/context";
import type { ManagedAgentApi } from "@/api/managed-agents";
import { useChatPanel } from "@/state/chat-panel";
import { Button } from "@/components/ui/button";
import { t, useLocale } from "@/i18n";
import { useContextLeader } from "./use-context-leader";
import "./context-leader-banner.css";

async function latestWritable(api: ManagedAgentApi, teamId: string, agentId: string, signal: AbortSignal) {
  let cursor: string | undefined;
  const visited = new Set<string>();
  do {
    if (signal.aborted) return null;
    const page = await api.sessions({ teamIds: [teamId], agentIds: [agentId], sort: "updated_desc", limit: 20, ...(cursor ? { cursor } : {}) });
    if (signal.aborted) return null;
    const valid = page.items.find(item => item.teamId === teamId && item.agentId === agentId && item.readOnly === false);
    if (valid) return valid;
    cursor = page.nextCursor ?? undefined;
    if (cursor && visited.has(cursor)) return null;
    if (cursor) visited.add(cursor);
  } while (cursor);
  return null;
}

export function ContextLeaderBanner({ currentLeaderId }: { currentLeaderId: string }) {
  const context = useContextLeader(currentLeaderId);
  // Unmount on leaving context so dismiss is scoped to this visit, not a global preference.
  return context ? <Suggestion key={`${context.key}:${context.team.id}:${context.leader.id}`} context={context} /> : null;
}

function Suggestion({ context }: { context: NonNullable<ReturnType<typeof useContextLeader>> }) {
  useLocale();
  const api = useApi().managedAgents;
  const [dismissed, setDismissed] = useState(false);
  const session = useQuery({
    queryKey: ["managed-sessions", "context-latest", context.team.id, context.leader.id],
    queryFn: ({ signal }) => latestWritable(api!, context.team.id, context.leader.id, signal),
    enabled: !!api && !dismissed,
    refetchInterval: 5000,
  });
  if (!api || dismissed) return null;
  return <aside className="context-leader-banner" aria-label={t("chat.contextLeaderLabel")}>
    <div className="context-leader-copy">
      <p>{t("chat.contextLeader", { context: context.name, team: context.team.name, leader: context.leader.name })}</p>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={t("chat.contextLeaderDismiss")} onClick={() => setDismissed(true)}><X aria-hidden="true" /></Button>
    </div>
    <div className="context-leader-actions">
      {session.data && !session.isError && <Button type="button" variant="ghost" size="xs" onClick={() => useChatPanel.getState().openConversation(context.team.id, session.data!.id)}>{t("chat.contextLeaderContinue")}</Button>}
      <Button type="button" variant="ghost" size="xs" onClick={() => useChatPanel.getState().startNewSession(context.team.id)}>{t("chat.contextLeaderNew")}</Button>
    </div>
  </aside>;
}
