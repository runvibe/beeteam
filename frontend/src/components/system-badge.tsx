import { Badge } from "@/components/ui/badge";
import { useLocale, t } from "@/i18n";

/** Marks Bee Team-owned onboarding resources; the server enforces their protection. */
export function SystemBadge({ system }: { system?: boolean }) {
  useLocale();
  if (!system) return null;
  return (
    <Badge variant="outline" title={t("common.systemHint")}>
      {t("common.system")}
    </Badge>
  );
}
