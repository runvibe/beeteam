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
import { ThemeControl } from "./components/theme-control";
import { DataTransferSettings } from "./features/data-transfer";
import { Boards } from "./features/boards";
import { TaskPage } from "./features/tasks";
import { Agents, AgentPage } from "./features/agents";
import { Teams, TeamPage } from "./features/teams";
import "./App.css";
import "./navigation.css";
export function App() {
  useRestorePosition();
  const routeEntity = useRouteEntity();
  const knownRoute = isKnownRoute(useLocation());
  const { taskId, agentId, teamId } = useUi();
  const area = useUi((s) => s.area),
    setArea = useUi((s) => s.setArea);
  return (
    <div className="app-shell icon-navigation">
      <NavigationRail />
      <div className="main-shell">
        <header className="topbar">
          <AppPath />
          <div className="topbar-actions">
            <DataTransferSettings />
            <ThemeControl />
          </div>
        </header>
        <main id="main-content">
          {!knownRoute ? (
            <div>
              <h1>Página não encontrada</h1>
              <Button onClick={() => setArea("boards")}>Ir para boards</Button>
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
  );
}
export default App;
import "./operations.css";
