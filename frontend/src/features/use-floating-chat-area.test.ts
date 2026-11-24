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
it("excludes navigation, sessions and topbar from shared floating area", () => {
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
  node(panel, "topbar", { x: 300, y: 0, width: 900, height: 64 });
  node(panel, "#main-content", { x: 300, y: 64, width: 900, height: 200 });
  expect(
    measureFloatingChatArea(workspace, { width: 1200, height: 800 }),
  ).toEqual({ x: 300, y: 64, width: 900, height: 736 });
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
  const header = node(panel, "topbar", { x: 0, y: 60, width: 400, height: 104 });
  node(header, "hive-navigation", { x: 0, y: 60, width: 400, height: 40 });
  node(panel, "#main-content", { x: 0, y: 164, width: 400, height: 200 });
  expect(
    measureFloatingChatArea(workspace, { width: 400, height: 800 }),
  ).toEqual({ x: 0, y: 164, width: 400, height: 636 });
  workspace.remove();
});
it("does not reserve a sidebar for Hive tabs inside the content header", () => {
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
    height: 800,
  });
  const header = node(panel, "topbar", {
    x: 300,
    y: 0,
    width: 900,
    height: 48,
  });
  node(header, "hive-navigation", { x: 308, y: 0, width: 240, height: 48 });
  node(panel, "#main-content", { x: 300, y: 48, width: 900, height: 752 });

  expect(
    measureFloatingChatArea(workspace, { width: 1200, height: 800 }),
  ).toEqual({ x: 300, y: 48, width: 900, height: 752 });
  workspace.remove();
});
