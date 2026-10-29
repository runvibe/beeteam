import { useRouteEntity } from "./routing/entity-route";
import { QueryState } from "./components/shared";
import {
  useRestorePosition,
  useLocation,
  isKnownRoute,
} from "./routing/location";
import { NavigationRail } from "./components/navigation-rail";
import { useUi } from "./state/ui";
import { Button } from "./components/ui/button";
import { AppPath } from "./components/context-path";
import { MobileContextPath } from "./components/mobile-context-path";
import { useState } from "react";
import { HeaderFiltersContext } from "./components/header-filters";
import { Boards } from "./features/boards";
import { TaskPage } from "./features/tasks";
import { Agents, AgentPage } from "./features/agents";
import { Teams, TeamPage } from "./features/teams";
import "./App.css";
import "./navigation.css";
import "./scrollbars.css";
export function App() {
  const [filterTarget, setFilterTarget] = useState<HTMLDivElement | null>(null);
  useRestorePosition();
  const routeEntity = useRouteEntity();
  const knownRoute = isKnownRoute(useLocation());
  const { taskId, agentId, teamId } = useUi();
  const area = useUi((s) => s.area),
    setArea = useUi((s) => s.setArea);
  return (
    <HeaderFiltersContext.Provider value={filterTarget}>
      <div className="app-shell icon-navigation">
        <NavigationRail />
        <div className="main-shell">
          <header className="topbar">
            <AppPath />
            <MobileContextPath />
            <div className="header-filter-slot" ref={setFilterTarget} />
          </header>
          <main id="main-content">
            {!knownRoute ? (
              <div>
                <h1>Página não encontrada</h1>
                <Button onClick={() => setArea("boards")}>
                  Ir para boards
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
            ) : area === "boards" ? (
              <Boards />
            ) : area === "agents" ? (
              <Agents />
            ) : (
              <Teams />
            )}
          </main>
        </div>
      </div>
    </HeaderFiltersContext.Provider>
  );
}
export default App;
import "./operations.css";
