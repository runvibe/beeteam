import { FloatingSessionInformation } from "./floating-session-information";
import { useFloatingChat } from "./use-floating-chat";
import { useFloatingChatResize } from "./use-floating-chat-resize";
import { useFloatingChatArea } from "./use-floating-chat-area";
import { useCompactFloatingChat } from "./use-compact-floating-chat";
import {
  ChatSessionInformation,
  sessionInformationMode,
} from "./chat-session-information";
import {
  Fragment,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useQuery } from "@tanstack/react-query";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import {
  ArrowLeftRight,
  MessageSquare,
  MoreHorizontal,
  PictureInPicture2,
  RectangleHorizontal,
} from "lucide-react";
import { useApi, useEntity } from "@/api/context";
import { useChatPanel } from "@/state/chat-panel";
import { useSessionsSidebar } from "@/state/sessions-sidebar";
import {
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
import { SessionsToggle } from "./sessions-sidebar";
import {
  usePresentWorkspacePanels,
  useWorkspacePanelDock,
  useWorkspaceWidth,
  workspacePanelName,
} from "./workspace-panel-dock";
import { WorkspacePanelResizer } from "./workspace-panel-resize";
import {
  WorkspaceResizeContext,
  workspacePanelSizes,
} from "./workspace-panel-sizes";
import {
  ChatPanelScrollArea,
  ChatPanelScrollbar,
} from "./chat-panel-scroll-area";
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
  const api = useApi();
  const {
    teamId,
    picking,
    open,
    contentOpen,
    setContentOpen,
    side,
    panelOrder,
    width,
    sessionsWidth,
    close,
    show,
    floatingPosition,
    floatingSize,
    setFloatingBounds,
    setFloatingPosition,
    setPanelOrder,
  } = useChatPanel();
  const [informationOpen, setInformationOpen] = useState(false);
  useLayoutEffect(() => {
    if (!open && !contentOpen) setContentOpen(true);
  }, [open, contentOpen, setContentOpen]);
  const [chatElement, setChatElement] = useState<HTMLElement | null>(null);
  const [workspace, setWorkspace] = useState<HTMLDivElement | null>(null);
  const floatingArea = useFloatingChatArea(workspace, !open);
  const informationButton = useRef<HTMLButtonElement>(null);
  const chatWidth = useWorkspaceWidth(chatElement);
  const floating = useFloatingChat({
    active: !open,
    element: chatElement,
    position: floatingPosition,
    onPositionChange: setFloatingPosition,
    bounds: floatingArea,
  });
  const compactChat = useCompactFloatingChat({
    active: !open,
    element: chatElement,
    wasDraggedRecently: floating.wasDraggedRecently,
    onCollapse: () => {
      if (!floatingSize && chatElement) {
        const rect = chatElement.getBoundingClientRect();
        setFloatingBounds({x:rect.left,y:rect.top,width:rect.width,height:rect.height});
      }
    },
  });
  const floatingResize = useFloatingChatResize({
    active: !open,
    element: chatElement,
    size: compactChat.compact ? {width: floatingSize?.width ?? 440, height: compactChat.height} : floatingSize,
    bounds: floatingArea,
    minHeight: compactChat.compact ? 160 : 300,
    onBoundsChange: (bounds) => {
      if (compactChat.compact) {
        compactChat.setHeight(bounds.height);
        setFloatingBounds({...bounds,height:floatingSize?.height ?? 650});
      } else setFloatingBounds(bounds);
    },
    onResizeStart: floating.onResizeStart,
  });
  const conversationId = useChatPanel((state) => state.conversationId);
  function closeInformation() {
    setInformationOpen(false);
    informationButton.current?.focus();
  }
  const sessionsOpen = useSessionsSidebar((state) => state.open);
  const viewport = useSyncExternalStore(
    subscribeViewportWidth,
    viewportWidth,
    () => 0,
  );
  const measuredWidth = useWorkspaceWidth(workspace);
  const present = usePresentWorkspacePanels(workspace);
  const visible = panelOrder.filter(
    (panel) =>
      present.includes(panel) &&
      (panel === "chat"
        ? open
        : panel === "sessions"
          ? sessionsOpen
          : contentOpen),
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
  const resizeConfig = {
    viewport,
    workspace: measuredWidth || viewport,
    visible,
    narrow: dock.narrow,
  };
  const sizes = workspacePanelSizes(resizeConfig, width, sessionsWidth);
  const sessionsAfterContent =
    sessionsVisible &&
    panelOrder.indexOf("sessions") > panelOrder.indexOf("content");
  const chatPanel = (
    <ChatPanelScrollArea>
      <aside
        ref={setChatElement}
        id="leader-chat-panel"
        className="chat-side-panel"
        data-floating={!open ? "true" : undefined}
        data-floating-settling={floating.settling ? "true" : undefined}
        data-floating-compact={compactChat.compact ? "true" : undefined}
        style={!open ? {
          ...floating.style, ...floatingSize,
          ...(compactChat.compact ? {height:compactChat.height} : {}),
          maxWidth: Math.max(0,floatingArea.width-24),
          maxHeight: Math.max(0,floatingArea.height-24),
        } : undefined}
        data-floating-resizing={floatingResize.resizing ? "true" : undefined}
        aria-label={t("chat.title")}
        data-workspace-panel="chat"
        data-dragging={dock.drag?.panel === "chat" ? "true" : undefined}
      >
        {open && <WorkspacePanelResizer panel="chat" />}
        {!open && (["n", "s", "e", "w", "nw", "ne", "sw", "se"] as const).map(corner => (
          <button
            key={corner}
            type="button"
            className="floating-chat-resize-handle"
            data-corner={corner}
            aria-label={{
              n: t("chat.resizeFloating.n"), s: t("chat.resizeFloating.s"),
              e: t("chat.resizeFloating.e"), w: t("chat.resizeFloating.w"),
              nw: t("chat.resizeFloating.nw"), ne: t("chat.resizeFloating.ne"),
              sw: t("chat.resizeFloating.sw"), se: t("chat.resizeFloating.se"),
            }[corner]}
            title={t("chat.resizeFloatingHelp")}
            {...floatingResize.handleProps(corner)}
          />
        ))}
        <header
          className="chat-panel-heading"
          data-dock-handle={open ? "chat" : undefined}
          onPointerDown={!open ? floating.onPointerDown : undefined}
          onDoubleClick={compactChat.onDoubleClick}
          data-draggable={dock.draggable ? "true" : undefined}
          title={
            !open
              ? t(compactChat.compact ? "chat.expandFloating" : "chat.compactFloating")
              : dock.draggable
                ? t("workspace.dragToDock")
                : undefined
          }
        >
          <strong>{t("chat.title")}</strong>
          {api.managedAgents && (
            <Button
              ref={informationButton}
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("chat.sessionInfo")}
              title={t("chat.sessionInfo")}
              aria-expanded={informationOpen}
              aria-controls="chat-session-information"
              onClick={() => {
                setInformationOpen((value) => !value);
              }}
            >
              <MoreHorizontal />
            </Button>
          )}
          {sessions && <SessionsToggle />}
          <Button
            variant="ghost"
            size="icon"
            onClick={open ? close : show}
            aria-label={t(open ? "chat.floatPanel" : "chat.restorePanel")}
            title={t(open ? "chat.floatPanel" : "chat.restorePanel")}
          >
            {open ? <PictureInPicture2 /> : <RectangleHorizontal />}
          </Button>
        </header>
        <div className="chat-panel-layout">
          <div className="chat-panel-body">
            <div className="chat-panel-content">
              {teamId ? (
                <PanelTeam key={teamId} teamId={teamId} />
              ) : picking && !api.managedAgents ? (
                <PanelTeamPicker enabled />
              ) : (
                <PanelDefault enabled />
              )}
            </div>
          </div>
          {open && informationOpen && api.managedAgents && (
            <ChatSessionInformation
              teamId={teamId}
              conversationId={conversationId}
              mode={sessionInformationMode(chatWidth, viewport)}
              onClose={closeInformation}
            />
          )}
        </div>
        <ChatPanelScrollbar />
      </aside>
    </ChatPanelScrollArea>
  );
  return (
    <div
      ref={setWorkspace}
      className="chat-workspace"
      data-chat-side={side}
      data-chat-open={open}
      data-content-open={contentOpen}
      data-panel-order={panelOrder.join(",")}
      data-sessions-after-content={sessionsAfterContent ? "true" : undefined}
      data-dockable={dock.draggable ? "true" : undefined}
      data-dragging-panel={dock.drag?.panel}
      onPointerDown={dock.onPointerDown}
      style={
        {
          "--chat-panel-width": `${width}px`,
          "--chat-panel-max-width": `${sizes.chatMax}px`,
          "--sessions-panel-width": `${sizes.sessions}px`,
          "--sessions-after-content-width": sessionsAfterContent
            ? `${sizes.sessions}px`
            : "0px",
          "--sessions-panel-order": panelOrder.indexOf("sessions"),
          "--content-panel-order": panelOrder.indexOf("content"),
          "--chat-panel-order": panelOrder.indexOf("chat"),
          "--panel-drag-x": `${dock.drag?.dx ?? 0}px`,
          "--panel-drag-y": `${dock.drag?.dy ?? 0}px`,
        } as CSSProperties
      }
    >
      <WorkspaceResizeContext.Provider value={resizeConfig}>
        {panelOrder.map((panel) => (
          <Fragment key={panel}>
            {panel === "sessions"
              ? sessions
              : panel === "content"
                ? children
                : chatPanel}
          </Fragment>
        ))}
      </WorkspaceResizeContext.Provider>
      {!open && informationOpen && api.managedAgents && (
        <FloatingSessionInformation anchor={chatElement} area={floatingArea} onClose={closeInformation}>
          <ChatSessionInformation
            teamId={teamId}
            conversationId={conversationId}
            mode="external"
            onClose={closeInformation}
          />
        </FloatingSessionInformation>
      )}
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
  const api = useApi();
  const team = useEntity("teams", teamId);
  return (
    <QueryState query={team}>
      {team.data && (
        <>
          {!api.managedAgents && (
            <div className="chat-panel-team">
              <span title={team.data.name}>{team.data.name}</span>
              {!api.managedAgents && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={useChatPanel.getState().chooseTeam}
                >
                  <ArrowLeftRight />
                  {t("chat.chooseTeam")}
                </Button>
              )}
            </div>
          )}
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
  const conversationId = useChatPanel((s) => s.conversationId);
  const freshConversation = useChatPanel((s) => s.freshConversation);
  const resetGeneration = useChatPanel((s) => s.resetGeneration);
  const setConversation = useChatPanel((s) => s.setConversation);
  if (api.managedAgents)
    return (
      <>
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
          resetGeneration={resetGeneration}
          onConversationChange={setConversation}
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
