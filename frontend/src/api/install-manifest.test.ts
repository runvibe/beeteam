import { expect, it } from "vitest";
import { parseInstallManifest } from "./install-manifest";
const example = {
  schemaVersion: 1,
  appVersion: "1.2.3",
  artifacts: [
    {
      os: "windows",
      arch: "x64",
      format: "zip",
      fileName: "beeteam-windows-x64.zip",
      url: "https://github.com/runvibe/beeteam/releases/download/v1.2.3/beeteam-windows-x64.zip",
      sha256: "a".repeat(64),
      size: 1234,
    },
  ],
  skills: {
    repository: "https://github.com/runvibe/beeteam",
    ref: "v1.2.3",
    path: "skills",
    names: ["setup-bee-team", "get-a-team-lead", "get-a-worker"],
  },
};
it("accepts a published release and preserves its verified metadata", () => {
  expect(parseInstallManifest(example)).toEqual(example);
});
it.each([
  { ...example, schemaVersion: 2 },
  { ...example, appVersion: "invalid" },
  { ...example, artifacts: [] },
  { ...example, artifacts: [...example.artifacts, ...example.artifacts] },
  {
    ...example,
    artifacts: [{ ...example.artifacts[0], url: "javascript:alert(1)" }],
  },
  { ...example, artifacts: [{ ...example.artifacts[0], sha256: "missing" }] },
  { ...example, artifacts: [{ ...example.artifacts[0], size: -1 }] },
  { ...example, skills: { ...example.skills, ref: "main" } },
])("rejects incomplete or unsafe release metadata", (value) => {
  expect(() => parseInstallManifest(value)).toThrow();
});
