import type { FloatingBounds } from "./floating-chat-bounds";

/** Keep information beside the chat where possible, otherwise overlay only content. */
export function placeFloatingInformation(
  chat: FloatingBounds,
  area: FloatingBounds,
): FloatingBounds {
  const marginX = Math.min(12, area.width / 2);
  const marginY = Math.min(12, area.height / 2);
  const left = area.x + marginX;
  const right = area.x + area.width - marginX;
  const top = area.y + marginY;
  const bottom = area.y + area.height - marginY;
  const width = Math.min(280, Math.max(0, right - left));
  const height = Math.min(
    Math.max(300, chat.height),
    Math.max(0, bottom - top),
  );
  const after = chat.x + chat.width + 12;
  const before = chat.x - width - 12;
  const preferred =
    after + width <= right ? after : before >= left ? before : after;
  return {
    x: Math.max(left, Math.min(preferred, right - width)),
    y: Math.max(top, Math.min(chat.y, bottom - height)),
    width,
    height,
  };
}
