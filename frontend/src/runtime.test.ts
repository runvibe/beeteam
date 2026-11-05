import { expect, it } from "vitest";
import { apiBaseForHost } from "./runtime";
it.each(["localhost", "127.0.0.1", "[::1]"])("uses the local same-origin API on %s", host => {
  expect(apiBaseForHost(host)).toBe("/api/v1");
});
it.each(["getbee.team", "preview.workers.dev"])("discovers loopback from the hosted frontend on %s", host => {
  expect(apiBaseForHost(host)).toBe("http://127.0.0.1:59865/api/v1");
});
it("preserves an explicit API override", () => {
  expect(apiBaseForHost("getbee.team", "https://custom.test/api/v1")).toBe("https://custom.test/api/v1");
});
