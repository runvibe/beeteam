import { useEffect, useState, type ComponentProps } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Copy } from "lucide-react";
import { BeeTeamLogo } from "./bee-team-logo";
import { Button } from "./ui/button";
import { t } from "@/i18n";

type Props = Pick<ComponentProps<typeof Button>, "size" | "variant"> & { text: string; label: string };

export function CopyButton({ text, label, ...props }: Props) {
  const [feedback, setFeedback] = useState<{ count: number; failed: boolean } | null>(null);
  const reduced = useReducedMotion();
  useEffect(() => setFeedback(null), [text]);
  useEffect(() => {
    if (!feedback || feedback.failed) return;
    const timer = window.setTimeout(() => setFeedback(null), 1800);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setFeedback(previous => ({ count: (previous?.count ?? 0) + 1, failed: false }));
    } catch {
      setFeedback({ count: 0, failed: true });
    }
  }

  const copied = feedback && !feedback.failed;
  return (
    <>
      <Button type="button" {...props} onClick={copy} aria-label={label}>
        <span className="relative inline-grid place-items-center">
          <span className={copied ? "invisible inline-flex items-center gap-2" : "inline-flex items-center gap-2"}><Copy aria-hidden="true" size={14} />{label}</span>
          {copied && <span key={feedback.count} aria-hidden="true" className="absolute grid size-6 place-items-center">
            <motion.span className="absolute inset-0" initial={{ rotate: 0 }} animate={{ rotate: reduced ? 0 : 180 }} transition={{ duration: 0.45 }}>
              <BeeTeamLogo className="size-full!" variant="thin" />
            </motion.span>
            <motion.span initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: 1 }} transition={{ delay: reduced ? 0 : 0.3 }}>
              <Check className="size-3!" />
            </motion.span>
          </span>}
        </span>
        <span role="status" className="sr-only">{copied && t("common.homePromptCopied")}</span>
      </Button>
      {feedback?.failed && <span role="status">{t("common.homeCopyFailed")}</span>}
    </>
  );
}
