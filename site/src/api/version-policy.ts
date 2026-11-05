import { valid, prerelease } from "semver";
export const isCanonicalVersion = (v: string) =>
  valid(v) === v && !prerelease(v);
