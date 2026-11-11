import { Fragment, useCallback, useState, useSyncExternalStore } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { ArrowLeftRight, MessageSquare, X } from "lucide-react";
import { useApi, useEntity } from "@/api/context";
import { nextPageOffset } from "@/api/page-continuation";
import {
  CHAT_PANEL_MIN_WIDTH,
  getMaxChatPanelWidth,
  useChatPanel,
} from "@/state/chat-panel";
import { useSessionsSidebar } from "@/state/sessions-sidebar";
import {
  CONTENT_PANEL_MIN_WIDTH,
  SESSIONS_PANEL_WIDTH,
  chatSide,
  movePanel,
  type WorkspacePanel,
} from "@/state/workspace-layout";
import { useLocale, t } from "@/i18n";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared";
import { ManagedAgentChat } from "./managed-agent-chat";
import { TeamManagedApprovals } from "./team-managed-approvals";
import { LeaderChat } from "./leader-chat";
import {
  WorkspaceDockContext,
  usePresentWorkspacePanels,
  useWorkspacePanelDock,
  useWorkspaceWidth,
  workspacePanelName,
} from "./workspace-panel-dock";
import {
  WorkspacePanelControls,
  WorkspacePanelGrip,
} from "./workspace-panel-controls";
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

export function ChatWorkspace({
  children,
  sessions,
}: {
  children: ReactNode;
  sessions?: ReactNode;
}) {
  useLocale();
  const {
    teamId,
    picking,
    open,
    side,
    panelOrder,
    width,
    close,
    setWidth,
    setPanelOrder,
  } = useChatPanel();
  const sessionsOpen = useSessionsSidebar((state) => state.open);
  const viewport = useSyncExternalStore(
    subscribeViewportWidth,
    viewportWidth,
    () => 0,
  );
  const [workspace, setWorkspace] = useState<HTMLDivElement | null>(null);
  const measuredWidth = useWorkspaceWidth(workspace);
  const present = usePresentWorkspacePanels(workspace);
  const visible = panelOrder.filter(
    (panel) =>
      present.includes(panel) &&
      (panel === "chat" ? open : panel === "sessions" ? sessionsOpen : true),
  );
  const [announcement, setAnnouncement] = useState("");
  const reorder = useCallback(
    (
      panel: WorkspacePanel,
      active: readonly WorkspacePanel[],
      position: number,
    ) => {
      const current = useChatPanel.getState().panelOrder;
      const next = movePanel(current, panel, active, position);
      if (next.every((item, index) => item === current[index])) return;
      setPanelOrder(next);
      const moved = t("workspace.moved", {
        panel: workspacePanelName(panel),
        position:
          next.filter((item) => active.includes(item)).indexOf(panel) + 1,
        total: active.length,
      });
      setAnnouncement(
        panel === "chat"
          ? `${t(chatSide(next) === "left" ? "chat.dockedLeft" : "chat.dockedRight")}. ${moved}`
          : moved,
      );
    },
    [setPanelOrder],
  );
  const dock = useWorkspacePanelDock(workspace, panelOrder, visible, reorder);
  const sessionsVisible = !dock.narrow && visible.includes("sessions");
  const maxViewportWidth = getMaxChatPanelWidth(viewport);
  const maxWidth = sessionsVisible
    ? Math.max(
        CHAT_PANEL_MIN_WIDTH,
        Math.min(
          maxViewportWidth,
          (measuredWidth || viewport) -
            SESSIONS_PANEL_WIDTH -
            CONTENT_PANEL_MIN_WIDTH,
        ),
      )
    : maxViewportWidth;
  const visibleWidth = Math.min(width, maxWidth);
  const sessionsAfterContent =
    sessionsVisible &&
    panelOrder.indexOf("sessions") > panelOrder.indexOf("content");
  const currentVisibleWidth = () =>
    Math.min(useChatPanel.getState().width, maxWidth);
  const resizeChat = (nextWidth: number) => {
    const constrained = Math.max(
      CHAT_PANEL_MIN_WIDTH,
      Math.min(maxWidth, nextWidth),
    );
    if (constrained !== currentVisibleWidth()) setWidth(constrained);
  };
  const chatPanel = (
    <aside
      id="leader-chat-panel"
      className="chat-side-panel"
      hidden={!open}
      aria-label={t("chat.title")}
      data-workspace-panel="chat"
      data-dragging={dock.drag?.panel === "chat" ? "true" : undefined}
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
          resizeChat(
            currentVisibleWidth() +
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
          resizeChat(
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
        data-dock-handle="chat"
        data-draggable={dock.draggable ? "true" : undefined}
        title={dock.draggable ? t("workspace.dragToDock") : undefined}
      >
        <WorkspacePanelGrip panel="chat" />
        <strong>{t("chat.title")}</strong>
        <WorkspacePanelControls panel="chat" />
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
    </aside>
  );
  return (
    <WorkspaceDockContext.Provider value={dock}>
      <div
        ref={setWorkspace}
        className="chat-workspace"
        data-chat-side={side}
        data-chat-open={open}
        data-panel-order={panelOrder.join(",")}
        data-sessions-after-content={sessionsAfterContent ? "true" : undefined}
        data-dockable={dock.draggable ? "true" : undefined}
        data-dragging-panel={dock.drag?.panel}
        onPointerDown={dock.onPointerDown}
        style={
          {
            "--chat-panel-width": `${width}px`,
            "--chat-panel-max-width": `${maxWidth}px`,
            "--sessions-panel-width": `${SESSIONS_PANEL_WIDTH}px`,
            "--sessions-after-content-width": sessionsAfterContent
              ? `${SESSIONS_PANEL_WIDTH}px`
              : "0px",
            "--sessions-panel-order": panelOrder.indexOf("sessions"),
            "--content-panel-order": panelOrder.indexOf("content"),
            "--chat-panel-order": panelOrder.indexOf("chat"),
            "--panel-drag-x": `${dock.drag?.dx ?? 0}px`,
            "--panel-drag-y": `${dock.drag?.dy ?? 0}px`,
          } as CSSProperties
        }
      >
        {panelOrder.map((panel) => (
          <Fragment key={panel}>
            {panel === "sessions"
              ? sessions
              : panel === "content"
                ? children
                : chatPanel}
          </Fragment>
        ))}
        <span className="sr-only" role="status" aria-live="polite">
          {announcement}
        </span>
        {dock.drag && (
          <div
            className="chat-dock-preview"
            data-side={dock.drag.side}
            data-position={dock.drag.position}
            aria-hidden
            style={{
              left: dock.drag.preview.left,
              width: dock.drag.preview.width,
              right: "auto",
            }}
          />
        )}
      </div>
    </WorkspaceDockContext.Provider>
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
