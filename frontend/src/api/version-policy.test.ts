import { describe, expect, it } from "vitest";
import { assessApiVersion, newerStableRelease } from "./version-policy";

const info = (apiVersion: string) => ({
  apiVersion,
  supportedContractVersions: ["v2"],
  capabilities: ["roles.worker"],
});
describe("installed API and frontend version agreement", () => {
  it.each(["1.2.3", "1.2.3-beta.1", "1.2.3+build.7"])(
    "allows exact equality for %s",
    (version) => {
      expect(assessApiVersion(version, info(version))).toBe("compatible");
    },
  );
  it.each([
    ["1.2.3", "1.2.4", "frontend-older"],
    ["2.0.0", "1.9.0", "api-older"],
    ["1.2.3", "1.2.3-beta.1", "api-older"],
    ["1.2.3+one", "1.2.3+two", "different-build"],
    ["invalid", "1.2.3", "invalid"],
    ["1.2.3", "1.2", "invalid"],
  ])("classifies %s and %s", (frontend, api, status) => {
    expect(assessApiVersion(frontend, info(api))).toBe(status);
  });
  it("requires a supported contract after version equality", () => {
    expect(
      assessApiVersion("1.2.3", {
        ...info("1.2.3"),
        supportedContractVersions: [],
        capabilities: [],
      }),
    ).toBe("unsupported");
  });
});
describe("optional public stable release", () => {
  it.each([
    ["1.2.3", "1.3.0", true],
    ["1.2.3", "1.2.3", false],
    ["1.2.3", "1.2.2", false],
    ["1.2.3", "2.0.0-beta.1", false],
    ["invalid", "1.3.0", false],
  ])("compares %s with %s", (installed, published, expected) => {
    expect(newerStableRelease(installed, published)).toBe(expected);
  });
});
