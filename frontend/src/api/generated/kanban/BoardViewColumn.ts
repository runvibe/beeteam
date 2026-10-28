// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type BoardViewColumn = {
  status: import("./Status").Status;
  tasks: import("./Task").Task[];
  total: number;
  /** @description Offset solicitado; no quadro é sempre zero. */
  offset: number;
  /** @description Limite efetivamente solicitado/aplicado. */
  limit: number;
  /** @description offset + quantidade de itens retornados < total. */
  hasMore: boolean;
  /** @description offset + quantidade de itens retornados quando hasMore; senão null. */
  nextOffset: number | null;
};
