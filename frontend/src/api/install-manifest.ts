import { valid } from "semver";

export interface InstallArtifact {
  os: "windows" | "linux" | "macos";
  arch: "x64" | "arm64";
  format: "zip" | "tar.gz";
  fileName: string;
  url: string;
  sha256: string;
  size: number;
}
export interface InstallManifest {
  schemaVersion: 1;
  appVersion: string;
  artifacts: InstallArtifact[];
  skills: { repository: string; ref: string; path: "skills"; names: string[] };
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("install_manifest_invalid");
  return value as Record<string, unknown>;
}
function githubUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("install_manifest_invalid");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.username ||
    url.password
  )
    throw new Error("install_manifest_invalid");
  return value;
}
export function parseInstallManifest(value: unknown): InstallManifest {
  const data = object(value);
  if (
    data.schemaVersion !== 1 ||
    typeof data.appVersion !== "string" ||
    !valid(data.appVersion) ||
    !Array.isArray(data.artifacts) ||
    data.artifacts.length === 0
  )
    throw new Error("install_manifest_invalid");
  const pairs = new Set<string>();
  const artifacts = data.artifacts.map((value) => {
    const item = object(value);
    if (
      typeof item.os !== "string" ||
      !["windows", "linux", "macos"].includes(item.os) ||
      typeof item.arch !== "string" ||
      !["x64", "arm64"].includes(item.arch) ||
      typeof item.format !== "string" ||
      !["zip", "tar.gz"].includes(item.format) ||
      typeof item.fileName !== "string" ||
      !item.fileName ||
      /[/\\]/.test(item.fileName) ||
      typeof item.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/i.test(item.sha256) ||
      !Number.isSafeInteger(item.size) ||
      Number(item.size) <= 0
    )
      throw new Error("install_manifest_invalid");
    const url = githubUrl(item.url);
    if (!new URL(url).pathname.includes("/releases/download/"))
      throw new Error("install_manifest_invalid");
    const pair = `${item.os}/${item.arch}`;
    if (pairs.has(pair)) throw new Error("install_manifest_invalid");
    pairs.add(pair);
    return { ...item, url } as unknown as InstallArtifact;
  });
  const skills = object(data.skills);
  const repository = githubUrl(skills.repository);
  const names = skills.names;
  if (
    skills.ref !== `v${data.appVersion}` ||
    skills.path !== "skills" ||
    !Array.isArray(names) ||
    names.length !== 3 ||
    new Set(names).size !== 3 ||
    !names.every((name) => typeof name === "string") ||
    !["setup-bee-team", "get-a-team-lead", "get-a-worker"].every((name) =>
      names.includes(name),
    )
  )
    throw new Error("install_manifest_invalid");
  return {
    schemaVersion: 1,
    appVersion: data.appVersion,
    artifacts,
    skills: { repository, ref: String(skills.ref), path: "skills", names },
  };
}
