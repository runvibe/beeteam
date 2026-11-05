import { isCanonicalVersion } from "@/api/version-policy";
import type { InstallManifest } from "@/api/install-manifest";
export const harnesses = [
  "codex",
  "claude-code",
  "github-copilot",
  "other",
] as const;
export type Harness = (typeof harnesses)[number];
export function bootstrapCommand(
  manifest: InstallManifest,
  harness: Harness,
): string | null {
  const ref = manifest.skills.ref;
  if (
    harness === "other" ||
    !harnesses.includes(harness) ||
    manifest.skills.repository !== "https://github.com/runvibe/beeteam" ||
    !isCanonicalVersion(manifest.appVersion) ||
    ref !== `v${manifest.appVersion}`
  )
    return null;
  return `npx skills@1.7.6 add https://github.com/runvibe/beeteam/tree/${ref}/skills --skill setup-bee-team get-a-team-lead get-a-worker -a ${harness} --copy`;
}
