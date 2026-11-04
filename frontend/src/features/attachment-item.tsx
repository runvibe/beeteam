import { useLocale, t as tr } from "@/i18n";

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

export const categories: Record<
  AttachmentCategory,
  { icon: LucideIcon; label: string }
> = {
  image: {
    icon: FileImage,
    get label() {
      return tr("files.image");
    },
  },
  audio: {
    icon: FileAudio,
    get label() {
      return tr("files.audio");
    },
  },
  video: {
    icon: FileVideo,
    get label() {
      return tr("files.video");
    },
  },
  pdf: {
    icon: FileText,
    get label() {
      return tr("files.pdf");
    },
  },
  spreadsheet: {
    icon: FileSpreadsheet,
    get label() {
      return tr("files.spreadsheet");
    },
  },
  presentation: {
    icon: FileChartColumn,
    get label() {
      return tr("files.presentation");
    },
  },
  document: {
    icon: FileText,
    get label() {
      return tr("files.document");
    },
  },
  archive: {
    icon: FileArchive,
    get label() {
      return tr("files.archive");
    },
  },
  code: {
    icon: FileCode,
    get label() {
      return tr("files.codeData");
    },
  },
  text: {
    icon: FileText,
    get label() {
      return tr("errors.text");
    },
  },
  file: {
    icon: File,
    get label() {
      return tr("files.file");
    },
  },
};

export function Attachment({ item }: { item: Resources["attachments"] }) {
  useLocale();
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
              title={tr("files.removedAt", {
                date: formatDate(item.deletedAt),
              })}
            >
              {tr("files.removed")}
            </Badge>
          )}
        </div>
        <p className="attachment-metadata">
          <span title={item.mediaType}>{category.label}</span>
          <span aria-hidden="true">·</span>
          <span title={tr("files.bytes", { count: item.sizeBytes })}>
            {formatAttachmentSize(item.sizeBytes)}
          </span>
        </p>
        <div className="attachment-provenance">
          <AgentName id={item.actorId} />
          <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
        </div>
        {item.deletedAt && (
          <p className="attachment-metadata">
            {tr("files.removedAt", { date: formatDate(item.deletedAt) })}
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
        {busy ? tr("files.preparing") : tr("files.downloadFile")}
      </Button>
    </article>
  );
}
