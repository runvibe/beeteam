import { Check, History, LayoutDashboard, MessageSquare, PanelsTopLeft } from "lucide-react";
import { Popover, RadioGroup } from "radix-ui";
import { Button } from "@/components/ui/button";
import { NavigationTooltip } from "@/components/navigation-tooltip";
import { useLocale, t } from "@/i18n";
import { useChatPanel } from "@/state/chat-panel";
import type { WorkspacePanel } from "@/state/workspace-layout";
import { workspacePanelName } from "./workspace-panel-dock";
import "./workspace-layout-menu.css";

const layouts: readonly (readonly WorkspacePanel[])[] = [
  ["sessions", "content", "chat"],
  ["sessions", "chat", "content"],
  ["content", "sessions", "chat"],
  ["content", "chat", "sessions"],
  ["chat", "sessions", "content"],
  ["chat", "content", "sessions"],
];
const icons = { sessions: History, content: LayoutDashboard, chat: MessageSquare };

export function WorkspaceLayoutMenu() {
  useLocale();
  const order = useChatPanel((state) => state.panelOrder);
  const setPanelOrder = useChatPanel((state) => state.setPanelOrder);
  const label = t("workspace.layouts");
  return (
    <Popover.Root>
      <NavigationTooltip label={label}>
        <Popover.Trigger asChild>
          <Button
            className="navigation-button workspace-layout-toggle"
            variant="ghost"
            size="icon"
            aria-label={label}
          >
            <PanelsTopLeft aria-hidden="true" />
          </Button>
        </Popover.Trigger>
      </NavigationTooltip>
      <Popover.Portal>
        <Popover.Content
          className="workspace-layout-popover"
          side="right"
          align="start"
          sideOffset={10}
          collisionPadding={8}
          aria-label={label}
        >
          <h2>{label}</h2>
          <p>{t("workspace.layoutHint")}</p>
          <RadioGroup.Root
            aria-label={label}
            className="workspace-layout-options"
            value={order.join(",")}
            onValueChange={(value) => {
              const next = layouts.find((item) => item.join(",") === value);
              if (next) setPanelOrder(next);
            }}
          >
            {layouts.map((layout) => {
              const names = layout.map(workspacePanelName);
              return (
                <RadioGroup.Item
                  key={layout.join(",")}
                  value={layout.join(",")}
                  aria-label={names.join(", ")}
                  className="workspace-layout-option"
                >
                  <span className="workspace-layout-preview" aria-hidden="true">
                    {layout.map((panel) => {
                      const Icon = icons[panel];
                      return <span key={panel} data-panel={panel}><Icon /></span>;
                    })}
                  </span>
                  <span className="workspace-layout-name">{names.join(" · ")}</span>
                  <RadioGroup.Indicator className="workspace-layout-check">
                    <Check aria-hidden="true" />
                  </RadioGroup.Indicator>
                </RadioGroup.Item>
              );
            })}
          </RadioGroup.Root>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
