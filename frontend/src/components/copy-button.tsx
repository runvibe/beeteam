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
        <motion.span key={copied ? feedback.count : "idle"} aria-hidden="true"
          className="inline-grid size-4 shrink-0 place-items-center"
          initial={copied && !reduced ? { opacity: 0 } : false}
          animate={{ opacity: 1 }} transition={{ duration: reduced ? 0 : 0.15 }}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </motion.span>
        {label}
        <span role="status" className="sr-only">{copied && t("common.homePromptCopied")}</span>
      </Button>
      {feedback?.failed && <span role="status">{t("common.homeCopyFailed")}</span>}
    </>
  );
}
