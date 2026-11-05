// Generated from contracts/ra-openapi.yaml. Do not edit.
export type TeamComposition = {
  /** Format: uuid */
  teamId: string;
  expectedVersion: number;
  /** Format: uuid */
  leaderId: string;
  workerIds: string[];
};
