/** Fixture-only allocator matching the backend policy. UI never derives real slugs. */
const reserved = new Set([
  "new",
  "edit",
  "create",
  "by-slug",
  "resolve",
  "search",
  "archive",
  "settings",
  "api",
  "mcp",
  "agents",
  "teams",
  "tasks",
]);
export function allocateSlug(
  label: string,
  kind: "agent" | "team" | "task",
  used: Set<string>,
) {
  let base =
    label
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || kind;
  if (
    reserved.has(base) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(base)
  )
    base = `${kind}-${base}`;
  base = base.slice(0, 80).replace(/-$/, "");
  let candidate = base,
    index = 2;
  while (used.has(candidate)) {
    const suffix = `-${index++}`;
    candidate = base.slice(0, 80 - suffix.length).replace(/-$/, "") + suffix;
  }
  used.add(candidate);
  return candidate;
}
export function fixtureSlugs<T extends { name?: string; title?: string }>(
  rows: T[],
  kind: "agent" | "team" | "task",
) {
  const used = new Set<string>();
  return rows.map((row) => ({
    ...row,
    slug: allocateSlug(row.title ?? row.name ?? "", kind, used),
  }));
}
