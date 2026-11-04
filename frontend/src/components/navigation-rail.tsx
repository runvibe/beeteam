import { useLocale, t as tr } from "@/i18n";

import { Hexagon, Columns3, Users, Network } from "lucide-react";
import { Tooltip } from "radix-ui";
import { useUi } from "@/state/ui";
import { Button } from "./ui/button";
import { ThemeControl } from "./theme-control";
import { DataTransferSettings } from "@/features/data-transfer";

const sections = [
  {
    area: "boards",
    get label() {
      return tr("common.tasks");
    },
    get name() {
      return tr("common.tasks");
    },
    Icon: Columns3,
  },
  {
    area: "agents",
    get label() {
      return tr("common.agents");
    },
    get name() {
      return tr("common.agentResources");
    },
    Icon: Users,
  },
  {
    area: "teams",
    get label() {
      return tr("common.teams");
    },
    get name() {
      return tr("common.teams");
    },
    Icon: Network,
  },
] as const;

export function NavigationRail() {
  useLocale();
  const area = useUi((state) => state.area);
  const setArea = useUi((state) => state.setArea);
  return (
    <aside className="navigation-rail">
      <a
        className="navigation-logo"
        aria-label={tr("common.beeTeamGoToBoards")}
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
        <nav aria-label={tr("common.mainNavigation")}>
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
      <div
        className="navigation-footer"
        aria-label={tr("common.globalPreferences")}
      >
        <DataTransferSettings />
        <ThemeControl />
      </div>
    </aside>
  );
}
