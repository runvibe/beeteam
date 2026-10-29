import { useCallback, useLayoutEffect, useRef } from "react";

export function useFilterRemoval(remove: (() => void) | undefined) {
  const latest = useRef(remove);
  useLayoutEffect(() => {
    latest.current = remove;
  });
  return useCallback(() => latest.current?.(), []);
}
