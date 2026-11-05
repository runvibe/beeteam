import { expect, it } from "vitest";
import { bootstrapCommand, type Harness } from "./bootstrap";
import type { InstallManifest } from "@/api/install-manifest";
const manifest: InstallManifest = {
  schemaVersion: 1,
  appVersion: "1.2.3",
  artifacts: [],
  skills: {
    repository: "https://github.com/runvibe/beeteam",
    ref: "v1.2.3",
    path: "skills",
    names: ["setup-bee-team", "get-a-team-lead", "get-a-worker"],
  },
};
it.each(["codex", "claude-code", "github-copilot"] as const)(
  "uses the verified project command for %s",
  (harness) => {
    expect(bootstrapCommand(manifest, harness)).toBe(
      `npx skills@1.7.6 add https://github.com/runvibe/beeteam/tree/v1.2.3/skills --skill setup-bee-team get-a-team-lead get-a-worker -a ${harness} --copy`,
    );
  },
);
it("never builds a command from unverified repository/tag or unsupported harness", () => {
  expect(bootstrapCommand(manifest, "other")).toBeNull();
  expect(bootstrapCommand(manifest, "codex; evil" as Harness)).toBeNull();
  expect(
    bootstrapCommand(
      { ...manifest, skills: { ...manifest.skills, ref: "main" } },
      "codex",
    ),
  ).toBeNull();
  expect(
    bootstrapCommand(
      {
        ...manifest,
        skills: {
          ...manifest.skills,
          repository: "https://github.com/other/repo",
        },
      },
      "codex",
    ),
  ).toBeNull();
});
it("retains build metadata in the verified release tag", () => {
  const release = {
    ...manifest,
    appVersion: "1.2.3+build.7",
    skills: { ...manifest.skills, ref: "v1.2.3+build.7" },
  };
  expect(bootstrapCommand(release, "codex")).toContain(
    "/tree/v1.2.3+build.7/skills",
  );
});
