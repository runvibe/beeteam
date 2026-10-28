import { createMockApi } from "./mock";
import { makeSeed } from "./seed";
import { it, expect } from "vitest";
import { allocateSlug } from "./mock-slugs";
it("normalizes accents, reserves names and allocates numeric collisions without reuse", () => {
  const used = new Set(["revisao"]);
  expect(allocateSlug("Revisão", "task", used)).toBe("revisao-2");
  expect(allocateSlug("Revisão", "task", used)).toBe("revisao-3");
  expect(allocateSlug("設定", "agent", used)).toBe("agent");
  expect(allocateSlug("settings", "team", used)).toBe("team-settings");
  expect(
    allocateSlug("019a23a0-0000-7000-8000-000000000001", "task", used),
  ).toMatch(/^task-/);
  const first = allocateSlug("a".repeat(90), "task", used);
  const next = allocateSlug("a".repeat(90), "task", used);
  expect(first.length).toBe(80);
  expect(next.length).toBe(80);
  expect(next.endsWith("-2")).toBe(true);
});

it("resolves archived but not deleted slugs and keeps identity after rename", async () => {
  const seed = makeSeed();
  seed.agents[0].archivedAt = "2026-10-27T00:00:00Z";
  seed.teams[0].deletedAt = "2026-10-27T00:00:00Z";
  const api = createMockApi({ delay: 0, seed });
  expect(await api.resolveSlug("agents", seed.agents[0].slug)).toEqual({
    id: seed.agents[0].id,
    slug: seed.agents[0].slug,
  });
  await expect(
    api.resolveSlug("teams", seed.teams[0].slug),
  ).rejects.toMatchObject({ status: 404 });
  const task = seed.tasks[0];
  const updated = await api.patch(
    "tasks",
    task.id,
    { title: "Novo título" },
    task.version,
  );
  expect(updated.slug).toBe(task.slug);
  expect((await api.resolveSlug("tasks", task.slug)).id).toBe(task.id);
});

it('rejects direct slug writes',async()=>{const api=createMockApi({delay:0});const row=makeSeed().agents[0];await expect(api.patch('agents',row.id,{slug:'changed'} as never,row.version)).rejects.toMatchObject({status:400});expect((await api.get('agents',row.id)).slug).toBe(row.slug);});
