import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties, ReactNode } from "react";
import { ArrowLeftRight, MessageSquare, X } from "lucide-react";
import { useApi, useEntity } from "@/api/context";
import { useChatPanel } from "@/state/chat-panel";
import { useLocale, t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared";
import { ManagedAgentChat } from "./managed-agent-chat";
import { TeamManagedApprovals } from "./team-managed-approvals";
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
  const { teamId, picking, open, side, width, close, setWidth } =
    useChatPanel();
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
            ) : picking ? (
              <PanelTeamPicker />
            ) : (
              <PanelDefault />
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
/** Without an explicit selection, the panel opens the protected Bee Team HQ guide. */
function PanelDefault() {
  const api = useApi();
  const system = useQuery({
    queryKey: ["chat-system-team"],
    queryFn: () => api.list("teams", "", { system: true, limit: 1 }),
  });
  const hq = system.data?.items[0];
  return (
    <QueryState query={system}>
      {system.data &&
        (hq ? <PanelTeam key={hq.id} teamId={hq.id} /> : <PanelTeamPicker />)}
    </QueryState>
  );
}
function PanelTeam({ teamId }: { teamId: string }) {
  const team = useEntity("teams", teamId);
  return (
    <QueryState query={team}>
      {team.data && (
        <>
          <div className="chat-panel-team">
            <span title={team.data.name}>{team.data.name}</span>
            <Button
              variant="ghost"
              size="xs"
              onClick={useChatPanel.getState().chooseTeam}
            >
              <ArrowLeftRight />
              {t("chat.chooseTeam")}
            </Button>
          </div>
          <PanelLeader
            teamId={teamId}
            leaderId={team.data.leaderId}
            system={!!team.data.system}
          />
        </>
      )}
    </QueryState>
  );
}
function PanelLeader({
  teamId,
  leaderId,
  system,
}: {
  teamId: string;
  leaderId: string;
  system: boolean;
}) {
  const api = useApi();
  const leader = useEntity("agents", leaderId);
  if (api.managedAgents)
    return (
      <>
        <div className="chat-panel-leader">
          <span>{t("common.leader")}</span>
          <strong>{leader.data?.name ?? leaderId}</strong>
        </div>
        <TeamManagedApprovals key={teamId} teamId={teamId} api={api.managedAgents} />
        <ManagedAgentChat
          key={leaderId}
          api={api.managedAgents}
          agentId={leaderId}
          legacyApi={api.leaderChat}
          teamId={teamId}
          starters={system}
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
