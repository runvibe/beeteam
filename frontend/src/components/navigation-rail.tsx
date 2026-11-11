import { useSiteLink } from "@/state/site-link";
import { NavigationTooltip } from "./navigation-tooltip";
import { BeeTeamLogo } from "./bee-team-logo";
import { useLocale, t as tr } from "@/i18n";

import { BookOpen, Columns3, Users, Network, House } from "lucide-react";
import { ReleaseNotice } from "./release-notice";
import { appVersion } from "@/app-version";
import { Tooltip } from "radix-ui";
import { useUi } from "@/state/ui";
import { Button } from "./ui/button";
import { ThemeControl } from "./theme-control";
import { DataTransferSettings } from "@/features/data-transfer";
import { ChatPanelToggle } from "@/features/chat-side-panel";
import { SessionsToggle } from "@/features/sessions-sidebar";
import { WorkspaceLayoutMenu } from "@/features/workspace-layout-menu";
import {
  navigationHref,
  destination,
  navigate,
  currentUrl,
} from "@/routing/location";

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

export function NavigationRail({
  homeEnabled = false,
}: { homeEnabled?: boolean } = {}) {
  useLocale();
  const area = useUi((state) => state.area);
  const setArea = useUi((state) => state.setArea);
  const siteLink = useSiteLink();
  const homeHref = area === "home" ? currentUrl() : destination("/home");
  const openHome = () => {
    if (area !== "home") navigate(homeHref);
  };
  return (
    <aside className="navigation-rail">
      <a
        className="navigation-logo"
        aria-label={
          homeEnabled
            ? tr("common.getBeeTeamGoHome")
            : tr("common.beeTeamGoToBoards")
        }
        title="Bee Team"
        href={navigationHref(homeEnabled ? homeHref : "/boards")}
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
          if (homeEnabled) openHome();
          else setArea("boards");
        }}
      >
        <BeeTeamLogo aria-hidden="true" />
      </a>
      <Tooltip.Provider delayDuration={300}>
        <nav aria-label={tr("common.mainNavigation")}>
          {homeEnabled && <ReleaseNotice installedVersion={appVersion} />}
          {homeEnabled && (
            <NavigationTooltip label={tr("common.home")}>
            <Button
              className="navigation-button"
              variant={area === "home" ? "secondary" : "ghost"}
              size="icon"
              aria-label={tr("common.home")}
              aria-current={area === "home" ? "page" : undefined}
              onClick={openHome}
            >
              <House aria-hidden="true" />
            </Button>
            </NavigationTooltip>
          )}
          {sections.map(({ area: target, label, name, Icon }) => (
            <NavigationTooltip key={target} label={label}>
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
            </NavigationTooltip>
          ))}
          <NavigationTooltip label={tr("sessions.title")}>
            <SessionsToggle className="navigation-button" />
          </NavigationTooltip>
          <NavigationTooltip label={tr("chat.title")}>
            <ChatPanelToggle className="navigation-button" />
          </NavigationTooltip>
          <WorkspaceLayoutMenu />
        </nav>
      </Tooltip.Provider>
      <div
        className="navigation-footer"
        aria-label={tr("common.globalPreferences")}
      >
        <Button asChild variant="ghost" size="icon">
          <a href={siteLink("/guide/")} aria-label={tr("common.guideDocumentation")} title={tr("common.guideDocumentation")}>
            <BookOpen aria-hidden="true" />
          </a>
        </Button>
        <DataTransferSettings />
        <ThemeControl />
      </div>
    </aside>
  );
}
