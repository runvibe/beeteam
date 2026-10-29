import { createContext, useContext } from "react";
export const CompactFilters = createContext(false);
export const useCompactFilters = () => useContext(CompactFilters);
export type ActiveFilter = {
  label: string;
  value: string;
  onRemove?: () => void;
};
export const FilterSummaryContext = createContext<
  ((id: string, filter?: ActiveFilter) => void) | null
>(null);
