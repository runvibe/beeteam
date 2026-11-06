import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDownToLine, Check, Hexagon } from "lucide-react";
import { t, useLocale } from "@/i18n";
import { usePublicManifest } from "@/launch/public-manifest";
import { newerStableRelease } from "@/api/version-policy";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

export function ReleaseNotice({ installedVersion }: { installedVersion: string }) {
  useLocale();
  const { data } = usePublicManifest();
  const [feedback, setFeedback] = useState<"copied" | "failed" | null>(null);
  const [animation, setAnimation] = useState(0);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (feedback !== "copied") return;
    const timeout = window.setTimeout(() => setFeedback(null), 1800);
    return () => window.clearTimeout(timeout);
  }, [feedback, animation]);
  if (!data || !newerStableRelease(installedVersion, data.appVersion)) return null;

  const prompt = t("common.releaseUpdatePrompt");
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setAnimation(previous => previous + 1);
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  }

  return (
    <Dialog onOpenChange={() => setFeedback(null)}>
      <DialogTrigger asChild>
        <Button className="navigation-button release-update-button" variant="ghost" size="icon"
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
        <Button onClick={copy} aria-label={t("common.releaseCopyAction")}>
          {feedback === "copied" ? (
            <span key={animation} className="relative grid size-6 place-items-center" aria-hidden="true">
              <motion.span className="absolute inset-0" initial={{ rotate: 0 }}
                animate={{ rotate: reducedMotion ? 0 : 180 }} transition={{ duration: 0.45 }}>
                <Hexagon className="size-full!" strokeWidth={2.3} />
              </motion.span>
              <motion.span initial={{ opacity: reducedMotion ? 1 : 0 }} animate={{ opacity: 1 }}
                transition={{ delay: reducedMotion ? 0 : 0.3 }}>
                <Check className="size-3!" />
              </motion.span>
            </span>
          ) : t("common.releaseCopyAction")}
          <span role="status" className="sr-only">{feedback === "copied" && t("common.homePromptCopied")}</span>
        </Button>
        {feedback === "failed" && <p role="status">{t("common.homeCopyFailed")}</p>}
      </DialogContent>
    </Dialog>
  );
}
