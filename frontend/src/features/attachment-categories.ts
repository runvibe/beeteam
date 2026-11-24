import {
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
import { t } from "@/i18n";
import type { AttachmentCategory } from "./attachment-presentation";

export const categories: Record<
  AttachmentCategory,
  { icon: LucideIcon; label: string }
> = {
  image: {
    icon: FileImage,
    get label() {
      return t("files.image");
    },
  },
  audio: {
    icon: FileAudio,
    get label() {
      return t("files.audio");
    },
  },
  video: {
    icon: FileVideo,
    get label() {
      return t("files.video");
    },
  },
  pdf: {
    icon: FileText,
    get label() {
      return t("files.pdf");
    },
  },
  spreadsheet: {
    icon: FileSpreadsheet,
    get label() {
      return t("files.spreadsheet");
    },
  },
  presentation: {
    icon: FileChartColumn,
    get label() {
      return t("files.presentation");
    },
  },
  document: {
    icon: FileText,
    get label() {
      return t("files.document");
    },
  },
  archive: {
    icon: FileArchive,
    get label() {
      return t("files.archive");
    },
  },
  code: {
    icon: FileCode,
    get label() {
      return t("files.codeData");
    },
  },
  text: {
    icon: FileText,
    get label() {
      return t("errors.text");
    },
  },
  file: {
    icon: File,
    get label() {
      return t("files.file");
    },
  },
};
