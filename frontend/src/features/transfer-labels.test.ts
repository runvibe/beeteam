import fs from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { setLocalePreference } from "@/i18n";
import { transferStage } from "./transfer-labels";
import { frontendRoot } from "../../scripts/i18n-audit.mjs";
const backendRoot = path.resolve(frontendRoot, "../src");
const read = (file: string) =>
  fs.readFileSync(path.join(backendRoot, file), "utf8");
const literals = (source: string) =>
  [...source.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
function backendStages() {
  const records = read("repositories/records.rs"),
    archive = read("repositories/transfer/archive.rs"),
    service = read("services/data_transfer/service.rs");
  const tables = records.match(/pub const TABLES:[\s\S]*?=\s*&\[([\s\S]*?)\];/);
  const groups = archive.match(
    /pub fn groups\(\)[\s\S]*?\.chain\(\[([^\]]+)\]\)/,
  );
  expect(
    tables,
    "backend TABLES declaration must remain inspectable",
  ).not.toBeNull();
  expect(groups, "archive groups must remain inspectable").not.toBeNull();
  const progress = [
    ...archive.matchAll(/\.progress\(\s*[^,]+,\s*"([a-z_]+)"/g),
  ].map((match) => match[1]);
  const lifecycle = [
    ...service.matchAll(/(?:\.stage\s*=|\bstage:)\s*"([a-z_]+)"/g),
  ].map((match) => match[1]);
  // Archive progress iterates groups(); restore progress iterates TABLES.
  return [
    ...new Set([
      ...literals(tables![1]),
      ...literals(groups![1]),
      ...progress,
      ...lifecycle,
    ]),
  ];
}
it.each(["en", "pt"] as const)(
  "localizes every current backend transfer progress stage in %s",
  (language) => {
    setLocalePreference(language);
    const stages = backendStages();
    expect(stages).toContain("task_execution_intervals");
    expect(stages).toContain("archive_ready");
    expect(stages.length).toBeGreaterThan(25);
    for (const stage of stages) {
      expect(transferStage(stage), stage).not.toBe(stage);
      expect(transferStage(stage), stage).not.toMatch(/^transfer\./);
      expect(transferStage(stage).trim(), stage).not.toBe("");
    }
  },
);
const expected = [
  ["task_executions", "Task executions", "Execuções de tarefas"],
  ["task_execution_intervals", "Execution intervals", "Intervalos de execução"],
  [
    "task_execution_interval_counters",
    "Execution interval counters",
    "Contadores dos intervalos de execução",
  ],
  [
    "task_execution_tracking_events",
    "Execution tracking events",
    "Eventos de rastreamento de execução",
  ],
  [
    "task_execution_interval_revisions",
    "Execution interval revisions",
    "Revisões dos intervalos de execução",
  ],
  ["images", "Images", "Imagens"],
  ["memberships", "Team memberships", "Vínculos de times"],
  ["board_events", "Board events", "Eventos dos boards"],
  ["file_contents", "File contents", "Conteúdos dos arquivos"],
  ["request_replays", "Idempotency responses", "Respostas de idempotência"],
  ["archive_ready", "Archive ready", "Arquivo pronto"],
] as const;
it.each(expected)("uses the exact EN/PT stage label for %s", (code, en, pt) => {
  setLocalePreference("en");
  expect(transferStage(code)).toBe(en);
  setLocalePreference("pt");
  expect(transferStage(code)).toBe(pt);
});
it("preserves unknown future codes and literal archive evidence", () => {
  for (const language of ["en", "pt"] as const) {
    setLocalePreference(language);
    for (const value of [
      "future_stage_v2",
      "records/task_execution_intervals.jsonl",
      "2026-11-04T12:00:00.123456789Z",
    ])
      expect(transferStage(value)).toBe(value);
  }
});
