import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t, useLocale } from "@/i18n";
import { useChatPanel } from "@/state/chat-panel";

export const CONTENT_DESTINATION_ID = "content-panel-destination";

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
        document.getElementById(CONTENT_DESTINATION_ID)?.focus();
      }}
    >
      <X aria-hidden="true" />
    </Button>
  );
}
