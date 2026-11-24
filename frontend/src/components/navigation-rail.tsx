import { useSiteLink } from "@/state/site-link";
import { NavigationTooltip } from "./navigation-tooltip";
import { BeeTeamLogo } from "./bee-team-logo";
import { useLocale, t as tr } from "@/i18n";

import { BookOpen, Boxes, House } from "lucide-react";
import { ReleaseNotice } from "./release-notice";
import { appVersion } from "@/app-version";
import { Tooltip } from "radix-ui";
import { useUi } from "@/state/ui";
import { Button } from "./ui/button";
import { ThemeControl } from "./theme-control";
import { DataTransferSettings } from "@/features/data-transfer";
import { WorkspaceLayoutMenu } from "@/features/workspace-layout-menu";
import { useChatPanel } from "@/state/chat-panel";
import { CONTENT_DESTINATION_ID } from "@/features/content-panel-controls";
import {
  isHiveArea,
  lastHiveDestination,
  useRememberHiveLocation,
} from "@/state/hive-navigation";
import {
  navigationHref,
  destination,
  navigate,
  currentUrl,
} from "@/routing/location";

export function NavigationRail({
  homeEnabled = false,
}: { homeEnabled?: boolean } = {}) {
  useLocale();
  const area = useUi((state) => state.area);
  const setArea = useUi((state) => state.setArea);
  const contentOpen = useChatPanel((state) => state.contentOpen);
  const showContent = useChatPanel((state) => state.setContentOpen);
  const siteLink = useSiteLink();
  useRememberHiveLocation();
  const section = isHiveArea(area) ? "hive" : area;
  const homeHref = area === "home" ? currentUrl() : destination("/home");
  const openHome = () => {
    useChatPanel.getState().startNewSession(null);
    showContent(false, "home");
    if (area !== "home") navigate(homeHref);
  };
  const destinationState = (target: string) => {
    const owner = section === target;
    const active = contentOpen && owner;
    return {
      id: owner ? CONTENT_DESTINATION_ID : undefined,
      variant: active ? ("secondary" as const) : ("ghost" as const),
      "aria-current": active ? ("page" as const) : undefined,
      "aria-controls": owner ? "content-panel" : undefined,
      "aria-expanded": owner ? contentOpen : undefined,
    };
  };
  const selectDestination = (target: string, open: () => void) => {
    if (section === target) showContent(!contentOpen);
    else open();
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
          showContent(true);
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
              variant={section === "home" ? "secondary" : "ghost"}
              aria-current={section === "home" ? "page" : undefined}
              aria-controls="leader-chat-panel"
              size="icon"
              aria-label={tr("common.home")}
              onClick={openHome}
            >
              <House aria-hidden="true" />
            </Button>
            </NavigationTooltip>
          )}
          <NavigationTooltip label={tr("common.hive")}>
            <Button
              className="navigation-button"
              {...destinationState("hive")}
              size="icon"
              aria-label={tr("common.hive")}
              onClick={() =>
                selectDestination("hive", () => {
                  showContent(true);
                  navigate(lastHiveDestination());
                })
              }
            >
              <Boxes aria-hidden="true" />
            </Button>
          </NavigationTooltip>
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
        <WorkspaceLayoutMenu />
        <DataTransferSettings />
        <ThemeControl />
      </div>
    </aside>
  );
}
