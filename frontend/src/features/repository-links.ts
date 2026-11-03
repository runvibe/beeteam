import type { CommitReference } from "@/api/generated/kanban/CommitReference";
/** Read-only web metadata. Never turn an SSH remote or checkout path into navigation. */
export function safeRepositoryUrl(value: string | null | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
export function safeCommitUrl(commit: CommitReference) {
  if (
    commit.availability !== "published" ||
    !commit.remoteVerifiedAt ||
    !Number.isFinite(Date.parse(commit.remoteVerifiedAt)) ||
    !/^([a-f0-9]{40}|[a-f0-9]{64})$/i.test(commit.hash)
  )
    return undefined;
  const web = safeRepositoryUrl(commit.repository.webUrl),
    link = safeRepositoryUrl(commit.commitUrl);
  if (!web || !link) return undefined;
  const suffix =
    commit.repository.provider === "github"
      ? "/commit/"
      : commit.repository.provider === "gitlab"
        ? "/-/commit/"
        : undefined;
  if (!suffix) return undefined;
  return link === web.replace(/\/$/, "") + suffix + commit.hash
    ? link
    : undefined;
}
