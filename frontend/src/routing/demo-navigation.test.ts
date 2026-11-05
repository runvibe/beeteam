import { afterEach, expect, it } from "vitest";
import { demoHref, destination, navigate } from "./location";
import { safeOrigin } from "./location";
afterEach(() => history.replaceState({}, "", "/boards"));
it("retains demo isolation and the original requested destination in links and navigation", () => {
  history.replaceState(
    {},
    "",
    "/boards?demo=1&returnTo=%2Fagents%3Fagents.name%3DLia",
  );
  const href = new URL(destination("/tasks/example"), location.origin);
  expect(href.searchParams.get("demo")).toBe("1");
  expect(href.searchParams.get("returnTo")).toBe("/agents?agents.name=Lia");
  navigate("/teams");
  expect(new URLSearchParams(location.search).get("demo")).toBe("1");
  expect(demoHref("https://example.com")).toBe("https://example.com");
  navigate("/agents?agents.name=Lia&demo=0");
  expect(new URLSearchParams(location.search).get("demo")).toBe("0");
});
it("accepts and preserves a root-route return destination", () => {
  expect(safeOrigin("/?intro=1&boards.name=Launch")).toBe(
    "/?intro=1&boards.name=Launch",
  );
  expect(safeOrigin("//external.test/?intro=1")).toBeNull();
});
