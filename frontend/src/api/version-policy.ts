import { compare, prerelease, valid } from "semver";
import { supportsFrontendContract } from "./api-info";
import type { ApiInfo } from "./generated/system/ApiInfo";

export type VersionAgreement =
  | "compatible"
  | "api-older"
  | "frontend-older"
  | "different-build"
  | "invalid"
  | "unsupported";
export function isCanonicalVersion(value: string): boolean {
  return (
    !!valid(value) &&
    /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value)
  );
}

export function assessApiVersion(
  frontend: string,
  info: ApiInfo,
): VersionAgreement {
  if (!isCanonicalVersion(frontend) || !isCanonicalVersion(info.apiVersion))
    return "invalid";
  if (frontend !== info.apiVersion) {
    const order = compare(frontend, info.apiVersion);
    if (order > 0) return "api-older";
    if (order < 0) return "frontend-older";
    return "different-build";
  }
  const productCapability =
    info.capabilities.includes("roles.worker") ||
    info.capabilities.includes("teams.role-icons");
  return productCapability && supportsFrontendContract(info)
    ? "compatible"
    : "unsupported";
}

// Public stable announcements never switch users to a prerelease channel.
export function newerStableRelease(
  installed: string,
  published: string,
): boolean {
  return (
    !!valid(installed) &&
    !!valid(published) &&
    prerelease(published) === null &&
    compare(published, installed) > 0
  );
}
