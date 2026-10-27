// Generated from contracts/ra-openapi.yaml. Do not edit.
export type CopyAgent = {
  name?: string;
  /** Format: uuid */
  targetTeamId: string;
  expectedTeamVersion: number;
  coordinationContext: import("./ApprovalCoordinationContext").ApprovalCoordinationContext;
  /** @description Quando explicitamente solicitado, texto resumido a colocar na nova identidade. Omissão deixa vazio; não importar histórico automaticamente. */
  contextSummary?: string;
};
