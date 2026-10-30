import { useLayoutEffect, useRef, type RefObject } from "react";
import type { usePlanPages } from "./plan-pages";

export function planRevealOffset(node: HTMLElement, item: HTMLElement) {
  const desired =
    node.scrollTop +
    item.getBoundingClientRect().top -
    node.getBoundingClientRect().top;
  return {
    desired: Math.max(0, desired),
    maximum: Math.max(0, node.scrollHeight - node.clientHeight),
  };
}

export function usePlanReveal(
  list: RefObject<HTMLElement | null>,
  selected: string | undefined,
  plans: ReturnType<typeof usePlanPages>,
  mobile: boolean,
) {
  const pending = useRef({ selected, revealed: false, manual: false });
  useLayoutEffect(() => {
    if (pending.current.selected !== selected)
      pending.current = { selected, revealed: false, manual: false };
    const state = pending.current;
    const node = list.current;
    if (
      mobile ||
      !node ||
      !selected ||
      state.revealed ||
      state.manual ||
      plans.query.isFetching
    )
      return;
    const item = Array.from(
      node.querySelectorAll<HTMLElement>("[data-plan-id]"),
    ).find((item) => item.dataset.planId === selected);
    if (!item) return;
    const frame = requestAnimationFrame(() => {
      if (state !== pending.current || state.manual) return;
      const { desired, maximum } = planRevealOffset(node, item);
      // Load only enough following rows to align the selected item, or reach the real end.
      if (
        desired > maximum + 1 &&
        plans.query.hasNextPage &&
        !plans.query.error
      ) {
        void plans.locateMore();
        return;
      }
      node.scrollTop = Math.min(desired, maximum);
      state.revealed = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [
    list,
    mobile,
    selected,
    plans.query.data,
    plans.query.isFetching,
    plans.query.error,
  ]);
  return {
    manuallyInteracted: () => {
      pending.current.manual = true;
    },
  };
}
