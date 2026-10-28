// Generated from contracts/ra-openapi.yaml. Do not edit.
export type CreateAgent = {
  name: string;
  /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
  roleDescription?: string;
  /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
  workStyle?: string;
  /** @description Máximo 64 KiB UTF-8; texto, não transcrição integral. */
  workInstructions?: string;
  rules?: string[];
  accessLimits?: string[];
  image?: import("./ExternalImage").ExternalImage | null;
  contextSummary?: string;
};
