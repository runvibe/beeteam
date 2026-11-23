import { expect, it } from "vitest";
import { resizeFloatingBounds } from "./floating-chat-bounds";
const original = { x: 200, y: 150, width: 440, height: 400 };
const viewport = { width: 1000, height: 800 };
it.each([
  ["nw", { x: 180, y: 120, width: 460, height: 430 }],
  ["ne", { x: 200, y: 120, width: 460, height: 430 }],
  ["sw", { x: 180, y: 150, width: 460, height: 430 }],
  ["se", { x: 200, y: 150, width: 460, height: 430 }],
] as const)(
  "resizes %s keeping the opposite corner fixed",
  (corner, expected) => {
    expect(
      resizeFloatingBounds(
        original,
        corner,
        corner.includes("w") ? -20 : 20,
        corner.includes("n") ? -30 : 30,
        viewport,
      ),
    ).toEqual(expected);
  },
);
it("fits the viewport and minimum dimensions", () => {
  expect(resizeFloatingBounds(original, "nw", -2000, -2000, viewport)).toEqual({
    x: 12,
    y: 12,
    width: 628,
    height: 538,
  });
  expect(resizeFloatingBounds(original, "se", -2000, -2000, viewport)).toEqual({
    x: 200,
    y: 150,
    width: 320,
    height: 300,
  });
  expect(
    resizeFloatingBounds(
      { x: 12, y: 12, width: 256, height: 216 },
      "se",
      100,
      100,
      { width: 280, height: 240 },
    ),
  ).toEqual({ x: 12, y: 12, width: 256, height: 216 });
});

it.each([
  ["n", { x: 200, y: 170, width: 440, height: 380 }],
  ["s", { x: 200, y: 150, width: 440, height: 420 }],
  ["e", { x: 200, y: 150, width: 460, height: 400 }],
  ["w", { x: 220, y: 150, width: 420, height: 400 }],
] as const)(
  "resizes only the corresponding axis at border %s",
  (direction, expected) => {
    expect(resizeFloatingBounds(original, direction, 20, 20, viewport)).toEqual(
      expected,
    );
  },
);

it("keeps resizing within an offset content area",()=>{
  const area={x:250,y:80,width:750,height:720};
  expect(resizeFloatingBounds({x:400,y:200,width:440,height:400},"nw",-1000,-1000,area)).toEqual({x:262,y:92,width:578,height:508});
  expect(resizeFloatingBounds({x:400,y:200,width:440,height:400},"se",1000,1000,area)).toEqual({x:400,y:200,width:588,height:588});
});
