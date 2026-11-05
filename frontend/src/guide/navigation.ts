import { harnesses, type Harness } from "@/launch/bootstrap";

const storageKey = "beeteam.guide.harness";
export function asHarness(value: string | null): Harness | null {
  return harnesses.find((h) => h === value) ?? null;
}
export function readHarness(url: URL): Harness | null {
  const explicit = asHarness(url.searchParams.get("harness"));
  if (explicit) return explicit;
  try {
    return asHarness(localStorage.getItem(storageKey));
  } catch {
    return null;
  }
}
export function rememberHarness(value: Harness) {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    /* URL remains shareable. */
  }
}
export function guideHref(topic: string, harness: Harness | null = null) {
  return "/guide/" + topic + (harness ? "?harness=" + harness : "");
}

export const groups = [
  {
    label: "guide.groupStartHere",
    pages: [["about", "guide.pageAbout"]],
  },
  {
    label: "guide.groupInstallation",
    pages: [
      ["installation", "guide.pageInstallation"],
      ["connect", "guide.pageConnect"],
      ["updates", "guide.pageUpdates"],
    ],
  },
  {
    label: "guide.groupUsingBeeTeam",
    pages: [
      ["first-team", "guide.pageFirstTeam"],
      ["parallel-tasks", "guide.pageParallelTasks"],
      ["review", "guide.pageReview"],
    ],
  },
  {
    label: "guide.groupReference",
    pages: [
      ["storage", "guide.pageStorage"],
      ["troubleshooting", "guide.pageTroubleshooting"],
    ],
  },
  {
    label: "guide.groupAdvanced",
    pages: [
      ["reference/environment", "guide.pageReferenceEnvironment"],
      ["reference/mcp", "guide.pageReferenceMcp"],
      ["reference/mcp/tools", "guide.pageReferenceMcpTools"],
    ],
  },
] as const;
export const pages = groups.flatMap(
  (g) => [...g.pages] as readonly (readonly [string, string])[],
);
