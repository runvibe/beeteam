import { expect, it } from "vitest";
import { shouldOfferDesktop } from "./desktop-entry";

it("offers Desktop only on the plain hosted entry in a browser", () => {
  const hosted = new URL("https://getbee.team/app/");
  expect(shouldOfferDesktop(hosted, false)).toBe(true);
  expect(shouldOfferDesktop(hosted, true)).toBe(false);
  for (const path of ["/app/?web=1", "/app/tasks/example", "/app/?task.view=id"]) {
    expect(shouldOfferDesktop(new URL(path, hosted), false)).toBe(false);
  }
  expect(shouldOfferDesktop(new URL("http://127.0.0.1:59865/app/"), false)).toBe(false);
});
