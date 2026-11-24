import { useLocale, t as tr } from "@/i18n";
import { ApiCompatibilityBanner } from "./components/api-compatibility";

import { motion, MotionConfig } from "motion/react";
import {
  pageMotionIdentity,
  usePageEntrance,
} from "./components/motion-settings";
import { useRouteEntity } from "./routing/entity-route";
import { QueryState } from "./components/shared";
import {
  useRestorePosition,
  useLocation,
  isKnownRoute,
} from "./routing/location";
import { NavigationRail } from "./components/navigation-rail";
import { useFocusSource } from "./components/use-focus-source";
import { useUi } from "./state/ui";
import { Button } from "./components/ui/button";
import { AppPath } from "./components/context-path";
import { MobileContextPath } from "./components/mobile-context-path";
import { DetailContainerContext } from "./components/detail-layout/use-detail-mobile";
import { useLayoutEffect, useRef, useState } from "react";
import { HeaderFiltersContext } from "./components/header-filters";
import { Boards } from "./features/boards";
import { TaskPage } from "./features/tasks";
import { Agents, AgentPage } from "./features/agents";
import { Teams, TeamPage } from "./features/teams";
import { ChatWorkspace } from "./features/chat-side-panel";
import { SessionsSidebar } from "./features/sessions-sidebar";
import { ContentPanelClose } from "./features/content-panel-controls";
import { HiveNavigation } from "./features/hive-navigation";
import { isHiveArea } from "./state/hive-navigation";
import { useChatPanel } from "./state/chat-panel";
import { ManagedVoiceProvider } from "./features/managed-voice-chat";
import "./App.css";
import "./navigation.css";
import "./scrollbars.css";
export function App({ homeEnabled = false }: { homeEnabled?: boolean } = {}) {
  useLocale();
  useFocusSource();
  const [filterTarget, setFilterTarget] = useState<HTMLDivElement | null>(null);
  const [detailContainer, setDetailContainer] = useState<HTMLDivElement | null>(
    null,
  );
  useRestorePosition();
  const routeEntity = useRouteEntity();
  const url = useLocation();
  const path = url.split("?")[0];
  const home = path === "/home";
  const previousPath = useRef(path);
  useLayoutEffect(() => {
    const chat = useChatPanel.getState();
    if (home) chat.setContentOpen(false, "home");
    else if (previousPath.current !== path || chat.contentHiddenForHome)
      chat.setContentOpen(true);
    previousPath.current = path;
  }, [path, home]);
  const knownRoute = isKnownRoute(url);
  const pageIdentity = pageMotionIdentity(url, routeEntity.data?.id);
  const pageAnimation = usePageEntrance(pageIdentity);
  const { taskId, agentId, teamId } = useUi();
  const contentOpen = useChatPanel((state) => state.contentOpen);
  const area = useUi((s) => s.area),
    setArea = useUi((s) => s.setArea);
  const hive = isHiveArea(area);
  return (
    <ManagedVoiceProvider>
    <MotionConfig reducedMotion="user">
      <HeaderFiltersContext.Provider value={filterTarget}>
        <div className="app-shell icon-navigation">
          <NavigationRail homeEnabled={homeEnabled} />
          <DetailContainerContext.Provider value={detailContainer}>
            <ChatWorkspace sessions={<SessionsSidebar />}>
              <div
                className="main-shell"
                id="content-panel"
                hidden={home || !contentOpen}
                data-workspace-panel="content"
                data-hive={hive || undefined}
                ref={setDetailContainer}
              >
                {hive && <HiveNavigation />}
                <ApiCompatibilityBanner />
                <header className="topbar" data-dock-handle="content">
                  <AppPath />
                  <MobileContextPath />
                  <div className="header-filter-slot" ref={setFilterTarget} />
                  <ContentPanelClose />
                </header>
                <motion.main
                  id="main-content"
                  animate={pageAnimation}
                  data-page-identity={pageIdentity}
                >
                  {!knownRoute ? (
                    <div>
                      <h1>{tr("common.pageNotFound")}</h1>
                      <Button onClick={() => setArea("boards")}>
                        {tr("common.goToBoards")}
                      </Button>
                    </div>
                  ) : routeEntity.active &&
                    (routeEntity.isPending ||
                      (routeEntity.error && !routeEntity.data)) ? (
                    <QueryState query={routeEntity}>{null}</QueryState>
                  ) : taskId ? (
                    <TaskPage />
                  ) : agentId ? (
                    <AgentPage />
                  ) : teamId ? (
                    <TeamPage />
                  ) : area === "home" ? (
                    null
                  ) : area === "boards" ? (
                    <Boards />
                  ) : area === "agents" ? (
                    <Agents />
                  ) : (
                    <Teams />
                  )}
                </motion.main>
              </div>
            </ChatWorkspace>
          </DetailContainerContext.Provider>
        </div>
      </HeaderFiltersContext.Provider>
    </MotionConfig>
    </ManagedVoiceProvider>
  );
}
export default App;
import "./operations.css";
