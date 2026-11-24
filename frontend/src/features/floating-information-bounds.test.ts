import { describe, expect, it } from "vitest";
import { placeFloatingInformation } from "./floating-information-bounds";

describe("floating session information placement", () => {
  const area = { x: 200, y: 80, width: 1100, height: 720 };
  it("uses the right side without moving or resizing the chat", () => {
    const chat = { x: 220, y: 100, width: 440, height: 600 };
    expect(placeFloatingInformation(chat, area)).toEqual({
      x: 672,
      y: 100,
      width: 280,
      height: 600,
    });
    expect(chat).toEqual({ x: 220, y: 100, width: 440, height: 600 });
  });
  it("uses the left side when the right side lacks space", () => {
    expect(
      placeFloatingInformation(
        { x: 840, y: 100, width: 440, height: 600 },
        area,
      ),
    ).toEqual({ x: 548, y: 100, width: 280, height: 600 });
  });
  it("bounds the overlay fallback to the content area and keeps compact details readable", () => {
    expect(
      placeFloatingInformation(
        { x: 212, y: 400, width: 340, height: 160 },
        { x: 200, y: 80, width: 364, height: 480 },
      ),
    ).toEqual({ x: 272, y: 248, width: 280, height: 300 });
  });
  it("fits even an area narrower than the information panel", () => {
    expect(
      placeFloatingInformation(
        { x: 210, y: 90, width: 100, height: 160 },
        { x: 200, y: 80, width: 120, height: 180 },
      ),
    ).toEqual({ x: 212, y: 92, width: 96, height: 156 });
  });
});
