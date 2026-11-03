import { expect, it } from "vitest";
import {
  attachmentCategory,
  formatAttachmentSize,
} from "./attachment-presentation";

it.each([
  ["image/png", "report.pdf", "image"],
  [" VIDEO/MP4 ; codecs=avc1", "clip", "video"],
  ["audio/ogg", "recording", "audio"],
  ["application/pdf", "report", "pdf"],
  ["text/csv", "data", "spreadsheet"],
  [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "data",
    "spreadsheet",
  ],
  ["application/vnd.oasis.opendocument.presentation", "deck", "presentation"],
  ["application/msword", "document", "document"],
  ["application/zip", "archive", "archive"],
  ["application/problem+json", "response", "code"],
  ["text/plain", "misleading.zip", "text"],
  ["application/octet-stream", "REPORT.PDF", "pdf"],
  ["", "source.tsx", "code"],
  ["application/x-unknown", "looks-like.pdf", "file"],
  ["application/octet-stream", "unknown.custom", "file"],
  ["application/octet-stream", "pdf", "file"],
  ["application/octet-stream", "file.constructor", "file"],
])("classifies %s / %s from MIME before extension", (mime, name, category) => {
  expect(attachmentCategory(mime, name)).toBe(category);
});

it("formats zero, small and large file sizes without losing exact bytes in the record", () => {
  expect(formatAttachmentSize(0)).toBe("0 B");
  expect(formatAttachmentSize(98)).toBe("98 B");
  expect(formatAttachmentSize(1500)).toBe("1,5 KB");
  expect(formatAttachmentSize(2500000)).toBe("2,5 MB");
});
