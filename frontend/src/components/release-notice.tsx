import { NavigationTooltip } from "./navigation-tooltip";
import { CopyButton } from "@/components/copy-button";
import { ArrowDownToLine } from "lucide-react";
import { t, useLocale } from "@/i18n";
import { usePublicManifest } from "@/launch/public-manifest";
import { newerStableRelease } from "@/api/version-policy";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

export function ReleaseNotice({ installedVersion }: { installedVersion: string }) {
  useLocale();
  const { data } = usePublicManifest();
  if (!data || !newerStableRelease(installedVersion, data.appVersion)) return null;

  const prompt = t("common.releaseUpdatePrompt");
  return (
    <Dialog>
      <NavigationTooltip label={t("common.optionalUpdate")}>
      <DialogTrigger asChild>
        <Button className="navigation-button release-update-button" variant="ghost" size="icon"
          aria-label={t("common.optionalUpdate")}>
          <ArrowDownToLine aria-hidden="true" />
        </Button>
      </DialogTrigger>
      </NavigationTooltip>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("common.optionalUpdateAvailable", { version: data.appVersion })}</DialogTitle>
          <DialogDescription>{t("common.updateVersionDetails", { current: installedVersion, available: data.appVersion })}</DialogDescription>
        </DialogHeader>
        <p>{t("common.releaseCopyInstruction")}</p>
        <p className="rounded-md border p-3 text-sm select-text">{prompt}</p>
        <CopyButton text={prompt} label={t("common.releaseCopyAction")} />
      </DialogContent>
    </Dialog>
  );
}
