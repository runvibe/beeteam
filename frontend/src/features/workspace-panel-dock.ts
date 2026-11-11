import {
  createContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { t } from "@/i18n";
import {
  chatSide,
  movePanel,
  type WorkspacePanel,
} from "@/state/workspace-layout";

const narrowQuery = "(max-width: 850px)";
const dragThreshold = 6;
const panelIds: WorkspacePanel[] = ["sessions", "content", "chat"];

function subscribeNarrow(notify: () => void) {
  const media = window.matchMedia?.(narrowQuery);
  media?.addEventListener?.("change", notify);
  return () => media?.removeEventListener?.("change", notify);
}
const narrowSnapshot = () => window.matchMedia?.(narrowQuery).matches ?? false;

function panelElement(
  root: HTMLElement,
  panel: WorkspacePanel,
): HTMLElement | null {
  for (const child of Array.from(root.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (child.dataset.workspacePanel === panel) return child;
    if (panel === "content" && child.matches(".main-shell, main")) return child;
  }
  return null;
}

export function usePresentWorkspacePanels(root: HTMLElement | null) {
  const [present, setPresent] = useState<WorkspacePanel[]>([]);
  useLayoutEffect(() => {
    if (!root) return;
    const update = () => {
      const next = panelIds.filter((panel) => panelElement(root, panel));
      setPresent((current) =>
        current.join(",") === next.join(",") ? current : next,
      );
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { childList: true });
    return () => observer.disconnect();
  }, [root]);
  return present;
}

export function useWorkspaceWidth(root: HTMLElement | null) {
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!root) return () => {};
      const observer =
        typeof ResizeObserver === "undefined"
          ? null
          : new ResizeObserver(notify);
      observer?.observe(root);
      window.addEventListener("resize", notify);
      return () => {
        observer?.disconnect();
        window.removeEventListener("resize", notify);
      };
    },
    [root],
  );
  const snapshot = useCallback(() => root?.clientWidth ?? 0, [root]);
  return useSyncExternalStore(subscribe, snapshot, () => 0);
}

type PanelRect = { panel: WorkspacePanel; rect: DOMRect };
type PanelDrag = {
  panel: WorkspacePanel;
  position: number;
  dx: number;
  dy: number;
  side: "left" | "right";
  preview: { left: number; width: number };
};
type DockMove = (
  panel: WorkspacePanel,
  visible: readonly WorkspacePanel[],
  position: number,
) => void;
type DockContext = {
  draggable: boolean;
  visible: readonly WorkspacePanel[];
  move: (panel: WorkspacePanel, position: number) => void;
};

export const WorkspaceDockContext = createContext<DockContext | null>(null);

function positionAt(
  clientX: number,
  panel: WorkspacePanel,
  rects: PanelRect[],
) {
  if (rects.length === 2) return clientX < window.innerWidth / 2 ? 0 : 1;
  const others = rects.filter((entry) => entry.panel !== panel);
  const position = others.findIndex(
    ({ rect }) => clientX < rect.left + rect.width / 2,
  );
  return position < 0 ? others.length : position;
}

function previewAt(
  rootRect: DOMRect,
  moved: PanelRect,
  position: number,
  rects: PanelRect[],
) {
  const next = rects.filter((entry) => entry.panel !== moved.panel);
  next.splice(position, 0, moved);
  const left =
    rootRect.left +
    next.slice(0, position).reduce((sum, entry) => sum + entry.rect.width, 0);
  return { left: left + 8, width: Math.max(0, moved.rect.width - 16) };
}

export function useWorkspacePanelDock(
  root: HTMLElement | null,
  order: readonly WorkspacePanel[],
  visible: readonly WorkspacePanel[],
  onMove: DockMove,
) {
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    narrowSnapshot,
    () => false,
  );
  const [drag, setDrag] = useState<PanelDrag | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const draggable = !narrow && visible.length > 1;
  const orderKey = order.join(",");
  const visibleKey = visible.join(",");
  useEffect(() => () => cleanup.current?.(), [narrow, orderKey, visibleKey]);

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (
        !root ||
        !draggable ||
        event.button !== 0 ||
        !(event.target instanceof Element)
      )
        return;
      if (
        event.target.closest(
          "button, a, input, select, textarea, [contenteditable], [role='button']",
        )
      )
        return;
      const header = event.target.closest<HTMLElement>("[data-dock-handle]");
      if (!header || !root.contains(header)) return;
      const panel = panelIds.find((item) => item === header.dataset.dockHandle);
      if (!panel) return;
      const rects = visible.flatMap((item) => {
        const element = panelElement(root, item);
        return element
          ? [{ panel: item, rect: element.getBoundingClientRect() }]
          : [];
      });
      const rootRect = root.getBoundingClientRect();
      const dragged = rects.find((entry) => entry.panel === panel);
      if (
        rects.length !== visible.length ||
        !dragged ||
        rootRect.width <= 0 ||
        rects.some(({ rect }) => rect.width <= 0)
      ) {
        console.warn(
          "Cannot rearrange workspace panels: layout bounds are unavailable.",
        );
        return;
      }
      const actualVisible = rects.map((entry) => entry.panel);
      cleanup.current?.();
      const { clientX: startX, clientY: startY, pointerId } = event;
      let active = false;
      const move = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!active && Math.hypot(dx, dy) < dragThreshold) return;
        active = true;
        e.preventDefault();
        const position = positionAt(e.clientX, panel, rects);
        const next = movePanel(order, panel, actualVisible, position);
        setDrag({
          panel,
          position,
          dx,
          dy,
          side: chatSide(next),
          preview: previewAt(rootRect, dragged, position, rects),
        });
      };
      const stop = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", cancelPointer);
        window.removeEventListener("keydown", key);
        window.removeEventListener("blur", cancel);
        window.removeEventListener("resize", cancel);
        cleanup.current = null;
        setDrag(null);
      };
      const up = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        const position = positionAt(e.clientX, panel, rects);
        stop();
        if (active) onMove(panel, actualVisible, position);
      };
      const cancel = () => stop();
      const cancelPointer = (e: PointerEvent) => {
        if (e.pointerId === pointerId) cancel();
      };
      const key = (e: KeyboardEvent) => {
        if (e.key === "Escape" && active) {
          e.preventDefault();
          cancel();
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", cancelPointer);
      window.addEventListener("keydown", key);
      window.addEventListener("blur", cancel);
      window.addEventListener("resize", cancel);
      cleanup.current = stop;
    },
    [draggable, onMove, order, root, visible],
  );

  const move = useCallback(
    (panel: WorkspacePanel, position: number) =>
      onMove(panel, visible, position),
    [onMove, visible],
  );
  return { narrow, draggable, visible, drag, move, onPointerDown };
}

export function workspacePanelName(panel: WorkspacePanel) {
  if (panel === "sessions") return t("workspace.sessions");
  if (panel === "content") return t("workspace.content");
  return t("workspace.chat");
}
