import { useLayoutEffect, useState } from "react";
import type { FloatingSize } from "./floating-chat-bounds";
export type FloatingChatArea = FloatingSize & { x: number; y: number };

export function measureFloatingChatArea(
  workspace: HTMLElement | null,
  viewport: FloatingSize,
): FloatingChatArea {
  const root = workspace?.getBoundingClientRect();
  let left = Math.max(0, root?.left ?? 0),
    right = Math.min(viewport.width, root?.right ?? viewport.width);
  let top = Math.max(0, root?.top ?? 0),
    bottom = viewport.height;
  const panel = workspace?.querySelector<HTMLElement>(
    "#content-panel:not([hidden])",
  );
  if (panel) {
    const shell = panel.getBoundingClientRect();
    const main = panel
      .querySelector<HTMLElement>("#main-content")
      ?.getBoundingClientRect();
    const bar = panel
      .querySelector<HTMLElement>(".topbar")
      ?.getBoundingClientRect();
    left = Math.max(left, shell.left, main?.left ?? shell.left);
    right = Math.min(right, shell.right, main?.right ?? shell.right);
    top = Math.max(top, shell.top, main?.top ?? shell.top, bar?.bottom ?? 0);
    bottom = Math.min(bottom, Math.max(shell.bottom, top));
    const hive = panel
      .querySelector<HTMLElement>(".hive-navigation")
      ?.getBoundingClientRect();
    if (hive && hive.width > 0 && hive.height > 0) {
      if (hive.width < shell.width / 2) left = Math.max(left, hive.right);
      else top = Math.max(top, hive.bottom);
    }
  } else {
    // The workspace already excludes the primary navigation rail. Reserve any
    // visible sessions column if the content panel is temporarily unavailable.
    workspace
      ?.querySelectorAll<HTMLElement>(".sessions-sidebar[data-open='true']")
      .forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width <= 0) return;
        if (rect.left <= left + 1) left = Math.max(left, rect.right);
        else if (rect.right >= right - 1) right = Math.min(right, rect.left);
      });
  }
  left = Math.min(viewport.width, left);
  top = Math.min(viewport.height, top);
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

export function useFloatingChatArea(
  workspace: HTMLElement | null,
  active: boolean,
) {
  const [area, setArea] = useState<FloatingChatArea>(() => ({
    x: 0,
    y: 0,
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  useLayoutEffect(() => {
    if (!workspace || !active) return;
    const measure = () => {
      const next = measureFloatingChatArea(workspace, {
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setArea((previous) =>
        Object.keys(next).every(
          (key) =>
            next[key as keyof FloatingChatArea] ===
            previous[key as keyof FloatingChatArea],
        )
          ? previous
          : next,
      );
    };
    const resize =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    const observe = () => {
      resize?.observe(workspace);
      workspace
        .querySelectorAll<HTMLElement>(
          "#content-panel,#main-content,.hive-navigation,.topbar,.sessions-sidebar",
        )
        .forEach((element) => resize?.observe(element));
      measure();
    };
    const mutation = new MutationObserver(observe);
    mutation.observe(workspace, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden", "class", "data-hive", "data-open"],
    });
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    observe();
    return () => {
      resize?.disconnect();
      mutation.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [workspace, active]);
  return area;
}
