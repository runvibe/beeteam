import { useState } from "react";
import {
  Download,
  File,
  FileImage,
  FileAudio,
  FileVideo,
  FileText,
  FileSpreadsheet,
  FileChartColumn,
  FileArchive,
  FileCode,
  type LucideIcon,
} from "lucide-react";
import { useApi } from "@/api/context";
import type { Resources } from "@/api/types";
import { AgentName } from "@/components/names";
import { Markdown } from "@/components/markdown";
import { Failure, formatDate } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  attachmentCategory,
  formatAttachmentSize,
  type AttachmentCategory,
} from "./attachment-presentation";
import "./attachment-item.css";

const categories: Record<
  AttachmentCategory,
  { icon: LucideIcon; label: string }
> = {
  image: { icon: FileImage, label: "Imagem" },
  audio: { icon: FileAudio, label: "Áudio" },
  video: { icon: FileVideo, label: "Vídeo" },
  pdf: { icon: FileText, label: "PDF" },
  spreadsheet: { icon: FileSpreadsheet, label: "Planilha" },
  presentation: { icon: FileChartColumn, label: "Apresentação" },
  document: { icon: FileText, label: "Documento" },
  archive: { icon: FileArchive, label: "Arquivo compactado" },
  code: { icon: FileCode, label: "Código / dados" },
  text: { icon: FileText, label: "Texto" },
  file: { icon: File, label: "Arquivo" },
};

export function Attachment({ item }: { item: Resources["attachments"] }) {
  const api = useApi();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const category =
    categories[attachmentCategory(item.mediaType, item.originalName)];
  const Icon = category.icon;
  async function download() {
    if (busy || item.deletedAt) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await api.download(item.taskId, item.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = item.originalName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article
      className="attachment-item"
      aria-label={item.originalName}
      data-removed={!!item.deletedAt}
    >
      <div className="attachment-kind" aria-hidden="true">
        <Icon />
      </div>
      <div className="attachment-body">
        <div className="attachment-heading">
          <h3>{item.originalName}</h3>
          {item.deletedAt && (
            <Badge
              variant="secondary"
              title={`Removido em ${formatDate(item.deletedAt)}`}
            >
              Removido
            </Badge>
          )}
        </div>
        <p className="attachment-metadata">
          <span title={item.mediaType}>{category.label}</span>
          <span aria-hidden="true">·</span>
          <span title={`${item.sizeBytes} bytes`}>
            {formatAttachmentSize(item.sizeBytes)}
          </span>
        </p>
        <div className="attachment-provenance">
          <AgentName id={item.actorId} />
          <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
        </div>
        {item.deletedAt && (
          <p className="attachment-metadata">
            Removido em {formatDate(item.deletedAt)}
          </p>
        )}
        {item.description && (
          <div className="attachment-description">
            <Markdown headingOffset={2} sectionDividers>
              {item.description}
            </Markdown>
          </div>
        )}
        {error && <Failure error={error} />}
      </div>
      <Button
        className="attachment-download"
        variant="outline"
        size="sm"
        disabled={busy || !!item.deletedAt}
        onClick={() => void download()}
      >
        <Download data-icon="inline-start" />
        {busy ? "Preparando…" : "Baixar arquivo"}
      </Button>
    </article>
  );
}
