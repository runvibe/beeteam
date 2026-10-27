// Generated from contracts/ra-openapi.yaml. Do not edit.
export type UploadedImage = {
  /** @constant */
  kind: "upload";
  /** Format: uuid */
  imageId: string;
  /** @enum {string} */
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  sizeBytes: number;
  contentPath: string;
  /** Format: date-time */
  deletedAt: string | null;
};
