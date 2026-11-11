import { useCallback, useState, useSyncExternalStore } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import {
  ArrowLeftRight,
  GripHorizontal,
  MessageSquare,
  PanelLeft,
  PanelRight,
  X,
} from "lucide-react";
import { useApi, useEntity } from "@/api/context";
import { nextPageOffset } from "@/api/page-continuation";
import {
  CHAT_PANEL_MAX_VIEWPORT_PERCENT,
  CHAT_PANEL_MIN_WIDTH,
  getMaxChatPanelWidth,
  useChatPanel,
} from "@/state/chat-panel";
import type { ChatPanelSide } from "@/state/chat-panel";
import { useLocale, t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared";
import { ManagedAgentChat } from "./managed-agent-chat";
import { TeamManagedApprovals } from "./team-managed-approvals";
import { LeaderChat } from "./leader-chat";
import { useChatPanelDock } from "./use-chat-panel-dock";
import "./chat-side-panel.css";

export function ChatPanelToggle({
  onClick,
  ...props
}: ComponentProps<typeof Button>) {
  useLocale();
  const { open, show, close } = useChatPanel();
  return (
    <Button
      {...props}
      variant="ghost"
      size="icon"
      aria-label={t("chat.title")}
      title={t("chat.title")}
      aria-expanded={open}
      aria-controls="leader-chat-panel"
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (open) close();
        else show();
      }}
    >
      <MessageSquare />
    </Button>
  );
}

function subscribeViewportWidth(notify: () => void) {
  window.addEventListener("resize", notify);
  return () => window.removeEventListener("resize", notify);
}
const viewportWidth = () => window.innerWidth;

export function ChatWorkspace({ children }: { children: ReactNode }) {
  useLocale();
  const { teamId, picking, open, side, width, close, setWidth, setSide } =
    useChatPanel();
  const maxWidth = getMaxChatPanelWidth(
    useSyncExternalStore(subscribeViewportWidth, viewportWidth, () => 0),
  );
  const visibleWidth = Math.min(width, maxWidth);
  const [announcement, setAnnouncement] = useState("");
  const dockTo = useCallback(
    (next: ChatPanelSide) => {
      setSide(next);
      setAnnouncement(
        t(next === "left" ? "chat.dockedLeft" : "chat.dockedRight"),
      );
    },
    [setSide],
  );
  const dock = useChatPanelDock(dockTo);
  const otherSide = side === "left" ? "right" : "left";
  const moveLabel = t(
    otherSide === "left" ? "chat.moveLeft" : "chat.moveRight",
  );
  return (
    <div
      className="chat-workspace"
      data-chat-side={side}
      data-chat-open={open}
      style={
        {
          "--chat-panel-width": `${width}px`,
          "--chat-panel-max-width": `${CHAT_PANEL_MAX_VIEWPORT_PERCENT}vw`,
        } as CSSProperties
      }
    >
      {children}
      <aside
        id="leader-chat-panel"
        className="chat-side-panel"
        hidden={!open}
        aria-label={t("chat.title")}
        data-dragging={dock.drag ? "true" : undefined}
        style={
          dock.drag
            ? ({
                "--chat-drag-x": `${dock.drag.dx}px`,
                "--chat-drag-y": `${dock.drag.dy}px`,
              } as CSSProperties)
            : undefined
        }
      >
        <div
          className="chat-panel-resizer"
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={t("chat.resizePanel")}
          aria-valuemin={CHAT_PANEL_MIN_WIDTH}
          aria-valuemax={maxWidth}
          aria-valuenow={visibleWidth}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            setWidth(
              visibleWidth +
                (event.key === "ArrowRight" ? 20 : -20) *
                  (side === "left" ? 1 : -1),
            );
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
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
        <header
          className="chat-panel-heading"
          data-draggable={dock.draggable ? "true" : undefined}
          title={dock.draggable ? t("chat.dragToDock") : undefined}
          onPointerDown={dock.onPointerDown}
        >
          {dock.draggable && (
            <GripHorizontal className="chat-panel-grip" aria-hidden />
          )}
          <strong>{t("chat.title")}</strong>
          <Button
            variant="ghost"
            size="icon"
            className="chat-panel-move"
            onClick={() => dockTo(otherSide)}
            aria-label={moveLabel}
            title={moveLabel}
          >
            {otherSide === "left" ? <PanelLeft /> : <PanelRight />}
          </Button>
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
          <div className="chat-panel-content">
            {teamId ? (
              <PanelTeam key={teamId} teamId={teamId} />
            ) : picking ? (
              <PanelTeamPicker enabled={open} />
            ) : (
              <PanelDefault enabled={open} />
            )}
          </div>
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
      </aside>
      {dock.drag && (
        <div
          className="chat-dock-preview"
          data-side={dock.drag.target}
          aria-hidden
        />
      )}
    </div>
  );
}
/** Without an explicit selection, the panel opens the protected Bee Team HQ guide. */
function PanelDefault({ enabled }: { enabled: boolean }) {
  const api = useApi();
  const system = useQuery({
    queryKey: ["chat-system-team"],
    queryFn: () => api.list("teams", "", { system: true, limit: 1 }),
    enabled,
  });
  const hq = system.data?.items[0];
  return (
    <QueryState query={system}>
      {system.data &&
        (hq ? (
          <PanelTeam key={hq.id} teamId={hq.id} />
        ) : (
          <PanelTeamPicker enabled={enabled} />
        ))}
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
  const boards = useInfiniteQuery({
    queryKey: ["session-board-options", teamId],
    queryFn: ({ pageParam, signal }) =>
      api.list("boards", "", { teamId, limit: 100, offset: pageParam, sortBy: "name" }, signal),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => nextPageOffset(last, pages, (board) => board.id),
    enabled: !!api.managedAgents,
  });
  const boardItems = [
    ...new Map(
      boards.data?.pages.flatMap((page) => page.items.map((board) => [board.id, board] as const)) ?? [],
    ).values(),
  ];
  const getBoard = useCallback((id: string) => api.get("boards", id), [api]);
  const conversationId = useChatPanel((s) => s.conversationId);
  const freshConversation = useChatPanel((s) => s.freshConversation);
  const setConversation = useChatPanel((s) => s.setConversation);
  if (api.managedAgents)
    return (
      <>
        <div className="chat-panel-leader">
          <span>{t("common.leader")}</span>
          <strong>{leader.data?.name ?? leaderId}</strong>
        </div>
        {boards.error && (
          <div className="assistant-alert" role="alert">
            {t("managed.boardLoadError")}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                void (boards.isFetchNextPageError
                  ? boards.fetchNextPage({ cancelRefetch: false })
                  : boards.refetch())
              }
            >
              {t("sessions.retry")}
            </Button>
          </div>
        )}
        <TeamManagedApprovals
          key={teamId}
          teamId={teamId}
          api={api.managedAgents}
        />
        <ManagedAgentChat
          key={leaderId}
          api={api.managedAgents}
          agentId={leaderId}
          legacyApi={api.leaderChat}
          teamId={teamId}
          starters={system}
          conversationId={conversationId}
          freshConversation={freshConversation}
          onConversationChange={setConversation}
          boards={boardItems}
          getBoard={getBoard}
          hasMoreBoards={!!boards.hasNextPage}
          loadingBoards={boards.isFetchingNextPage}
          onMoreBoards={() => void boards.fetchNextPage({ cancelRefetch: false })}
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

function PanelTeamPicker({ enabled }: { enabled: boolean }) {
  const api = useApi();
  const [offset, setOffset] = useState(0);
  const teams = useQuery({
    queryKey: ["chat-teams", offset],
    queryFn: () => api.list("teams", "", { limit: 20, offset, sortBy: "name" }),
    enabled,
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
