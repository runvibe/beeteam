import { expect, it } from "vitest";
import { measureFloatingChatArea } from "./use-floating-chat-area";
function node(
  parent: HTMLElement,
  tag: string,
  rect: { x: number; y: number; width: number; height: number },
) {
  const element = document.createElement("div");
  if (tag.startsWith("#")) element.id = tag.slice(1);
  else element.className = tag;
  element.getBoundingClientRect = () =>
    ({
      ...rect,
      left: rect.x,
      top: rect.y,
      right: rect.x + rect.width,
      bottom: rect.y + rect.height,
    }) as DOMRect;
  parent.append(element);
  return element;
}
it("excludes navigation, sessions, Hive and topbar from shared floating area", () => {
  const workspace = node(document.body, "chat-workspace", {
    x: 64,
    y: 0,
    width: 1136,
    height: 800,
  });
  const panel = node(workspace, "#content-panel", {
    x: 300,
    y: 0,
    width: 900,
    height: 1000,
  });
  node(panel, "hive-navigation", { x: 300, y: 0, width: 152, height: 800 });
  node(panel, "topbar", { x: 452, y: 0, width: 748, height: 64 });
  node(panel, "#main-content", { x: 452, y: 64, width: 748, height: 200 });
  expect(
    measureFloatingChatArea(workspace, { width: 1200, height: 800 }),
  ).toEqual({ x: 452, y: 64, width: 748, height: 736 });
  workspace.remove();
});
it("excludes mobile Hive tabs above the content", () => {
  const workspace = node(document.body, "chat-workspace", {
    x: 0,
    y: 60,
    width: 400,
    height: 740,
  });
  const panel = node(workspace, "#content-panel", {
    x: 0,
    y: 60,
    width: 400,
    height: 740,
  });
  node(panel, "hive-navigation", { x: 0, y: 60, width: 400, height: 40 });
  node(panel, "topbar", { x: 0, y: 100, width: 400, height: 64 });
  node(panel, "#main-content", { x: 0, y: 164, width: 400, height: 200 });
  expect(
    measureFloatingChatArea(workspace, { width: 400, height: 800 }),
  ).toEqual({ x: 0, y: 164, width: 400, height: 636 });
  workspace.remove();
});
