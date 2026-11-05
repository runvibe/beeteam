/** Explicit v1 boundary. Never walk arbitrary JSON or replace authored strings. */
type RecordValue = Record<string, unknown>;
const object = (value: unknown): value is RecordValue =>
  !!value && typeof value === "object" && !Array.isArray(value);
type Adapter = (value: unknown) => unknown;
function fields(value: unknown, adapters: Record<string, Adapter>): unknown {
  if (!object(value)) return value;
  const result = { ...value };
  for (const [key, adapt] of Object.entries(adapters))
    if (Object.hasOwn(value, key)) result[key] = adapt(value[key]);
  return result;
}
const array =
  (adapt: Adapter): Adapter =>
  (value) =>
    Array.isArray(value) ? value.map(adapt) : value;
const page =
  (adapt: Adapter): Adapter =>
  (value) =>
    fields(value, { items: array(adapt) });
function rename(value: unknown, legacy: string, canonical: string): unknown {
  if (!object(value) || !Object.hasOwn(value, legacy)) return value;
  const { [legacy]: old, ...rest } = value;
  return Object.hasOwn(rest, canonical)
    ? rest
    : { ...rest, [canonical]: old };
}
const role: Adapter = (value) =>
  value === "collaborator" ? "worker" : value;
const agent: Adapter = (value) =>
  fields(value, {
    bindings: (bindings) =>
      rename(bindings, "collaboratorTeamId", "workerTeamId"),
  });
const team: Adapter = (value) =>
  fields(
    rename(
      rename(value, "collaboratorCount", "workerCount"),
      "collaboratorIconId",
      "workerIconId",
    ),
    { roleIcons: (icons) => rename(icons, "collaborator", "worker") },
  );
const member: Adapter = (value) => fields(value, { role });
const entry: Adapter = (value) =>
  fields(value, {
    observation: (observation) => fields(observation, { actorRole: role }),
  });
const report: Adapter = (value) => fields(value, { entries: array(entry) });
const summary: Adapter = (value) => fields(value, { usageReport: report });
const usage: Adapter = (value) => fields(value, { timeline: page(summary) });
const interval: Adapter = (value) =>
  fields(value, {
    counters: array((counter) =>
      fields(counter, {
        segments: array((segment) =>
          fields(segment, { start: entry, latest: entry }),
        ),
      }),
    ),
  });
const overview: Adapter = (value) =>
  fields(value, {
    latestExecutionSummary: summary,
    usage,
  });

export function fromLegacyWorker(path: string, value: unknown): unknown {
  const parts = path.split("?")[0].split("/").filter(Boolean);
  if (parts[0] === "agents" && parts.length <= 2)
    return parts.length === 1 ? page(agent)(value) : agent(value);
  if (parts[0] === "teams") {
    if (parts.length <= 2)
      return parts.length === 1 ? page(team)(value) : team(value);
    if (parts[2] === "members") return page(member)(value);
  }
  if (parts[0] !== "tasks") return value;
  switch (parts[2]) {
    case "execution-summaries":
      return page(summary)(value);
    case "overview":
      return overview(value);
    case "usage":
      return parts.length === 3 ? usage(value) : value;
    case "execution-intervals":
      return parts[4] === "revisions"
        ? page((revision) => fields(revision, { interval }))(value)
        : page(interval)(value);
    case "execution-tracking-events":
      return page((event) => fields(event, { evidence: array(entry) }))(
        value,
      );
    default:
      return value;
  }
}

export function toLegacyWorker(path: string, init: RequestInit) {
  const [pathname, search] = path.split("?");
  const params = new URLSearchParams(search);
  if (params.get("role") === "worker") params.set("role", "collaborator");
  if (params.has("workerId")) {
    params.set("collaboratorId", params.get("workerId")!);
    params.delete("workerId");
  }
  let body = init.body;
  if (
    /^\/teams\/[^/]+$/.test(pathname) &&
    init.method === "PATCH" &&
    typeof body === "string"
  )
    body = JSON.stringify(
      rename(JSON.parse(body), "workerIconId", "collaboratorIconId"),
    );
  return {
    path: pathname + (params.size ? `?${params}` : ""),
    init: { ...init, body },
  };
}
