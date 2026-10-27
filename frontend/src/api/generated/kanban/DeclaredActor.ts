// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type DeclaredActor =
  | {
      /** @constant */
      actorKind: "human";
      actorId: null;
    }
  | {
      /** @constant */
      actorKind: "agent";
      /** Format: uuid */
      actorId: string;
    };
