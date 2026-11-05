import { useEffect, useState, type ReactNode } from "react";
import { Check, Copy, Link as LinkIcon } from "lucide-react";
import { t } from "@/i18n";

export function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="guide-block">
      <h2 id={id}>
        <a href={"#" + id}>
          {title}
          <LinkIcon aria-hidden="true" size={15} />
        </a>
      </h2>
      {children}
    </section>
  );
}
export function Snippet({ label, text }: { label: string; text: string }) {
  const [status, setStatus] = useState<"copied" | "failed" | null>(null);
  useEffect(() => setStatus(null), [text]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }
  return (
    <div className="guide-snippet">
      <div>
        <span>{label}</span>
        <button type="button" onClick={() => void copy()}>
          {status === "copied" ? <Check size={14} /> : <Copy size={14} />}{" "}
          {t(status === "copied" ? "guide.copied" : "guide.copy")}
        </button>
      </div>
      <pre>
        <code>{text}</code>
      </pre>
      {status === "failed" && <p role="status">{t("guide.selectAndCopy")}</p>}
    </div>
  );
}
