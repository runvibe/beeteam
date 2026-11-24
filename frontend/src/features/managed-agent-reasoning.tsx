import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { Markdown } from "@/components/markdown";
import { t } from "@/i18n";

/** Collapsible, low-emphasis reasoning summary: open while active, collapsed afterwards. */
export function MessageReasoning({
  text,
  active,
}: {
  text: string;
  active: boolean;
}) {
  const [open, setOpen] = useState(active);
  useEffect(() => setOpen(active), [active]);
  return (
    <details
      className="assistant-reasoning"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>
        <Brain aria-hidden="true" />
        {active ? t("managed.reasoningActive") : t("managed.reasoning")}
      </summary>
      <div className="assistant-reasoning-body">
        <Markdown>{text}</Markdown>
      </div>
    </details>
  );
}
