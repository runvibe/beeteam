export type FloatingSize = { width: number; height: number };
export type FloatingBounds = FloatingSize & { x: number; y: number };
export type ResizeCorner = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

export function fitFloatingBounds(
  bounds: FloatingBounds,
  viewport: FloatingSize,
): FloatingBounds {
  const mx = Math.min(12, viewport.width / 2);
  const my = Math.min(12, viewport.height / 2);
  const width = Math.min(
    Math.max(320, bounds.width),
    Math.max(0, viewport.width - mx * 2),
  );
  const height = Math.min(
    Math.max(300, bounds.height),
    Math.max(0, viewport.height - my * 2),
  );
  return {
    width,
    height,
    x: Math.max(mx, Math.min(bounds.x, viewport.width - mx - width)),
    y: Math.max(my, Math.min(bounds.y, viewport.height - my - height)),
  };
}

export function resizeFloatingBounds(
  bounds: FloatingBounds,
  corner: ResizeCorner,
  dx: number,
  dy: number,
  viewport: FloatingSize,
): FloatingBounds {
  const initial = fitFloatingBounds(bounds, viewport);
  const mx = Math.min(12, viewport.width / 2);
  const my = Math.min(12, viewport.height / 2);
  const west = corner.includes("w");
  const north = corner.includes("n");
  const right = initial.x + initial.width;
  const bottom = initial.y + initial.height;
  const availableWidth = west ? right - mx : viewport.width - mx - initial.x;
  const availableHeight = north
    ? bottom - my
    : viewport.height - my - initial.y;
  const width =
    corner.includes("w") || corner.includes("e")
      ? Math.min(
          availableWidth,
          Math.max(
            Math.min(320, availableWidth),
            initial.width + (west ? -dx : dx),
          ),
        )
      : initial.width;
  const height =
    corner.includes("n") || corner.includes("s")
      ? Math.min(
          availableHeight,
          Math.max(
            Math.min(300, availableHeight),
            initial.height + (north ? -dy : dy),
          ),
        )
      : initial.height;
  return {
    width,
    height,
    x: west ? right - width : initial.x,
    y: north ? bottom - height : initial.y,
  };
}
