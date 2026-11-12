import { LayoutDashboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, useLocale } from "@/i18n";
import { useChatPanel } from "@/state/chat-panel";

export function ContentPanelToggle() {
  useLocale();
  const open = useChatPanel((state) => state.contentOpen);
  const setOpen = useChatPanel((state) => state.setContentOpen);
  const label = t("workspace.contentPanel");
  return (
    <Button
      id="content-panel-toggle"
      className="navigation-button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      aria-controls="content-panel"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
    >
      <LayoutDashboard aria-hidden="true" />
    </Button>
  );
}

export function ContentPanelClose() {
  useLocale();
  const setOpen = useChatPanel((state) => state.setContentOpen);
  const label = t("workspace.closeContent");
  return (
    <Button
      className="content-panel-close"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => {
        setOpen(false);
        document.getElementById("content-panel-toggle")?.focus();
      }}
    >
      <X aria-hidden="true" />
    </Button>
  );
}
