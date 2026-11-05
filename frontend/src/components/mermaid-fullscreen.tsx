import { useRef, useState, type RefObject } from "react";
import { t, useLocale } from "@/i18n";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import type { MermaidImage } from "./mermaid-renderer";

export function MermaidFullscreen({
  image,
  status,
  owner,
}: {
  image?: MermaidImage;
  status: string;
  owner: RefObject<HTMLElement | null>;
}) {
  useLocale();
  const trigger = useRef<HTMLButtonElement>(null);
  const [natural, setNatural] = useState(false);
  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) setNatural(false);
      }}
    >
      {image && (
        <DialogTrigger asChild>
          <Button ref={trigger} type="button" variant="ghost" size="sm">
            {t("common.mermaidMaximize")}
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className="mermaid-fullscreen"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          const target = trigger.current ?? owner.current;
          if (target) {
            event.preventDefault();
            target.focus({ preventScroll: true });
          }
        }}
      >
        <header className="mermaid-fullscreen-header">
          <DialogTitle>{t("common.mermaidDiagram")}</DialogTitle>
          {image && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              aria-pressed={natural}
              onClick={() => setNatural(!natural)}
            >
              {natural ? t("common.mermaidFit") : t("common.mermaidExpand")}
            </Button>
          )}
        </header>
        {image ? (
          <div
            className="mermaid-fullscreen-viewport"
            data-natural={natural}
            role="region"
            aria-label={t("common.mermaidDiagram")}
            tabIndex={0}
          >
            <img
              src={image.src}
              alt={image.description || t("common.mermaidDiagram")}
              style={natural ? { width: image.width } : undefined}
            />
          </div>
        ) : (
          <p role="status">{status}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
