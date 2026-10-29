import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
export const HeaderFiltersContext = createContext<HTMLElement | null>(null);
export function HeaderFilters({
  enabled,
  children,
}: {
  enabled: boolean;
  children: ReactNode;
}) {
  const target = useContext(HeaderFiltersContext);
  return enabled && target ? (
    <>
      <span hidden className="filter-bar-portaled" />
      {createPortal(children, target)}
    </>
  ) : (
    children
  );
}
