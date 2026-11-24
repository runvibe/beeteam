import { useCallback, useRef, type ReactNode } from "react";
import { t } from "@/i18n";
import { CopyButton } from "./copy-button";
import "./markdown-table.css";

function cellText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node instanceof HTMLBRElement) return "\n";
  if (node instanceof HTMLImageElement) return node.alt;
  return Array.from(node.childNodes, cellText).join("");
}

function tableCsv(table: HTMLTableElement): string {
  return Array.from(table.rows, (row) =>
    Array.from(row.cells, (cell) => {
      const value = cellText(cell).replace(/\r\n?|\n/g, "\r\n");
      return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(","),
  ).join("\r\n");
}

export function ChatMarkdownTable({ children }: { children?: ReactNode }) {
  const table = useRef<HTMLTableElement>(null);
  const text = useCallback(() => {
    if (!table.current) throw new Error();
    return tableCsv(table.current);
  }, []);

  return (
    <div
      className="markdown-table markdown-table-copyable"
      role="region"
      aria-label={t("common.table")}
    >
      <div className="markdown-table-scroll" tabIndex={0}>
        <table ref={table}>{children}</table>
      </div>
      <CopyButton
        className="markdown-table-copy"
        size="icon-sm"
        variant="outline"
        iconOnly
        text={text}
        label={t("common.copyTableCsv")}
        copiedMessage={t("common.tableCopied")}
        failedMessage={t("common.tableCopyFailed")}
      />
    </div>
  );
}
