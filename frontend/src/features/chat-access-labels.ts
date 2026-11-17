import { t } from "@/i18n";
import type { AccessMode } from "@/state/chat-access";

export function accessLabel(mode: AccessMode) {
  return t(`chat.access_${mode}`);
}

export function confirmAccess(mode: AccessMode) {
  return mode !== "full_access" || window.confirm(t("chat.accessFullWarning"));
}
