import { useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { t, useLocale } from "@/i18n";
import { usePublicManifest } from "@/launch/public-manifest";
import { newerStableRelease } from "@/api/version-policy";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

export function ReleaseNotice({ installedVersion }: { installedVersion: string }) {
  useLocale();
  const { data } = usePublicManifest();
  const [feedback, setFeedback] = useState<"copied" | "failed" | null>(null);
  if (!data || !newerStableRelease(installedVersion, data.appVersion)) return null;

  const prompt = t("common.releaseUpdatePrompt");
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  }

  return (
    <Dialog onOpenChange={() => setFeedback(null)}>
      <DialogTrigger asChild>
        <Button className="navigation-button" variant="ghost" size="icon"
          aria-label={t("common.optionalUpdate")} title={t("common.optionalUpdate")}>
          <ArrowDownToLine aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("common.optionalUpdateAvailable", { version: data.appVersion })}</DialogTitle>
          <DialogDescription>{t("common.updateVersionDetails", { current: installedVersion, available: data.appVersion })}</DialogDescription>
        </DialogHeader>
        <p>{t("common.releaseCopyInstruction")}</p>
        <p className="rounded-md border p-3 text-sm select-text">{prompt}</p>
        <Button onClick={copy}>{t("common.releaseCopyAction")}</Button>
        {feedback && <p role="status">{t(feedback === "copied" ? "common.homePromptCopied" : "common.homeCopyFailed")}</p>}
      </DialogContent>
    </Dialog>
  );
}
