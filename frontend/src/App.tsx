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
import { Badge } from "./components/ui/badge";
import { ThemeControl } from "./components/theme-control";
import { Boards } from "./features/boards";
import { TaskDialog } from "./features/tasks";
import { Agents, AgentDialog, Teams, TeamDialog } from "./features/agents";
import "./App.css";
export function App() {
  const area = useUi((s) => s.area),
    setArea = useUi((s) => s.setArea);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={collapsed ? "app-shell compact" : "app-shell"}>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setArea("boards");
          }}
        >
          <span className="brand-mark">
            <Hexagon size={24} />
          </span>
          <span>
            bee team<span className="brand-sub">Um lugar para o trabalho.</span>
          </span>
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
        <p className="nav-label">ACOMPANHAR</p>
        <nav aria-label="Navegação principal">
          <Button
            variant={area === "boards" ? "secondary" : "ghost"}
            onClick={() => setArea("boards")}
            aria-current={area === "boards" ? "page" : undefined}
          >
            <Columns3 data-icon="inline-start" />
            <span>Tarefas</span>
          </Button>
          <Button
            variant={area === "agents" ? "secondary" : "ghost"}
            onClick={() => setArea("agents")}
            aria-current={area === "agents" ? "page" : undefined}
          >
            <Users data-icon="inline-start" />
            <span>Recursos de Agentes</span>
          </Button>
          <Button
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
          <span>
            Bee Team <span className="breadcrumb-slash">/</span>{" "}
            {
              {
                boards: "Tarefas",
                agents: "Recursos de Agentes",
                teams: "Times",
              }[area]
            }
          </span>
          <div className="topbar-actions">
            <Badge variant="outline">DEMO · API mockada</Badge>
            <ThemeControl />
          </div>
        </header>
        <main id="main-content">
          {area === "boards" ? (
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
      <TaskDialog />
      <AgentDialog />
      <TeamDialog />
    </div>
  );
}
export default App;
