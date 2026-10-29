import { Hexagon, Columns3, Users, Network } from "lucide-react";
import { Tooltip } from "radix-ui";
import { useUi } from "@/state/ui";
import { Button } from "./ui/button";

const sections = [
  { area: "boards", label: "Tarefas", name: "Tarefas", Icon: Columns3 },
  {
    area: "agents",
    label: "Agentes",
    name: "Recursos de Agentes",
    Icon: Users,
  },
  { area: "teams", label: "Times", name: "Times", Icon: Network },
] as const;

export function NavigationRail() {
  const area = useUi((state) => state.area);
  const setArea = useUi((state) => state.setArea);
  return (
    <aside className="navigation-rail">
      <a
        className="navigation-logo"
        aria-label="Bee Team — ir para boards"
        title="Bee Team"
        href="/boards"
        onClick={(event) => {
          if (
            event.button ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          setArea("boards");
        }}
      >
        <Hexagon aria-hidden="true" />
      </a>
      <Tooltip.Provider delayDuration={300}>
        <nav aria-label="Navegação principal">
          {sections.map(({ area: target, label, name, Icon }) => (
            <Tooltip.Root key={target}>
              <Tooltip.Trigger asChild>
                <Button
                  className="navigation-button"
                  variant={area === target ? "secondary" : "ghost"}
                  size="icon"
                  aria-label={name}
                  aria-current={area === target ? "page" : undefined}
                  onClick={() => setArea(target)}
                >
                  <Icon aria-hidden="true" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  className="navigation-tooltip"
                  side="right"
                  sideOffset={8}
                  collisionPadding={8}
                >
                  {label}
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          ))}
        </nav>
      </Tooltip.Provider>
    </aside>
  );
}
