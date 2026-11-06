import { useEffect, useState, type ComponentProps } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Copy } from "lucide-react";
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
          <motion.span className="inline-flex items-center gap-2" initial={false}
            animate={{ opacity: copied ? 0 : 1 }} transition={{ duration: reduced ? 0 : 0.16 }}>
            <Copy aria-hidden="true" size={14} />{label}
          </motion.span>
          {copied && <motion.span key={feedback.count} aria-hidden="true" className="absolute grid place-items-center"
            initial={{ opacity: reduced ? 1 : 0 }} animate={{ opacity: reduced ? 1 : [0, 1, 1, 0] }}
            transition={{ duration: reduced ? 0 : 1.8, times: [0, 0.12, 0.88, 1] }}>
            <Check size={16} />
          </motion.span>}
        </span>
        <span role="status" className="sr-only">{copied && t("common.homePromptCopied")}</span>
      </Button>
      {feedback?.failed && <span role="status">{t("common.homeCopyFailed")}</span>}
    </>
  );
}
