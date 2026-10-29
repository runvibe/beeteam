import { createContext, useContext } from "react";
export const CompactFilters = createContext(false);
export const useCompactFilters = () => useContext(CompactFilters);
