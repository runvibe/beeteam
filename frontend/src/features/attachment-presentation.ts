export type AttachmentCategory =
  | "image"
  | "audio"
  | "video"
  | "pdf"
  | "spreadsheet"
  | "presentation"
  | "document"
  | "archive"
  | "code"
  | "text"
  | "file";

const extensions = new Map<string, AttachmentCategory>();
for (const [category, list] of Object.entries({
  image: "png jpg jpeg gif webp avif svg bmp ico heic tiff",
  audio: "mp3 wav ogg flac m4a aac opus",
  video: "mp4 webm mov avi mkv m4v",
  pdf: "pdf",
  spreadsheet: "csv tsv xls xlsx ods",
  presentation: "ppt pptx odp",
  document: "doc docx odt rtf",
  archive: "zip gz tar tgz bz2 xz 7z rar",
  code: "json xml yaml yml js jsx ts tsx py rs html css sql sh",
  text: "txt md markdown log",
})) {
  for (const extension of list.split(" "))
    extensions.set(extension, category as AttachmentCategory);
}

export function attachmentCategory(
  mediaType: string,
  name: string,
): AttachmentCategory {
  const mime = mediaType.split(";")[0].trim().toLowerCase();
  if (
    !mime ||
    mime === "application/octet-stream" ||
    mime === "binary/octet-stream"
  ) {
    const dot = name.lastIndexOf(".");
    return dot > 0
      ? (extensions.get(name.slice(dot + 1).toLowerCase()) ?? "file")
      : "file";
  }
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("audio/")) return "audio";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  if (
    [
      "text/csv",
      "text/tab-separated-values",
      "application/vnd.ms-excel",
    ].includes(mime) ||
    mime.startsWith(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.",
    ) ||
    mime.startsWith("application/vnd.oasis.opendocument.spreadsheet")
  )
    return "spreadsheet";
  if (
    mime === "application/vnd.ms-powerpoint" ||
    mime.startsWith(
      "application/vnd.openxmlformats-officedocument.presentationml.",
    ) ||
    mime.startsWith("application/vnd.oasis.opendocument.presentation")
  )
    return "presentation";
  if (
    ["application/msword", "application/rtf", "text/rtf"].includes(mime) ||
    mime.startsWith(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.",
    ) ||
    mime.startsWith("application/vnd.oasis.opendocument.text")
  )
    return "document";
  if (
    [
      "application/zip",
      "application/x-zip-compressed",
      "application/gzip",
      "application/x-gzip",
      "application/x-tar",
      "application/x-7z-compressed",
      "application/vnd.rar",
      "application/x-rar-compressed",
      "application/x-bzip2",
      "application/x-xz",
    ].includes(mime)
  )
    return "archive";
  if (
    [
      "application/json",
      "application/xml",
      "application/javascript",
      "application/yaml",
      "text/javascript",
      "text/html",
      "text/css",
      "text/xml",
      "text/yaml",
    ].includes(mime) ||
    mime.endsWith("+json") ||
    mime.endsWith("+xml")
  )
    return "code";
  if (mime.startsWith("text/")) return "text";
  return "file";
}

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
export function formatAttachmentSize(bytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index =
    bytes > 0
      ? Math.min(Math.floor(Math.log10(bytes) / 3), units.length - 1)
      : 0;
  return `${number.format(bytes / 1000 ** index)} ${units[index]}`;
}
