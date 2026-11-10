import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties, ReactNode } from "react";
import { MessageSquare, X } from "lucide-react";
import { useApi, useEntity } from "@/api/context";
import { useChatPanel } from "@/state/chat-panel";
import { useLocale, t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared";
import { ManagedAgentChat } from "./managed-agent-chat";
import { LeaderChat } from "./leader-chat";
import "./chat-side-panel.css";

export function ChatPanelToggle() {
  useLocale();
  const { open, show, close } = useChatPanel();
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={t("chat.title")}
      title={t("chat.title")}
      aria-expanded={open}
      aria-controls="leader-chat-panel"
      onClick={() => (open ? close() : show())}
    >
      <MessageSquare />
    </Button>
  );
}

export function ChatWorkspace({ children }: { children: ReactNode }) {
  useLocale();
  const { teamId, open, side, width, close, setWidth } = useChatPanel();
  return (
    <div
      className="chat-workspace"
      data-chat-side={side}
      data-chat-open={open}
      style={{ "--chat-panel-width": `${width}px` } as CSSProperties}
    >
      {children}
      {(teamId || open) && (
        <aside
          id="leader-chat-panel"
          className="chat-side-panel"
          hidden={!open}
          aria-label={t("chat.title")}
        >
          <div
            className="chat-panel-resizer"
            role="separator"
            tabIndex={0}
            aria-orientation="vertical"
            aria-label={t("chat.resizePanel")}
            aria-valuemin={320}
            aria-valuemax={720}
            aria-valuenow={width}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                return;
              event.preventDefault();
              setWidth(
                width +
                  (event.key === "ArrowRight" ? 20 : -20) *
                    (side === "left" ? 1 : -1),
              );
            }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!event.currentTarget.hasPointerCapture(event.pointerId))
                return;
              const bounds =
                event.currentTarget.parentElement!.getBoundingClientRect();
              setWidth(
                side === "left"
                  ? event.clientX - bounds.left
                  : bounds.right - event.clientX,
              );
            }}
            onPointerUp={(event) =>
              event.currentTarget.releasePointerCapture(event.pointerId)
            }
          />
          <header className="chat-panel-heading">
            <strong>{t("chat.title")}</strong>
            <Button
              variant="ghost"
              size="icon"
              onClick={close}
              aria-label={t("chat.closePanel")}
              title={t("chat.closePanel")}
            >
              <X />
            </Button>
          </header>
          <div className="chat-panel-body">
            {teamId ? (
              <PanelTeam key={teamId} teamId={teamId} />
            ) : (
              <PanelTeamPicker />
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
function PanelTeam({ teamId }: { teamId: string }) {
  const team = useEntity("teams", teamId);
  return (
    <QueryState query={team}>
      {team.data && (
        <>
          <p className="chat-panel-team">{team.data.name}</p>
          <Button variant="ghost" onClick={useChatPanel.getState().chooseTeam}>
            {t("chat.chooseTeam")}
          </Button>
          <PanelLeader teamId={teamId} leaderId={team.data.leaderId} />
        </>
      )}
    </QueryState>
  );
}
function PanelLeader({
  teamId,
  leaderId,
}: {
  teamId: string;
  leaderId: string;
}) {
  const api = useApi();
  const leader = useEntity("agents", leaderId);
  const [selected, setSelected] = useState(leaderId);
  const members = useQuery({
    queryKey: ["chat-team-members", teamId],
    enabled: !!api.managedAgents,
    queryFn: () => api.list("members", teamId, { limit: 100 }),
  });
  if (api.managedAgents)
    return (
      <>
        <label className="managed-agent-selector">
          {t("common.agents")}
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value={leaderId}>{leader.data?.name ?? leaderId}</option>
            {members.data?.items
              .filter((m) => m.agentId !== leaderId && !m.agentArchivedAt)
              .map((m) => (
                <option key={m.agentId} value={m.agentId}>
                  {m.name}
                </option>
              ))}
          </select>
        </label>
        <ManagedAgentChat
          key={selected}
          api={api.managedAgents}
          agentId={selected}
          legacyApi={api.leaderChat}
          teamId={teamId}
        />
      </>
    );
  return (
    <LeaderChat
      api={api.leaderChat}
      teamId={teamId}
      leaderAgentId={leaderId}
      leaderVersion={leader.data?.version}
      onSessionCreated={() => void leader.refetch()}
    />
  );
}

function PanelTeamPicker() {
  const api = useApi();
  const [offset, setOffset] = useState(0);
  const teams = useQuery({
    queryKey: ["chat-teams", offset],
    queryFn: () => api.list("teams", "", { limit: 20, offset, sortBy: "name" }),
  });
  return (
    <section aria-label={t("chat.chooseTeam")}>
      <p>{t("chat.chooseTeam")}</p>
      <QueryState query={teams}>
        {teams.data?.items.map((team) => (
          <Button
            key={team.id}
            variant="ghost"
            onClick={() => useChatPanel.getState().openTeam(team.id)}
          >
            {team.name}
          </Button>
        ))}
        {teams.data?.total === 0 && <p>{t("chat.noTeams")}</p>}
        <div>
          {offset > 0 && (
            <Button
              variant="ghost"
              onClick={() => setOffset(Math.max(0, offset - 20))}
            >
              {t("chat.previousTeams")}
            </Button>
          )}
          {teams.data &&
            offset + teams.data.items.length < teams.data.total && (
              <Button variant="ghost" onClick={() => setOffset(offset + 20)}>
                {t("chat.nextTeams")}
              </Button>
            )}
        </div>
      </QueryState>
    </section>
  );
}
