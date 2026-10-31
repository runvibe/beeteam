import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { FilterDirectionContext } from "@/components/filter-context";
import "./task-filter-layout.css";

type Dock = { top: number; left: number; height: number };
const TaskFilterHost = createContext<{
  host: HTMLElement | null;
  setHost: (node: HTMLDivElement | null) => void;
  active: boolean;
  setActive: (active: boolean) => void;
  dock: Dock | null;
  setDock: (dock: Dock | null) => void;
} | null>(null);
export function TaskFilterProvider({ children }: { children: ReactNode }) {
  const [host, setHost] = useState<HTMLDivElement | null>(null);
  const [active, setActive] = useState(false);
  const [dock, setDock] = useState<Dock | null>(null);
  return (
    <TaskFilterHost.Provider
      value={{ host, setHost, active, setActive, dock, setDock }}
    >
      {children}
    </TaskFilterHost.Provider>
  );
}
export function TaskFilterSlot() {
  const context = useContext(TaskFilterHost);
  const origin = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  const dockedRef = useRef(false);
  const host = context?.host,
    active = context?.active;
  const setDock = context?.setDock;
  useLayoutEffect(() => {
    const node = origin.current;
    if (!node || !host || !setDock) return;
    const media = window.matchMedia?.("(max-width: 1055px)") ?? {
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    };
    const rail = document.querySelector<HTMLElement>(".navigation-rail");
    const logo = rail?.querySelector<HTMLElement>(".navigation-logo");
    const nav = rail?.querySelector<HTMLElement>("nav");
    const update = () => {
      if (!dockedRef.current) setHeight(host.getBoundingClientRect().height);
      const top = (logo?.getBoundingClientRect().bottom ?? 0) + 8;
      const available = (nav?.getBoundingClientRect().top ?? 0) - top - 8;
      const bounds = node.getBoundingClientRect();
      const docked = !!(
        host.childElementCount &&
        media.matches &&
        rail &&
        logo &&
        nav &&
        available >= 44 &&
        (bounds.bottom <= 0 || bounds.top >= window.innerHeight)
      );
      dockedRef.current = docked;
      setDock(
        docked
          ? {
              top,
              left: rail!.getBoundingClientRect().left + 6,
              height: available,
            }
          : null,
      );
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(update);
    observer?.observe(node);
    const resize = new ResizeObserver(update);
    resize.observe(host);
    if (rail) resize.observe(rail);
    const focusChanged = () => queueMicrotask(update);
    host.addEventListener("focusin", focusChanged);
    host.addEventListener("focusout", focusChanged);
    const expanded = new MutationObserver(update);
    expanded.observe(host, {
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-expanded"],
    });
    media.addEventListener("change", update);
    window.addEventListener("resize", update);
    update();
    return () => {
      observer?.disconnect();
      resize.disconnect();
      expanded.disconnect();
      host.removeEventListener("focusin", focusChanged);
      host.removeEventListener("focusout", focusChanged);
      media.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, [host, active, setDock]);
  return (
    <div
      ref={origin}
      className="task-filter-origin"
      style={{ minHeight: context?.dock ? height : undefined }}
    >
      <div
        className="task-filter-slot"
        ref={context?.setHost}
        data-docked={!!context?.dock}
        style={
          context?.dock
            ? ({
                top: context.dock.top,
                left: context.dock.left,
                "--filter-dock-height": `${context.dock.height}px`,
                "--filter-dock-top": `${context.dock.top}px`,
              } as CSSProperties)
            : undefined
        }
      />
    </div>
  );
}
/** The filter DOM stays mounted in one host; docking changes CSS only. */
export function TaskFilters({
  children,
  active = false,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  const context = useContext(TaskFilterHost);
  const setActive = context?.setActive;
  useLayoutEffect(() => {
    setActive?.(active);
    return () => setActive?.(false);
  }, [active, setActive]);
  const content = (
    <FilterDirectionContext.Provider value={context?.dock ? "right" : "bottom"}>
      {children}
    </FilterDirectionContext.Provider>
  );
  return context?.host ? createPortal(content, context.host) : content;
}
