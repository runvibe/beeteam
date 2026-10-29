import { createContext, useContext } from "react";
export const CompactFilters = createContext(false);
export const useCompactFilters = () => useContext(CompactFilters);
export type ActiveFilter = { label: string; value: string };
export const FilterSummaryContext = createContext<
  ((id: string, filter?: ActiveFilter) => void) | null
>(null);
