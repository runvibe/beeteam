import { createContext, useContext } from "react";
export const CompactFilters = createContext(false);
export const FilterDirectionContext = createContext<"bottom" | "right">(
  "bottom",
);
export const useCompactFilters = () => useContext(CompactFilters);
export type ActiveFilter = {
  id?: string;
  label: string;
  value: string;
  onRemove?: () => void;
};
export const FilterSummaryContext = createContext<
  ((id: string, filter?: ActiveFilter) => void) | null
>(null);
