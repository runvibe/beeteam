import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import { t, useLocale } from "@/i18n";
import { themeController } from "@/state/theme-runtime";
import { Button } from "./ui/button";
import { mermaidSourceFailure, type MermaidFailure } from "./mermaid-policy";
import { renderMermaid, type MermaidImage } from "./mermaid-renderer";
import "./mermaid-diagram.css";

export function MermaidDiagram({
  source,
  limited = false,
}: {
  source: string;
  limited?: boolean;
}) {
  useLocale();
  const theme = useStore(themeController.store, (s) => s.resolved);
  const element = useRef<HTMLElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState(
    typeof IntersectionObserver === "undefined",
  );
  const [result, setResult] = useState<{
    source: string;
    theme: string;
    image?: MermaidImage;
    failure?: MermaidFailure;
  }>();
  const failure = limited ? "limit" : mermaidSourceFailure(source);
  const current =
    result?.source === source && result.theme === theme ? result : undefined;
  const error = failure ?? current?.failure;

  useEffect(() => {
    if (visible || !element.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(element.current);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || failure) return;
    const controller = new AbortController();
    void renderMermaid(source, theme, controller.signal).then(
      (image) => {
        if (!controller.signal.aborted) setResult({ source, theme, image });
      },
      () => {
        if (!controller.signal.aborted)
          setResult({ source, theme, failure: "render" });
      },
    );
    return () => controller.abort();
  }, [source, theme, visible, failure]);

  return (
    <figure className="mermaid-diagram" ref={element}>
      {current?.image && !error ? (
        <div
          className={`mermaid-viewport${expanded ? " mermaid-expanded" : ""}`}
          role="region"
          tabIndex={0}
          aria-label={t("common.mermaidDiagram")}
        >
          <img
            src={current.image.src}
            alt={current.image.description || t("common.mermaidDiagram")}
            style={{ width: Math.min(current.image.width, 2400) }}
          />
        </div>
      ) : (
        <p className="small-note" role="status">
          {error === "limit"
            ? t("common.mermaidLimit")
            : error === "unsafe"
              ? t("common.mermaidUnsafe")
              : error
                ? t("common.mermaidError")
                : t("common.mermaidLoading")}
        </p>
      )}
      {current?.image && !error && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t("common.mermaidFit") : t("common.mermaidExpand")}
        </Button>
      )}
      <details open={error ? true : undefined}>
        <summary>{t("common.mermaidSource")}</summary>
        <pre>
          <code>{source}</code>
        </pre>
      </details>
    </figure>
  );
}
