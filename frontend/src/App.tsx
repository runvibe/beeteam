import { useRouteEntity } from "./routing/entity-route";
import { QueryState } from "./components/shared";
import {
  useRestorePosition,
  useLocation,
  isKnownRoute,
} from "./routing/location";
import { useState } from "react";
import {
  Hexagon,
  Columns3,
  Users,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useUi } from "./state/ui";
import { Button } from "./components/ui/button";
import { AppPath } from "./components/context-path";
import { ThemeControl } from "./components/theme-control";
import { Boards } from "./features/boards";
import { TaskPage } from "./features/tasks";
import { Agents, AgentPage } from "./features/agents";
import { Teams, TeamPage } from "./features/teams";
import "./App.css";
export function App() {
  useRestorePosition();
  const routeEntity = useRouteEntity();
  const knownRoute = isKnownRoute(useLocation());
  const { taskId, agentId, teamId } = useUi();
  const area = useUi((s) => s.area),
    setArea = useUi((s) => s.setArea);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={collapsed ? "app-shell compact" : "app-shell"}>
      <aside className="sidebar">
        <a
          className="brand"
          aria-label="Bee Team — ir para boards"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setArea("boards");
          }}
        >
          <span className="brand-mark">
            <Hexagon size={24} />
          </span>
          <span>bee team</span>
        </a>
        <Button
          variant="ghost"
          size="icon"
          aria-label={collapsed ? "Expandir navegação" : "Recolher navegação"}
          className="collapse-nav"
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>

        <nav aria-label="Navegação principal">
          <Button
            aria-label="Tarefas"
            title="Boards"
            variant={area === "boards" ? "secondary" : "ghost"}
            onClick={() => setArea("boards")}
            aria-current={area === "boards" ? "page" : undefined}
          >
            <Columns3 data-icon="inline-start" />
            <span>Tarefas</span>
          </Button>
          <Button
            aria-label="Recursos de Agentes"
            title="Agentes"
            variant={area === "agents" ? "secondary" : "ghost"}
            onClick={() => setArea("agents")}
            aria-current={area === "agents" ? "page" : undefined}
          >
            <Users data-icon="inline-start" />
            <span>Agentes</span>
          </Button>
          <Button
            aria-label="Times"
            title="Times"
            variant={area === "teams" ? "secondary" : "ghost"}
            onClick={() => setArea("teams")}
            aria-current={area === "teams" ? "page" : undefined}
          >
            <Network data-icon="inline-start" />
            <span>Times</span>
          </Button>
        </nav>
        <div className="sidebar-bottom">
          <span className="local-dot" />
          Ambiente local
          <p>
            Planejamento e aprovações acontecem na conversa com o team leader.
          </p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <AppPath />
          <div className="topbar-actions">
            <span className="environment-label">Demo local</span>
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
            (routeEntity.isPending || routeEntity.error) ? (
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
        <footer className="app-footer">
          Dados fictícios reiniciam ao recarregar · Sem conexão com IA ou
          backend
        </footer>
      </div>
    </div>
  );
}
export default App;
import "./operations.css";
