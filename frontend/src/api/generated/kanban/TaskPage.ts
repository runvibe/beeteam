// Generated from contracts/kanban-openapi.yaml. Do not edit.
export type TaskPage = {
  items: import("./Task").Task[];
  /** @description Offset solicitado; no quadro é sempre zero. */
  offset: number;
  /** @description Limite efetivamente solicitado/aplicado. */
  limit: number;
  total: number;
  /** @description offset + quantidade de itens retornados < total. */
  hasMore: boolean;
  /** @description offset + quantidade de itens retornados quando hasMore; senão null. */
  nextOffset: number | null;
};
