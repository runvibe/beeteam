import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEventHandler,
} from "react";
const interactive =
  "button,a,input,textarea,select,[role='button'],[role='link'],[contenteditable='true']";
export function useCompactFloatingChat({
  active,
  element,
  wasDraggedRecently,
  onCollapse,
}: {
  active: boolean;
  element: HTMLElement | null;
  wasDraggedRecently: () => boolean;
  onCollapse: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [height, setHeight] = useState(210);
  const latest = useRef({ active, element, wasDraggedRecently, onCollapse });
  latest.current = { active, element, wasDraggedRecently, onCollapse };
  const compact = active && collapsed;
  useLayoutEffect(() => {
    if (!compact || !element) return;
    const measure = () => {
      const header = element.querySelector<HTMLElement>(".chat-panel-heading");
      const composer = element.querySelector<HTMLElement>(
        ".managed-voice-chat,.leader-chat-composer,.assistant-composer",
      );
      const next = Math.max(
        160,
        (header?.getBoundingClientRect().height ?? 56) +
          (composer?.getBoundingClientRect().height ?? 130) +
          22,
      );
      setHeight((previous) => (previous === next ? previous : next));
    };
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    const observe = () => {
      element
        .querySelectorAll<HTMLElement>(
          ".chat-panel-heading,.managed-voice-chat,.leader-chat-composer,.assistant-composer",
        )
        .forEach((node) => observer?.observe(node));
      measure();
    };
    const mutation = new MutationObserver(observe);
    mutation.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-call-active"],
    });
    observe();
    return () => {
      observer?.disconnect();
      mutation.disconnect();
    };
  }, [compact, element]);
  const onDoubleClick: MouseEventHandler<HTMLElement> = (event) => {
    if (!latest.current.active || latest.current.wasDraggedRecently()) return;
    if (event.target instanceof Element && event.target.closest(interactive))
      return;
    event.preventDefault();
    event.stopPropagation();
    if (!collapsed) latest.current.onCollapse();
    setCollapsed((value) => !value);
  };
  return {
    compact,
    height,
    onDoubleClick,
    setHeight,
    expand: () => setCollapsed(false),
  };
}
