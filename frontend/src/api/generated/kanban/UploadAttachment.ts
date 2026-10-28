// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type UploadAttachment = {
  /**
   * Format: binary
   * @description Bytes, máximo 20 MiB.
   */
  file: string;
  /** @description Markdown, máximo 65536 bytes UTF-8. */
  description?: string;
};
