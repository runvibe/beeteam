import type { PatchTeam } from "@/api/generated/ra/PatchTeam";

/** Old APIs reject unknown fields even when their values are unchanged. */
export function teamSettingsPatch(
  draft: PatchTeam,
  iconsSupported: boolean,
): PatchTeam {
  if (iconsSupported) return draft;
  const {
    leaderIconId: _leader,
    workerIconId: _worker,
    ...metadata
  } = draft;
  return metadata;
}
